import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { HitResult, ProgressState } from './types';

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
  const [proxyType, setProxyType] = useState<'http' | 'socks4' | 'socks5' | 'none'>(() => {
    return (localStorage.getItem('ghost_proxyType') as any) || 'none';
  });
  const [threads, setThreads] = useState(() => {
    const v = parseInt(localStorage.getItem('ghost_threads') || '150', 10);
    return Number.isFinite(v) && v > 0 ? Math.min(v, 1000) : 150;
  });
  
  // Settings
  const [bypassCloudflare, setBypassCloudflare] = useState(() => {
    return localStorage.getItem('ghost_bypass') !== 'false';
  });
  const [randomUserAgent, setRandomUserAgent] = useState(() => {
    return localStorage.getItem('ghost_randomUA') !== 'false';
  });
  const [playSound, setPlaySound] = useState(() => {
    return localStorage.getItem('ghost_playSound') === 'true';
  });
  const [soundUrl, setSoundUrl] = useState<string | null>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [isFetchingCombo, setIsFetchingCombo] = useState(false);
  const [isFetchingProxy, setIsFetchingProxy] = useState(false);
  const [notification, setNotification] = useState<{ message: string; sub: string; visible: boolean }>({ message: '', sub: '', visible: false });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('ghost_portal', portal);
  }, [portal]);

  useEffect(() => {
    try { localStorage.setItem('ghost_combo', JSON.stringify(combo)); } catch (e) {}
  }, [combo]);

  useEffect(() => {
    try { localStorage.setItem('ghost_proxies', JSON.stringify(proxies)); } catch (e) {}
  }, [proxies]);

  useEffect(() => {
    localStorage.setItem('ghost_proxyType', proxyType);
  }, [proxyType]);

  useEffect(() => {
    localStorage.setItem('ghost_threads', threads.toString());
  }, [threads]);

  useEffect(() => {
    localStorage.setItem('ghost_bypass', bypassCloudflare.toString());
    localStorage.setItem('ghost_randomUA', randomUserAgent.toString());
    localStorage.setItem('ghost_playSound', playSound.toString());
  }, [bypassCloudflare, randomUserAgent, playSound]);
  const [progress, setProgress] = useState<ProgressState>({
    processed: 0,
    total: 0,
    hits: 0,
    bad: 0,
    cpm: 0,
    percent: 0,
    proxyErrors: 0,
  });
  const [hitsList, setHitsList] = useState<HitResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundUrlRef = useRef<string | null>(null);
  
  // Use refs for settings that are read inside the socket closure to avoid re-wiring
  const playSoundRef = useRef(playSound);
  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  const showNotification = useCallback((msg: string, sub: string) => {
    setNotification({ message: msg, sub, visible: true });
    window.setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  }, []);

  useEffect(() => {
    const newSocket = io({ transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('progress', (data: ProgressState) => {
      setProgress(data);
    });

    newSocket.on('hit', (hit: HitResult) => {
      setHitsList((prev) => [hit, ...prev]);
      if (playSoundRef.current && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    });

    newSocket.on('hitUpdate', (updatedHit: HitResult) => {
      setHitsList((prev) => prev.map(h => 
        (h.username === updatedHit.username && h.password === updatedHit.password) 
          ? { ...h, ...updatedHit }
          : h
      ));
    });

    newSocket.on('finished', (data?: { error?: string; aborted?: boolean; hits?: number }) => {
      setIsChecking(false);
      if (data?.error) {
        showNotification('SCAN ERROR', data.error);
      } else if (data?.aborted) {
        showNotification('SCAN ABORTED', 'Operation terminated by user');
      } else {
        showNotification('SCAN COMPLETE', `Captured ${data?.hits ?? 0} valid hits`);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('[v0] socket connect_error:', err.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [showNotification]); // showNotification is stable via useCallback

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'combo' | 'proxy' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'audio') {
      // Revoke previous blob URL to prevent memory leaks
      if (soundUrlRef.current) {
        try { URL.revokeObjectURL(soundUrlRef.current); } catch {}
      }
      const url = URL.createObjectURL(file);
      soundUrlRef.current = url;
      setSoundUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
      }
      showNotification('SOUND UPDATED', 'Notification sound changed successfully');
      // Reset input so the same file can be re-selected
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (type === 'combo') {
        const filtered = lines.filter(line => line.includes(':'));
        if (filtered.length === 0) {
          showNotification('INVALID FORMAT', 'Combo file must contain user:pass entries');
          e.target.value = '';
          return;
        }
        setCombo(filtered);
        showNotification('COMBO LOADED', `${filtered.length} accounts imported successfully`);
      } else {
        const filtered = lines.filter(line => /\d+\.\d+\.\d+\.\d+:\d+/.test(line) || /^(https?|socks[45]):\/\//i.test(line));
        if (filtered.length === 0) {
          showNotification('INVALID FORMAT', 'Proxy file must contain ip:port entries');
          e.target.value = '';
          return;
        }
        setProxies(filtered);
        if (proxyType === 'none') setProxyType('http');
        showNotification('PROXY LOADED', `${filtered.length} nodes added to the pool`);
      }
      e.target.value = '';
    };
    reader.onerror = () => {
      showNotification('READ ERROR', 'Failed to read the selected file');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const fetchOnlineAssets = async (type: 'combo' | 'proxy') => {
    if (type === 'combo') setIsFetchingCombo(true);
    else setIsFetchingProxy(true);

    try {
      const response = await fetch(`/api/fetch-assets?type=${type}`);
      if (!response.ok) {
        let errMsg = `Failed to fetch ${type}`;
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.text();
      const lines = data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      if (type === 'combo') {
        const filtered = lines.filter(line => line.includes(':'));
        setCombo(filtered);
        showNotification('CLOUD COMBO FETCHED', `${filtered.length} new accounts loaded from repository`);
      } else {
        setProxies(lines);
        if (proxyType === 'none') setProxyType('http');
        showNotification('CLOUD PROXIES FETCHED', `${lines.length} high-speed nodes synchronized`);
      }
    } catch (error: any) {
      showNotification('FETCH FAILED', error.message || 'Network error');
    } finally {
      if (type === 'combo') setIsFetchingCombo(false);
      else setIsFetchingProxy(false);
    }
  };


  const startCheck = () => {
    if (!portal.trim()) {
      showNotification('MISSING PORTAL', 'Please enter a target portal URL');
      return;
    }
    if (combo.length === 0) {
      showNotification('MISSING COMBO', 'Please load a combo list first');
      return;
    }
    if (!socket || !socket.connected) {
      showNotification('SOCKET OFFLINE', 'Engine connection unavailable, refresh page');
      return;
    }
    
    setHitsList([]);
    setProgress({
      processed: 0,
      total: combo.length,
      hits: 0,
      bad: 0,
      cpm: 0,
      percent: 0,
      proxyErrors: 0
    });
    setIsChecking(true);
    socket.emit('startCheck', { 
      portal: portal.trim(), 
      combo, 
      threads: Number.isFinite(threads) && threads > 0 ? Math.min(threads, 1000) : 150, 
      proxies, 
      proxyType,
      bypassCloudflare, 
      randomUserAgent 
    });
  };

  const stopCheck = () => {
    if (socket && socket.connected) {
      socket.emit('stopCheck');
    }
    // UI will be reset when 'finished' event arrives
  };

  const downloadHits = () => {
    if (hitsList.length === 0) return;
    const text = hitsList.map(h => 
      `URL: ${portal}\nUser: ${h.username}\nPass: ${h.password}\nExpiry: ${h.expiry ?? 'N/A'}\nMax Connections: ${h.maxCons ?? 'N/A'}\nStreams: Live(${h.liveCount ?? 0}) VOD(${h.vodCount ?? 0}) Series(${h.seriesCount ?? 0})\nM3U: ${h.m3uLink ?? ''}\n-------------------`
    ).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `hits_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (soundUrlRef.current) {
        try { URL.revokeObjectURL(soundUrlRef.current); } catch {}
      }
    };
  }, []);

  const filteredHits = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return hitsList;
    return hitsList.filter(h =>
      h.username.toLowerCase().includes(term) ||
      h.status?.toLowerCase().includes(term)
    );
  }, [hitsList, searchTerm]);

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
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] mt-1">SPECTRAL_ENGINE_v2</p>
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
                    <div className="relative group">
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
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setThreads(Number.isFinite(v) && v > 0 ? Math.min(v, 1000) : 1);
                        }}
                        disabled={isChecking}
                        min={1}
                        max={1000}
                        className="block w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">Privacy Protocol</span>
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
                    </div>
                  </div>

                  <div className="p-5 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col justify-center gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCw className="w-4 h-4 text-indigo-500" />
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
                </div>
              </section>
            </div>

            <section className="bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[400px]">
              <div className="p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-[1.2rem]">
                    <ListFilter className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg tracking-tight">Captured Spectral Data</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Identified {hitsList.length} verified access points</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="text" 
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 pr-6 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none w-full md:w-80 transition-all placeholder:text-slate-700"
                    />
                  </div>
                  <button 
                    onClick={downloadHits}
                    disabled={hitsList.length === 0}
                    className="flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-indigo-600/10 disabled:opacity-30 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Export Results
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/30 text-[10px] uppercase font-bold text-slate-500 tracking-[0.1em] border-b border-slate-800/50">
                      <th className="px-8 py-5">Target Authentication</th>
                      <th className="px-8 py-5">Session Capacity</th>
                      <th className="px-8 py-5">Index Load (L/V/S)</th>
                      <th className="px-8 py-5">TTL / Expiry</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    <AnimatePresence>
                      {filteredHits.map((hit, i) => (
                        <motion.tr 
                          key={`${hit.username}-${i}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center font-black text-indigo-400 text-sm border border-indigo-500/20">
                                {(hit.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{hit.username}</div>
                                <div className="text-[11px] font-mono font-bold text-slate-500 tracking-tight">{hit.password}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            {(() => {
                              const active = parseInt(String(hit.activeCons ?? '0'), 10) || 0;
                              const max = parseInt(String(hit.maxCons ?? '0'), 10) || 0;
                              const ratio = max > 0 ? Math.min(100, (active / max) * 100) : 0;
                              const full = max > 0 && active >= max;
                              return (
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 max-w-[80px] h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        full ? "bg-rose-500" : "bg-emerald-500"
                                      )}
                                      style={{ width: `${ratio}%` }}
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-[11px] font-bold px-2 py-0.5 rounded-lg",
                                    full ? "text-rose-400 bg-rose-400/10" : "text-emerald-400 bg-emerald-400/10"
                                  )}>
                                    {active} / {max}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-black">L:{hit.liveCount || 0}</span>
                              <span className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-black">V:{hit.vodCount || 0}</span>
                              <span className="px-2.5 py-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-black">S:{hit.seriesCount || 0}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className={cn(
                              "flex flex-col gap-1",
                              hit.daysLeft && hit.daysLeft < 30 ? "text-rose-400" : "text-indigo-400"
                            )}>
                              <span className="text-sm font-black tracking-tight">{hit.expiry}</span>
                              {hit.daysLeft !== undefined && (
                                <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase">
                                  <Clock className="w-3 h-3" />
                                  {hit.daysLeft} DAYS
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button 
                               onClick={() => {
                                 const link = hit.m3uLink || `${portal}/get.php?username=${encodeURIComponent(hit.username)}&password=${encodeURIComponent(hit.password)}&type=m3u_plus`;
                                 navigator.clipboard.writeText(link).then(
                                   () => showNotification('M3U COPIED', 'Link copied to clipboard'),
                                   () => showNotification('COPY FAILED', 'Clipboard unavailable')
                                 );
                               }}
                               className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-slate-400 hover:text-indigo-400 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95"
                             >
                               Copy M3U
                             </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filteredHits.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-32 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-4 opacity-50">
                            <div className="w-20 h-20 rounded-[2rem] bg-slate-950 border border-slate-800 flex items-center justify-center p-4">
                               <Info className="w-10 h-10 text-slate-700" />
                            </div>
                            <div>
                               <h3 className="text-sm font-black text-slate-300 tracking-widest uppercase">No Spectral Activity</h3>
                               <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-tight">System is awaiting data injection</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                      <span className="text-[10px] text-slate-600 font-bold tracking-wider leading-none">TLS FINGERPRINT SPOOFING</span>
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
                      <span className="text-sm font-black text-white block uppercase tracking-tight">Audio Alerts</span>
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
                               {soundUrl ? "Custom Audio Active" : "No Audio Mounted"}
                             </p>
                             <p className="text-[10px] text-slate-500 font-bold">WAV/MP3 FILES SUPPORTED</p>
                           </div>
                           <label className="cursor-pointer px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/10">
                             UPLOAD ALERT
                             <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} className="hidden" />
                           </label>
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
             <span>M3U_GHOST SPECTRAL ENGINE v2.4</span>
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
    </div>
  );
}
