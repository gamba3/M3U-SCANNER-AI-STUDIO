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
  Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { HitResult, ProgressState } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'engine' | 'settings'>('engine');
  
  const [portal, setPortal] = useState('');
  const [combo, setCombo] = useState<string[]>([]);
  const [proxies, setProxies] = useState<string[]>([]);
  const [proxyType, setProxyType] = useState<'http' | 'socks4' | 'socks5' | 'none'>('none');
  const [threads, setThreads] = useState(150);
  
  // Settings
  const [bypassCloudflare, setBypassCloudflare] = useState(true);
  const [randomUserAgent, setRandomUserAgent] = useState(true);
  const [playSound, setPlaySound] = useState(false);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);

  const [isChecking, setIsChecking] = useState(false);
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
  
  // Use refs for settings that are read inside the socket closure to avoid re-wiring
  const playSoundRef = useRef(playSound);
  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('progress', (data: ProgressState) => {
      setProgress(data);
    });

    newSocket.on('hit', (hit: HitResult) => {
      setHitsList((prev) => [hit, ...prev]);
      if (playSoundRef.current && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    });

    newSocket.on('hitUpdate', (updatedHit: HitResult) => {
      setHitsList((prev) => prev.map(h => 
        (h.username === updatedHit.username && h.password === updatedHit.password) 
          ? updatedHit 
          : h
      ));
    });

    newSocket.on('finished', (data?: { error?: string }) => {
      setIsChecking(false);
      if (data?.error) alert(`Error: ${data.error}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // Run only once on mount

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'combo' | 'proxy' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'audio') {
      const url = URL.createObjectURL(file);
      setSoundUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
      }
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
      } else {
        setProxies(lines);
        if (proxyType === 'none') setProxyType('http');
      }
    };
    reader.readAsText(file);
  };


  const startCheck = () => {
    if (!portal || combo.length === 0 || !socket) return;
    
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
      threads, 
      proxies, 
      bypassCloudflare, 
      randomUserAgent 
    });
  };

  const stopCheck = () => {
    window.location.reload(); 
  };

  const downloadHits = () => {
    const text = hitsList.map(h => 
      `URL: ${portal}\nUser: ${h.username}\nPass: ${h.password}\nExpiry: ${h.expiry}\nMax Connections: ${h.maxCons}\nStreams: Live(${h.liveCount}) VOD(${h.vodCount}) Series(${h.seriesCount})\n-------------------`
    ).join('\n\n');
    
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `hits_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const filteredHits = hitsList.filter(h => 
    h.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
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
                        onChange={(e) => setThreads(parseInt(e.target.value))}
                        disabled={isChecking}
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
                  <div className="grid grid-cols-2 gap-4">
                    <label className="cursor-pointer group">
                      <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] rounded-3xl transition-all shadow-sm">
                        <div className="p-3 bg-slate-900 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {combo.length > 0 ? "COMBO LOADED" : "UPLOAD COMBO"}
                          </p>
                          <p className="text-[10px] text-slate-600 font-medium mt-1">
                            {combo.length > 0 ? `${combo.length} items` : ".txt format"}
                          </p>
                        </div>
                        <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'combo')} disabled={isChecking} />
                      </div>
                    </label>

                    <label className="cursor-pointer group">
                      <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] rounded-3xl transition-all shadow-sm">
                        <div className="p-3 bg-slate-900 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                          <Download className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-200 uppercase tracking-tight">
                            {proxies.length > 0 ? "PROXY LOADED" : "UPLOAD PROXY"}
                          </p>
                          <p className="text-[10px] text-slate-600 font-medium mt-1">
                            {proxies.length > 0 ? `${proxies.length} nodes` : "Optional"}
                          </p>
                        </div>
                        <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'proxy')} disabled={isChecking} />
                      </div>
                    </label>
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
                                {hit.username[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{hit.username}</div>
                                <div className="text-[11px] font-mono font-bold text-slate-500 tracking-tight">{hit.password}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 max-w-[80px] h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                                 <div 
                                   className={cn(
                                     "h-full transition-all",
                                     hit.activeCons === hit.maxCons ? "bg-rose-500" : "bg-emerald-500"
                                   )} 
                                   style={{ width: `${(hit.activeCons / (hit.maxCons || 1)) * 100}%` }}
                                 />
                              </div>
                              <span className={cn(
                                "text-[11px] font-bold px-2 py-0.5 rounded-lg",
                                hit.activeCons === hit.maxCons ? "text-rose-400 bg-rose-400/10" : "text-emerald-400 bg-emerald-400/10"
                              )}>
                                {hit.activeCons} / {hit.maxCons}
                              </span>
                            </div>
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
                               onClick={() => navigator.clipboard.writeText(`${portal}/get.php?username=${hit.username}&password=${hit.password}&type=m3u_plus`)}
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
