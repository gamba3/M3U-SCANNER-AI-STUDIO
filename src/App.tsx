import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Ghost,
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Globe,
  Upload,
  Download,
  Search,
  Timer,
  Info,
  Clock,
  ListFilter,
  ShieldAlert,
  Zap,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
  Music,
  FileText,
  Database,
  Wifi,
  Server,
  Clipboard,
  Eraser
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { HitResult, ProgressState } from './types';

const playTone = (freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    setTimeout(() => ctx.close(), duration + 100);
  } catch (e) { }
};

const SOUNDS = {
  click: () => playTone(1200, 50, 'sine', 0.05),
  start: () => { playTone(523, 100, 'sine', 0.08); setTimeout(() => playTone(659, 100, 'sine', 0.08), 100); },
  stop: () => { playTone(400, 150, 'sawtooth', 0.06); },
  hit: () => { playTone(880, 80, 'sine', 0.1); setTimeout(() => playTone(1100, 80, 'sine', 0.1), 80); setTimeout(() => playTone(1320, 120, 'sine', 0.1), 160); },
  clear: () => { playTone(300, 100, 'triangle', 0.06); setTimeout(() => playTone(200, 150, 'triangle', 0.06), 100); },
  paste: () => playTone(900, 60, 'sine', 0.06),
  fetch: () => { playTone(440, 80, 'sine', 0.07); setTimeout(() => playTone(660, 80, 'sine', 0.07), 80); setTimeout(() => playTone(880, 120, 'sine', 0.07), 160); },
  download: () => { playTone(600, 60, 'sine', 0.06); setTimeout(() => playTone(800, 60, 'sine', 0.06), 60); },
  copy: () => playTone(1000, 40, 'sine', 0.05),
  error: () => { playTone(200, 200, 'sawtooth', 0.08); },
  notification: () => { playTone(700, 100, 'sine', 0.07); setTimeout(() => playTone(900, 100, 'sine', 0.07), 100); },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'engine' | 'settings'>('engine');

  const [portal, setPortal] = useState(() => localStorage.getItem('ghost_portal') || '');
  const [combo, setCombo] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ghost_combo');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [proxies, setProxies] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ghost_proxies');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [threads, setThreads] = useState(() => {
    return parseInt(localStorage.getItem('ghost_threads') || '150');
  });

  // Settings
  const [bypassCloudflare, setBypassCloudflare] = useState(() => {
    return localStorage.getItem('ghost_bypass') !== 'false';
  });
  const [randomUserAgent, setRandomUserAgent] = useState(() => {
    return localStorage.getItem('ghost_randomUA') !== 'false';
  });
  const [fetchCategories, setFetchCategories] = useState(() => {
    return localStorage.getItem('ghost_fetchCategories') === 'true';
  });
  const [playSound, setPlaySound] = useState(() => {
    return localStorage.getItem('ghost_playSound') === 'true';
  });
  const [uiSounds, setUiSounds] = useState(() => {
    return localStorage.getItem('ghost_uiSounds') !== 'false';
  });
  const [soundUrl, setSoundUrl] = useState<string | null>(() => {
    return localStorage.getItem('ghost_soundUrl');
  });

  const [isChecking, setIsChecking] = useState(false);
  const [isFetchingCombo, setIsFetchingCombo] = useState(false);
  const [isFetchingProxy, setIsFetchingProxy] = useState(false);
  const [notification, setNotification] = useState<{ message: string; sub: string; visible: boolean }>({ message: '', sub: '', visible: false });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('ghost_portal', portal);
  }, [portal]);

  useEffect(() => {
    try { localStorage.setItem('ghost_combo', JSON.stringify(combo)); } catch (e) { }
  }, [combo]);

  useEffect(() => {
    try { localStorage.setItem('ghost_proxies', JSON.stringify(proxies)); } catch (e) { }
  }, [proxies]);

  useEffect(() => {
    localStorage.setItem('ghost_threads', threads.toString());
  }, [threads]);

  useEffect(() => {
    localStorage.setItem('ghost_bypass', bypassCloudflare.toString());
    localStorage.setItem('ghost_randomUA', randomUserAgent.toString());
    localStorage.setItem('ghost_playSound', playSound.toString());
    localStorage.setItem('ghost_fetchCategories', fetchCategories.toString());
    localStorage.setItem('ghost_uiSounds', uiSounds.toString());
  }, [bypassCloudflare, randomUserAgent, playSound, fetchCategories, uiSounds]);

  const [progress, setProgress] = useState<ProgressState>({
    processed: 0,
    total: 0,
    hits: 0,
    bad: 0,
    cpm: 0,
    percent: 0,
    proxyErrors: 0,
    statusCode: 200,
    currentUser: '',
    currentPass: '',
  });
  const [hitsList, setHitsList] = useState<HitResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && soundUrl) {
      audioRef.current.src = soundUrl;
    }
  }, [soundUrl]);

  // Use refs for settings that are read inside the socket closure to avoid re-wiring
  const playSoundRef = useRef(playSound);
  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const newSocket = io();

    newSocket.on('connect', () => {
      console.log('[SOCKET] Connected:', newSocket.id);
      setSocketConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setSocketConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err.message);
    });

    newSocket.on('progress', (data: ProgressState) => {
      console.log('[SOCKET] Progress received:', data);
      setProgress(data);
    });

    newSocket.on('hit', (hit: HitResult) => {
      setHitsList((prev) => [hit, ...prev]);
      if (playSoundRef.current) {
        SOUNDS.hit();
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => { });
        }
      }
    });

    newSocket.on('hitUpdate', (updatedHit: HitResult) => {
      setHitsList((prev) => prev.map(h =>
        (h.username === updatedHit.username && h.password === updatedHit.password)
          ? updatedHit
          : h
      ));
    });

    newSocket.on('finished', (data?: { hits?: number; bad?: number; proxyErrors?: number; error?: string }) => {
      setIsChecking(false);
      if (data?.error) alert(`Error: ${data.error}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const showNotification = (msg: string, sub: string) => {
    if (uiSounds) SOUNDS.notification();
    setNotification({ message: msg, sub, visible: true });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'combo' | 'proxy' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'audio') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setSoundUrl(dataUrl);
        localStorage.setItem('ghost_soundUrl', dataUrl);
        if (audioRef.current) {
          audioRef.current.src = dataUrl;
        }
        showNotification('SOUND SAVED', 'Notification sound saved permanently');
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (type === 'combo') {
        const filtered = lines.filter(line => line.includes(':'));
        if (filtered.length === 0 && lines.length > 0) {
          alert('Invalid format! The Combo file must contain accounts in user:pass format.');
        }
        setCombo(filtered);
        if (uiSounds) SOUNDS.fetch();
        showNotification('COMBO LOADED', `${filtered.length} accounts imported successfully`);
      } else {
        setProxies(lines);
        if (uiSounds) SOUNDS.fetch();
        showNotification('PROXY LOADED', `${lines.length} nodes added to the pool`);
      }
    };
    reader.readAsText(file);
  };

  const fetchOnlineAssets = async (type: 'combo' | 'proxy') => {
    if (type === 'combo') setIsFetchingCombo(true);
    else setIsFetchingProxy(true);
    if (uiSounds) SOUNDS.fetch();

    try {
      const response = await fetch(`/api/fetch-assets?type=${type}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch ${type}`);
      }
      const data = await response.text();
      const lines = data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      if (type === 'combo') {
        const filtered = lines.filter(line => line.includes(':'));
        setCombo(filtered);
        showNotification('CLOUD COMBO FETCHED', `${filtered.length} new accounts loaded from repository`);
      } else {
        setProxies(lines);
        showNotification('CLOUD PROXIES FETCHED', `${lines.length} high-speed nodes synchronized`);
      }
    } catch (error: any) {
      if (uiSounds) SOUNDS.error();
      alert(`Error fetching ${type}: ${error.message}`);
    } finally {
      if (type === 'combo') setIsFetchingCombo(false);
      else setIsFetchingProxy(false);
    }
  };

  const downloadHitsFile = async (type: 'mini' | 'full') => {
    if (uiSounds) SOUNDS.download();
    try {
      const response = await fetch(`/api/hits/${type}?portal=${encodeURIComponent(portal)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type.toUpperCase()}_HITS_${portal.replace(/[:./]/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification(`${type.toUpperCase()} HITS DOWNLOADED`, 'File saved successfully');
      } else {
        showNotification('NO HITS YET', `No ${type} hits file available`);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const startCheck = () => {
    if (!portal || combo.length === 0 || !socket) {
      console.warn('[SOCKET] Cannot start: missing portal, combo, or socket');
      return;
    }
    if (!socket.connected) {
      console.warn('[SOCKET] Socket not connected, emit will be buffered');
    }
    if (uiSounds) SOUNDS.start();

    setHitsList([]);
    setProgress({
      processed: 0,
      total: combo.length,
      hits: 0,
      bad: 0,
      cpm: 0,
      percent: 0,
      proxyErrors: 0,
      statusCode: 200,
      currentUser: '',
      currentPass: '',
    });
    setIsChecking(true);
    console.log('[SOCKET] Emitting startCheck, connected:', socket.connected);
    socket.emit('startCheck', {
      portal: portal.trim(),
      combo,
      threads,
      proxies,
      bypassCloudflare,
      randomUserAgent,
      fetchCategories,
    }, (ack: any) => {
      console.log('[SOCKET] Server acknowledged:', ack);
    });
  };

  const stopCheck = () => {
    if (socket) {
      socket.emit('stopCheck');
    }
    setIsChecking(false);
    if (uiSounds) SOUNDS.stop();
  };

  const clearAll = () => {
    if (uiSounds) SOUNDS.clear();
    setPortal('');
    setHitsList([]);
    setProgress({
      processed: 0, total: 0, hits: 0, bad: 0, cpm: 0, percent: 0, proxyErrors: 0, statusCode: 200, currentUser: '', currentPass: ''
    });
    setIsChecking(false);
    setSearchTerm('');
    showNotification('ALL CLEARED', 'Portal, stats, and hits reset');
  };

  const pasteFromClipboard = async () => {
    if (uiSounds) SOUNDS.paste();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPortal(text.trim());
        showNotification('PASTED', 'Portal URL pasted from clipboard');
      }
    } catch (e) {
      alert('Unable to access clipboard. Please paste manually.');
    }
  };

  const downloadHits = () => {
    if (uiSounds) SOUNDS.download();
    const text = hitsList.map(h =>
      `╔══════════════════════════════════╗\n` +
      `  Host: ${portal}\n` +
      `  User: ${h.username}\n` +
      `  Pass: ${h.password}\n` +
      `  Status: ${h.status || 'N/A'}\n` +
      `  Created: ${h.created || 'N/A'}\n` +
      `  Expiry: ${h.expiry || 'N/A'}${h.daysLeft !== undefined ? ` (${h.daysLeft} days)` : ''}\n` +
      `  Connections: ${h.activeCons}/${h.maxCons}\n` +
      `  Realm: ${h.realm || 'N/A'} // Port: ${h.port || 'N/A'}\n` +
      `  Timezone: ${h.timezone || 'N/A'}\n` +
      `  Live: ${h.liveCount || 0} / VOD: ${h.vodCount || 0} / Series: ${h.seriesCount || 0}\n` +
      `  M3U: ${portal}/get.php?username=${h.username}&password=${h.password}&type=m3u_plus\n` +
      `  Formats: ${h.outputFormats || 'N/A'}\n` +
      `╚══════════════════════════════════╝`
    ).join('\n\n');

    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `hits_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const filteredHits = hitsList.filter(h =>
    h.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Status code color helper
  const getStatusColor = (code?: number) => {
    if (!code) return 'text-slate-400';
    if (code === 200) return 'text-emerald-400';
    if (code === 301 || code === 302) return 'text-orange-400';
    if (code === 403) return 'text-red-400';
    if (code === 404) return 'text-yellow-400';
    if (code === 407) return 'text-purple-400';
    if (code === 429) return 'text-amber-400';
    if (code === 500) return 'text-red-500';
    if (code === 503) return 'text-yellow-500';
    if (code === 520) return 'text-pink-400';
    return 'text-slate-400';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <AnimatePresence>
        {notification.visible && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm pointer-events-none"
          >
            <div className="bg-slate-950 border border-lime-500/50 rounded-2xl p-4 shadow-[0_0_40px_rgba(132,204,22,0.2)] backdrop-blur-xl flex items-center gap-4 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-lime-500 shadow-[0_0_10px_#84cc16]" />
              <div className="absolute top-0 right-0 w-24 h-24 bg-lime-500/10 blur-3xl rounded-full -mr-12 -mt-12" />

              <div className="p-2 bg-lime-500/10 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-lime-400" />
              </div>

              <div className="flex-1">
                <h4 className="text-sm font-black text-lime-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]">{notification.message}</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{notification.sub}</p>
              </div>

              <motion.div
                className="absolute bottom-0 left-1 h-[2px] bg-lime-500 shadow-[0_0_5px_#84cc16]"
                initial={{ width: "0%" }}
                animate={{ width: "98%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Ghost className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">
                M3U<span className="text-indigo-400">GHOST</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] mt-1">SPECTRAL_ENGINE_v3</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('engine')}
                className={cn(
                  "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'engine' ? "bg-slate-800 text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                )}
              >
                ENGINE
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === 'settings' ? "bg-slate-800 text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Settings2 className="w-3.5 h-3.5" />
                SETTINGS
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isChecking ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-amber-500")} />
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                {isChecking ? "CORE_ACTIVE" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-10 space-y-10">
        {activeTab === 'engine' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <section className="lg:col-span-8 bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/50 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                      <Globe className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-200 text-sm tracking-tight uppercase">Configuration</h2>
                      <p className="text-[10px] text-slate-500 font-medium">SET UP YOUR SCAN TARGETS</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold">
                      <span className="text-slate-500 mr-2">PROXY:</span>
                      <span className={proxies.length > 0 ? "text-indigo-400" : "text-slate-600"}>
                        {proxies.length > 0 ? `${proxies.length} LOADED` : "NONE"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Target Portal URL</label>
                    <div className="flex gap-2">
                      <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Globe className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder="http://iptv-provider.com:8080"
                          value={portal}
                          onChange={(e) => setPortal(e.target.value)}
                          disabled={isChecking}
                          className="block w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm transition-all placeholder:text-slate-700"
                        />
                      </div>
                      <button
                        onClick={pasteFromClipboard}
                        disabled={isChecking}
                        className="px-4 py-4 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded-2xl transition-all disabled:opacity-30"
                        title="Paste from clipboard"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </button>
                      <button
                        onClick={() => setPortal('')}
                        disabled={isChecking || !portal}
                        className="px-4 py-4 bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-2xl transition-all disabled:opacity-30"
                        title="Clear portal"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Worker Threads</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Zap className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input
                        type="number"
                        value={threads}
                        onChange={(e) => setThreads(parseInt(e.target.value))}
                        disabled={isChecking}
                        max={2000}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Evasion Protocol</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-medium transition-opacity">
                        <span className="text-slate-500">Cloudflare Shield</span>
                        <span className={cn("px-2 py-0.5 rounded-md", bypassCloudflare ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-600")}>
                          {bypassCloudflare ? "ENABLED" : "DISABLED"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-medium transition-opacity">
                        <span className="text-slate-500">Agent Spoofing</span>
                        <span className={cn("px-2 py-0.5 rounded-md", randomUserAgent ? "bg-indigo-500/10 text-indigo-400" : "bg-slate-800 text-slate-600")}>
                          {randomUserAgent ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-medium transition-opacity">
                        <span className="text-slate-500">Fetch Categories</span>
                        <span className={cn("px-2 py-0.5 rounded-md", fetchCategories ? "bg-lime-500/10 text-lime-400" : "bg-slate-800 text-slate-600")}>
                          {fetchCategories ? "ENABLED" : "DISABLED"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">System Overlays</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-medium">
                        <span className="text-slate-500">Proxy Rotation</span>
                        <span className={cn("px-2 py-0.5 rounded-md", proxies.length > 0 ? "bg-indigo-400/10 text-indigo-400" : "bg-slate-800 text-slate-600")}>
                          {proxies.length > 0 ? "DYNAMIC" : "STATIC"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-medium">
                        <span className="text-slate-500">Audio Feedback</span>
                        <span className={cn("px-2 py-0.5 rounded-md", playSound ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-600")}>
                          {playSound ? "ACTIVE" : "MUTED"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-medium">
                        <span className="text-slate-500">File Export</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-400/10 text-indigo-400">
                          AUTO
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => fetchOnlineAssets('combo')}
                        disabled={isFetchingCombo || isChecking}
                        className={cn(
                          "group h-32 flex flex-col items-center justify-center gap-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] rounded-3xl transition-all shadow-sm relative overflow-hidden",
                          isFetchingCombo && "animate-pulse"
                        )}
                      >
                        <div className="p-3 bg-slate-900 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                          <RotateCw className={cn("w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors", isFetchingCombo && "animate-spin")} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {isFetchingCombo ? "FETCHING..." : (combo.length > 0 ? "COMBO LOADED" : "FETCH CLOUD COMBO")}
                          </p>
                          <p className="text-[10px] text-slate-600 font-medium mt-1">
                            {combo.length > 0 ? `${combo.length} items from cloud` : "Load from GitHub"}
                          </p>
                        </div>
                        {isFetchingCombo && <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 animate-[shimmer_2s_infinite]" style={{ width: '100%' }} />}
                      </button>
                      <label className="cursor-pointer group flex items-center justify-center gap-2 py-2 border border-slate-800/50 rounded-xl hover:bg-slate-900 transition-all">
                        <Upload className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300">OR UPLOAD FILE</span>
                        <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'combo')} disabled={isChecking} />
                      </label>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => fetchOnlineAssets('proxy')}
                        disabled={isFetchingProxy || isChecking}
                        className={cn(
                          "group h-32 flex flex-col items-center justify-center gap-3 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] rounded-3xl transition-all shadow-sm relative overflow-hidden",
                          isFetchingProxy && "animate-pulse"
                        )}
                      >
                        <div className="p-3 bg-slate-900 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                          <Globe className={cn("w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors", isFetchingProxy && "animate-spin")} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {isFetchingProxy ? "FETCHING..." : (proxies.length > 0 ? "PROXY LOADED" : "FETCH CLOUD PROXY")}
                          </p>
                          <p className="text-[10px] text-slate-600 font-medium mt-1">
                            {proxies.length > 0 ? `${proxies.length} nodes active` : "Load from URLs"}
                          </p>
                        </div>
                        {isFetchingProxy && <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 animate-[shimmer_2s_infinite]" style={{ width: '100%' }} />}
                      </button>
                      <label className="cursor-pointer group flex items-center justify-center gap-2 py-2 border border-slate-800/50 rounded-xl hover:bg-slate-900 transition-all">
                        <Upload className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300">OR UPLOAD FILE</span>
                        <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'proxy')} disabled={isChecking} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <button
                      onClick={isChecking ? stopCheck : startCheck}
                      disabled={!portal || combo.length === 0}
                      className={cn(
                        "flex-1 px-8 py-4 rounded-[2rem] font-bold flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale",
                        isChecking
                          ? "bg-rose-500 hover:bg-rose-600 text-white shadow-xl shadow-rose-500/20"
                          : "bg-white hover:bg-slate-100 text-slate-950 shadow-xl"
                      )}
                    >
                      {isChecking ? (
                        <Square className="w-6 h-6 fill-current animate-pulse" />
                      ) : (
                        <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-current ml-1" />
                        </div>
                      )}
                      <div className="text-left font-sans">
                        <p className="text-sm font-black leading-none">{isChecking ? "ABORT OPERATION" : "START_SCAN_SESSION"}</p>
                        <p className={cn("text-[10px] mt-1 font-bold", isChecking ? "text-rose-100" : "text-slate-500")}>
                          {isChecking ? "TERMINATE ALL WORKERS" : "INITIATE INFILTRATION"}
                        </p>
                      </div>
                    </button>
                    {!portal || combo.length === 0 ? (
                      <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                        <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-amber-600 uppercase">[!] AWAITING PORTAL_URL AND COMBO_FILE [!]</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="lg:col-span-4 flex flex-col gap-8">
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-xl space-y-8 flex-1">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h2 className="font-bold text-slate-200 text-sm tracking-tight uppercase">Performance</h2>
                      <p className="text-[10px] text-slate-500 font-medium tracking-[0.05em]">LIVE FEEDBACK LOOP</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Valid Hits</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-black text-white tracking-tighter">{progress.hits}</span>
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Rejections</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-black text-slate-400 tracking-tighter">{progress.bad}</span>
                        <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
                          <XCircle className="w-4 h-4 text-rose-400" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Requests / M</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-black text-indigo-400 tracking-tighter">{progress.cpm}</span>
                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                          <Zap className="w-4 h-4 text-indigo-400" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Network Err</p>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-black text-slate-600 tracking-tighter">{progress.proxyErrors || 0}</span>
                        <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                          <Globe className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proxy Pool & ETA Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                      <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Proxy Pool</p>
                      <p className="text-lg font-black text-indigo-400">{progress.proxyPoolSize ?? '—'}</p>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                      <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Dead</p>
                      <p className="text-lg font-black text-rose-400">{progress.deadProxies ?? 0}</p>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                      <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">ETA</p>
                      <p className="text-lg font-black text-amber-400">
                        {progress.eta ? (progress.eta > 3600 ? `${Math.floor(progress.eta / 3600)}h${Math.floor((progress.eta % 3600) / 60)}m` : progress.eta > 60 ? `${Math.floor(progress.eta / 60)}m${progress.eta % 60}s` : `${progress.eta}s`) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Status Code Display */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-slate-500" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Status Code</p>
                      </div>
                      <span className={cn("text-xl font-black tracking-tighter", getStatusColor(progress.statusCode))}>
                        {progress.statusCode || '---'}
                      </span>
                    </div>
                    {isChecking && progress.currentUser && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <p className="text-[9px] text-slate-600 uppercase mb-1">Current Check</p>
                        <p className="text-xs font-mono text-slate-400">
                          {progress.currentUser} : {progress.currentPass}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Engine Progress</p>
                        <p className="text-xl font-black text-white">{progress.percent}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-600 uppercase">Items Processed</p>
                        <p className="text-xs font-mono font-bold text-slate-400">{progress.processed} / {progress.total}</p>
                      </div>
                    </div>
                    <div className="h-4 w-full bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-1 shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percent}%` }}
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                      />
                    </div>
                  </div>

                  {/* Download Hits Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadHitsFile('mini')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl transition-all"
                    >
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Mini Hits</span>
                    </button>
                    <button
                      onClick={() => downloadHitsFile('full')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 rounded-xl transition-all"
                    >
                      <Database className="w-4 h-4 text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Full Hits</span>
                    </button>
                    <button
                      onClick={clearAll}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 rounded-xl transition-all"
                      title="Clear all stats, portal, and hits"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-[10px] font-bold text-rose-400 uppercase">Clear All</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section className="bg-black/60 border border-emerald-500/30 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.1)] overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 text-lg font-bold">🎯 FOUND HITS ({hitsList.length})</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 bg-black border border-slate-700 rounded-xl text-sm focus:border-emerald-500 outline-none w-full md:w-64 transition-all placeholder:text-slate-600 text-slate-300"
                    />
                  </div>
                  <button
                    onClick={downloadHits}
                    disabled={hitsList.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    SAVE
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <AnimatePresence>
                  {filteredHits.map((hit, i) => (
                    <motion.div
                      key={`${hit.username}-${i}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-black/80 border border-emerald-500/30 rounded-2xl p-4 space-y-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 transition-all"
                    >
                      {/* Header: ACTIVE | Ping | Days | Trial */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-sm font-bold">🔥 ACTIVE</span>
                          {hit.ping && (
                            <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded text-[10px] font-bold">
                              ⚡ {hit.ping}ms
                            </span>
                          )}
                          {hit.isTrial && (
                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded text-[10px] font-bold">
                              TRIAL
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {hit.country && (
                            <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-bold">
                              🌍 {hit.country}
                            </span>
                          )}
                          {hit.daysLeft !== undefined && hit.daysLeft !== 9999 && (
                            <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded text-[10px] font-bold">
                              {hit.daysLeft}d
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Host */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🌐 Host:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400 text-xs font-mono">{hit.hostPort || `${hit.realm || 'N/A'}:${hit.port || '80'}`}</span>
                          <button onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.hostPort || `${hit.realm || ''}:${hit.port || '80'}`); }} className="text-slate-500 hover:text-cyan-400 transition-colors">
                            <Clipboard className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Panel Type & Protocol */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🖥 Panel:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400 text-xs font-mono">{hit.panelType || 'N/A'}</span>
                          {hit.serverProtocol && (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-[9px] font-bold uppercase">
                              {hit.serverProtocol}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* User */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">👤 User:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-400 text-xs font-mono">{hit.username}</span>
                          <button onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.username); }} className="text-slate-500 hover:text-emerald-400 transition-colors">
                            <Clipboard className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Pass */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🔑 Pass:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-400 text-xs font-mono">{hit.password}</span>
                          <button onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.password); }} className="text-slate-500 hover:text-emerald-400 transition-colors">
                            <Clipboard className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Expire */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🕐 Expire:</span>
                        <span className="text-yellow-400 text-xs font-mono">{hit.expiry || 'Unlimited'}</span>
                      </div>

                      {/* Connections */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🔗 Connections:</span>
                        <span className="text-cyan-400 text-xs font-mono">{hit.activeCons}/{hit.maxCons}</span>
                      </div>

                      {/* Content (Live/VOD/Series) */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">📺 Content:</span>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded text-[10px] font-bold" title="Live">{hit.liveCount || 0}L</span>
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded text-[10px] font-bold" title="VOD">{hit.vodCount || 0}V</span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold" title="Series">{hit.seriesCount || 0}S</span>
                        </div>
                      </div>

                      {/* Server IP & ISP */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🖧 Server IP:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-cyan-400 text-xs font-mono">{hit.serverIP || 'N/A'}</span>
                          {hit.serverIP && (
                            <button onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.serverIP || ''); }} className="text-slate-500 hover:text-cyan-400 transition-colors">
                              <Clipboard className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ISP */}
                      {hit.isp && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-xs">🏢 ISP:</span>
                          <span className="text-slate-300 text-xs truncate max-w-[180px]" title={hit.isp}>{hit.isp}</span>
                        </div>
                      )}

                      {/* VPN */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">🛡 VPN:</span>
                        {hit.vpn ? (
                          <span className={cn("text-xs font-bold", hit.vpn.startsWith('VPN') ? "text-amber-400" : "text-emerald-400")}>
                            {hit.vpn.startsWith('VPN') ? '⚠️' : '✅'} {hit.vpn}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">N/A</span>
                        )}
                      </div>

                      {/* Timezone */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">📍 Timezone:</span>
                        <span className="text-slate-300 text-xs">{hit.timezone || 'N/A'}</span>
                      </div>

                      {/* Adult */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">Adult Content:</span>
                        {hit.isAdult === true ? (
                          <span className="text-rose-400 text-xs font-bold">🔞 YES</span>
                        ) : (
                          <span className="text-emerald-400 text-xs font-bold">✅ NO</span>
                        )}
                      </div>

                      {/* Extra Server Info (collapsible row) */}
                      {(hit.httpsPort || hit.rtmpPort || hit.serverLoad) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {hit.httpsPort && (
                            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[9px] font-bold">HTTPS:{hit.httpsPort}</span>
                          )}
                          {hit.rtmpPort && (
                            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[9px] font-bold">RTMP:{hit.rtmpPort}</span>
                          )}
                          {hit.serverLoad && (
                            <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[9px] font-bold">Load:{hit.serverLoad}</span>
                          )}
                        </div>
                      )}

                      {/* Footer Buttons */}
                      <div className="flex gap-2 pt-2 border-t border-slate-800/50">
                        <button
                          onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.m3uLink || `${portal}/get.php?username=${hit.username}&password=${hit.password}&type=m3u_plus`); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/10 transition-all"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          M3U
                        </button>
                        <button
                          onClick={() => { if (uiSounds) SOUNDS.copy(); navigator.clipboard.writeText(hit.epgUrl || ''); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-bold hover:bg-purple-500/10 transition-all"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          EPG
                        </button>
                        <button
                          onClick={() => window.open(hit.m3uLink || `${portal}/get.php?username=${hit.username}&password=${hit.password}&type=m3u_plus`, '_blank')}
                          className="flex-1 flex items-center justify-center gap-2 py-2 border border-yellow-500/30 text-yellow-400 rounded-xl text-xs font-bold hover:bg-yellow-500/10 transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          PLAY
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredHits.length === 0 && (
                  <div className="col-span-full py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-4xl">📡</div>
                      <h3 className="text-sm font-bold text-slate-400 tracking-wider uppercase">No Hits Found Yet</h3>
                      <p className="text-xs text-slate-600">Start scanning to find active accounts</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'settings' && (
          <section className="bg-slate-900/60 border border-slate-800/60 rounded-[3rem] p-10 shadow-2xl max-w-4xl mx-auto space-y-12 backdrop-blur-md">
            <div className="flex items-center gap-5 pb-10 border-b border-slate-800">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                <Settings2 className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">System Settings</h2>
                <p className="text-xs font-bold text-slate-500 tracking-widest mt-1">CORE CONFIGURATION & OVERRIDES</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-indigo-500" />
                  <span className="font-black text-slate-100 text-sm tracking-widest uppercase">Evasion Control</span>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-white block uppercase tracking-tight">Cloudflare Shield</span>
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">TLS FINGERPRINT SPOOFING (CLOUDSCRAPER)</span>
                    </div>
                    <button
                      onClick={() => setBypassCloudflare(!bypassCloudflare)}
                      className={cn("w-14 h-7 rounded-full transition-all relative", bypassCloudflare ? "bg-emerald-500/20 border border-emerald-500/50" : "bg-slate-800 border border-slate-700")}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 rounded-full transition-all shadow-lg", bypassCloudflare ? "left-8 bg-emerald-500" : "left-1 bg-slate-500")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-white block uppercase tracking-tight">Rotational UA</span>
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">DYNAMIC HEADER INJECTION</span>
                    </div>
                    <button
                      onClick={() => setRandomUserAgent(!randomUserAgent)}
                      className={cn("w-14 h-7 rounded-full transition-all relative", randomUserAgent ? "bg-indigo-500/20 border border-indigo-500/50" : "bg-slate-800 border border-slate-700")}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 rounded-full transition-all shadow-lg", randomUserAgent ? "left-8 bg-indigo-500" : "left-1 bg-slate-500")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-white block uppercase tracking-tight">Fetch Categories</span>
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">GET LIVE CATEGORIES ON HIT</span>
                    </div>
                    <button
                      onClick={() => setFetchCategories(!fetchCategories)}
                      className={cn("w-14 h-7 rounded-full transition-all relative", fetchCategories ? "bg-lime-500/20 border border-lime-500/50" : "bg-slate-800 border border-slate-700")}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 rounded-full transition-all shadow-lg", fetchCategories ? "left-8 bg-lime-500" : "left-1 bg-slate-500")} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-black text-slate-100 text-sm tracking-widest uppercase">Notifications</span>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-white block uppercase tracking-tight">UI Sounds</span>
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">CLICK SOUNDS FOR BUTTONS & ACTIONS</span>
                    </div>
                    <button
                      onClick={() => setUiSounds(!uiSounds)}
                      className={cn("w-14 h-7 rounded-full transition-all relative", uiSounds ? "bg-indigo-500/20 border border-indigo-500/50" : "bg-slate-800 border border-slate-700")}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 rounded-full transition-all shadow-lg", uiSounds ? "left-8 bg-indigo-500" : "left-1 bg-slate-500")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-950 border border-slate-800 rounded-3xl group hover:border-indigo-500/30 transition-all">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-white block uppercase tracking-tight">Hit Alerts</span>
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">PLAY SOUND ON SUCCESSFUL HIT</span>
                    </div>
                    <button
                      onClick={() => setPlaySound(!playSound)}
                      className={cn("w-14 h-7 rounded-full transition-all relative", playSound ? "bg-emerald-500/20 border border-emerald-500/50" : "bg-slate-800 border border-slate-700")}
                    >
                      <div className={cn("absolute top-1 w-5 h-5 rounded-full transition-all shadow-lg", playSound ? "left-8 bg-emerald-500" : "left-1 bg-slate-500")} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {playSound && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 p-6 border border-indigo-500/30 bg-slate-950 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                          <div className="p-3 bg-indigo-500/10 rounded-xl">
                            <Music className="w-6 h-6 text-indigo-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-black text-white uppercase tracking-tight">
                              {soundUrl ? "Custom Audio Saved" : "No Audio Mounted"}
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold">PERSISTENT — UPLOAD ONCE, SAVED FOREVER</p>
                          </div>
                          <label className="cursor-pointer px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/10">
                            UPLOAD ALERT
                            <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} className="hidden" />
                          </label>
                          {soundUrl && (
                            <button onClick={() => {
                              setSoundUrl(null);
                              localStorage.removeItem('ghost_soundUrl');
                              if (audioRef.current) audioRef.current.src = '';
                              showNotification('SOUND REMOVED', 'Custom sound cleared, using built-in tones');
                            }} className="px-4 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600/40 text-red-400 text-[10px] font-black tracking-widest rounded-xl transition-all">
                              REMOVE
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>
        )}

        <audio ref={audioRef} src={soundUrl || undefined} className="hidden" />
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-800/50 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
              <Ghost className="w-3.5 h-3.5 text-slate-700" />
            </div>
            <span>M3U_GHOST SPECTRAL ENGINE v3.0</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              SYS_ACTIVE
            </div>
            <span className="text-slate-800">/</span>
            <span className="hover:text-indigo-400 transition-colors">PHANTOM_PROTOCOL_INITIALIZED</span>
          </div>
        </div>
      </footer>
    </div >
  );
}