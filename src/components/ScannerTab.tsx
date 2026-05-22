import React, { useState, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import StatCard from "./StatCard";
import HitResultCard from "./HitResultCard";
import TerminalLog, { LogEntry } from "./TerminalLog";
import type { HitResult, ProgressState } from "../types";
import { Socket } from "socket.io-client";

interface ScannerTabProps {
  portal: string;
  setPortal: (v: string) => void;
  combo: string[];
  setCombo: (v: string[]) => void;
  proxies: string[];
  setProxies: (v: string[]) => void;
  threads: number;
  setThreads: (v: number) => void;
  isChecking: boolean;
  setIsChecking: (v: boolean) => void;
  progress: ProgressState;
  setProgress: (v: ProgressState) => void;
  hitsList: HitResult[];
  setHitsList: (v: HitResult[] | ((prev: HitResult[]) => HitResult[])) => void;
  socket: Socket | null;
  settings: {
    bypassCloudflare: boolean;
    randomUserAgent: boolean;
    fetchCategories: boolean;
    playSound: boolean;
    uiSounds: boolean;
    soundUrl: string | null;
    hideConfigOnScan: boolean;
  };
  onNotification: (msg: string, sub: string) => void;
}

const SOUNDS = {
  start: () => { try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(523,ctx.currentTime); g.gain.setValueAtTime(0.08,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.1); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.1); setTimeout(()=>ctx.close(),200); }catch(e){} },
  stop: () => { try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(400,ctx.currentTime); g.gain.setValueAtTime(0.06,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.15); setTimeout(()=>ctx.close(),200); }catch(e){} },
  fetch: () => { try { const ctx = new AudioContext(); [440,660,880].forEach((f,i)=>{const o=ctx.createOscillator();const g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(f,ctx.currentTime+i*0.08);g.gain.setValueAtTime(0.07,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.08+0.12);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+i*0.08);o.stop(ctx.currentTime+i*0.08+0.12)}); setTimeout(()=>ctx.close(),400); }catch(e){} },
  notification: () => { try { const ctx = new AudioContext(); [700,900].forEach((f,i)=>{const o=ctx.createOscillator();const g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(f,ctx.currentTime+i*0.1);g.gain.setValueAtTime(0.07,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.1+0.1);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+i*0.1);o.stop(ctx.currentTime+i*0.1+0.1)}); setTimeout(()=>ctx.close(),300); }catch(e){} },
  error: () => { try { const ctx = new AudioContext(); const o=ctx.createOscillator();const g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(200,ctx.currentTime);g.gain.setValueAtTime(0.08,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.2);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.2);setTimeout(()=>ctx.close(),300); }catch(e){} },
};

const ScannerTab = ({ portal, setPortal, combo, setCombo, proxies, setProxies, threads, setThreads, isChecking, setIsChecking, progress, setProgress, hitsList, setHitsList, socket, settings, onNotification }: ScannerTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isFetchingCombo, setIsFetchingCombo] = useState(false);
  const [isFetchingProxy, setIsFetchingProxy] = useState(false);
  const [comboSource, setComboSource] = useState<"file" | "github">("file");
  const [proxySource, setProxySource] = useState<"none" | "file" | "github">("none");
  const [hideConfig, setHideConfig] = useState(settings.hideConfigOnScan);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setHideConfig(settings.hideConfigOnScan); }, [settings.hideConfigOnScan]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    setLogs(prev => [...prev, { id: Date.now().toString() + Math.random(), message, type, timestamp: new Date() }]);
  };

  useEffect(() => {
    if (combo.length > 0) addLog(`Loaded ${combo.length} accounts`, "success");
  }, [combo.length]);

  useEffect(() => {
    if (proxies.length > 0) addLog(`Loaded ${proxies.length} proxies`, "success");
  }, [proxies.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'combo' | 'proxy' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'audio') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        localStorage.setItem('ghost_soundUrl', dataUrl);
        if (audioRef.current) audioRef.current.src = dataUrl;
        onNotification('SOUND SAVED', 'Notification sound saved permanently');
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
        if (filtered.length === 0 && lines.length > 0) { alert('Invalid format! Combo must be user:pass format.'); return; }
        setCombo(filtered);
        if (settings.uiSounds) SOUNDS.fetch();
        onNotification('COMBO LOADED', `${filtered.length} accounts imported`);
        addLog(`${filtered.length} accounts loaded from file`, "success");
      } else {
        setProxies(lines);
        if (settings.uiSounds) SOUNDS.fetch();
        onNotification('PROXY LOADED', `${lines.length} nodes added`);
        addLog(`${lines.length} proxies loaded from file`, "success");
      }
    };
    reader.readAsText(file);
  };

  const fetchOnlineAssets = async (type: 'combo' | 'proxy') => {
    if (type === 'combo') setIsFetchingCombo(true); else setIsFetchingProxy(true);
    if (settings.uiSounds) SOUNDS.fetch();
    addLog(`Fetching ${type} from cloud...`, "system");
    try {
      const response = await fetch(`/api/fetch-assets?type=${type}`);
      if (!response.ok) throw new Error((await response.json()).error || `Failed to fetch ${type}`);
      const data = await response.text();
      const lines = data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (type === 'combo') {
        const filtered = lines.filter(line => line.includes(':'));
        setCombo(filtered);
        onNotification('CLOUD COMBO', `${filtered.length} accounts loaded`);
        addLog(`${filtered.length} accounts fetched from cloud`, "success");
      } else {
        setProxies(lines);
        onNotification('CLOUD PROXIES', `${lines.length} nodes loaded`);
        addLog(`${lines.length} proxies fetched from cloud`, "success");
      }
    } catch (error: any) {
      if (settings.uiSounds) SOUNDS.error();
      alert(`Error: ${error.message}`);
      addLog(`Failed to fetch ${type}: ${error.message}`, "error");
    } finally {
      if (type === 'combo') setIsFetchingCombo(false); else setIsFetchingProxy(false);
    }
  };

  const downloadHitsFile = async (type: 'mini' | 'full') => {
    try {
      const response = await fetch(`/api/hits/${type}?portal=${encodeURIComponent(portal)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type.toUpperCase()}_HITS_${portal.replace(/[:./]/g, '_')}.txt`;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
        onNotification(`${type.toUpperCase()} HITS`, 'Downloaded');
        addLog(`Downloaded ${type} hits file`, "system");
      } else {
        onNotification('NO HITS', `No ${type} hits file`);
      }
    } catch (error) { console.error(error); }
  };

  const startCheck = () => {
    if (!portal || combo.length === 0 || !socket) return;
    if (settings.uiSounds) SOUNDS.start();
    addLog(`Starting scan on ${portal} with ${combo.length} accounts`, "system");
    setHitsList([]);
    setLogs([]);
    setProgress({ processed: 0, total: combo.length, hits: 0, bad: 0, cpm: 0, percent: 0, proxyErrors: 0, statusCode: 200, currentUser: '', currentPass: '' });
    setIsChecking(true);
    socket.emit('startCheck', { portal: portal.trim(), combo, threads, proxies, bypassCloudflare: settings.bypassCloudflare, randomUserAgent: settings.randomUserAgent, fetchCategories: settings.fetchCategories }, (ack: any) => {});
  };

  const stopCheck = () => {
    if (socket) socket.emit('stopCheck');
    setIsChecking(false);
    if (settings.uiSounds) SOUNDS.stop();
    addLog("Scan stopped by user", "error");
  };

  const clearAll = () => {
    setPortal(''); setHitsList([]); setLogs([]);
    setProgress({ processed: 0, total: 0, hits: 0, bad: 0, cpm: 0, percent: 0, proxyErrors: 0, statusCode: 200, currentUser: '', currentPass: '' });
    setIsChecking(false); setSearchTerm('');
    onNotification('ALL CLEARED', 'Portal, stats, and hits reset');
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setPortal(text.trim()); onNotification('PASTED', 'Portal URL pasted'); }
    } catch { alert('Unable to access clipboard.'); }
  };

  const downloadHits = () => {
    const text = hitsList.map(h =>
      `╔══════════════════════════════════╗\n  Host: ${portal}\n  User: ${h.username}\n  Pass: ${h.password}\n  Status: ${h.status || 'N/A'}\n  Created: ${h.created || 'N/A'}\n  Expiry: ${h.expiry || 'N/A'}${h.daysLeft !== undefined ? ` (${h.daysLeft}d)` : ''}\n  Connections: ${h.activeCons}/${h.maxCons}\n  Realm: ${h.realm || 'N/A'} / Port: ${h.port || 'N/A'}\n  Timezone: ${h.timezone || 'N/A'}\n  Live: ${h.liveCount || 0} / VOD: ${h.vodCount || 0} / Series: ${h.seriesCount || 0}\n  M3U: ${portal}/get.php?username=${h.username}&password=${h.password}&type=m3u_plus\n╚══════════════════════════════════╝`
    ).join('\n\n');
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `hits_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element); element.click();
  };

  const filteredHits = hitsList.filter(h =>
    h.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startTimeRef = useRef(Date.now());
  useEffect(() => { if (isChecking) startTimeRef.current = Date.now(); }, [isChecking]);

  return (
    <>
      {/* Status Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/40 border border-primary/30 rounded-lg mb-4">
        <div className={cn("w-2 h-2 rounded-full animate-pulse", isChecking ? "bg-primary shadow-[0_0_8px_hsl(140_90%_50%/0.6)]" : "bg-amber-500")} />
        <span className="text-[10px] font-bold text-foreground tracking-wider">{isChecking ? "CORE_ACTIVE" : "STANDBY"}</span>
        <span className="text-muted-foreground text-[10px]">|</span>
        <span className="text-muted-foreground text-[10px]">PORTAL: {portal ? portal.substring(0, 30) + '...' : 'NONE'}</span>
        {combo.length > 0 && <><span className="text-muted-foreground text-[10px]">|</span><span className="text-primary text-[10px] glow-green">{combo.length} ACCOUNTS</span></>}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Config Panel */}
        <section className={cn("lg:col-span-8 bg-black/40 border border-primary/30 rounded-2xl p-6 space-y-6 shadow-xl", hideConfig && isChecking ? "hidden" : "")}>
          <div className="flex items-center justify-between border-b border-primary/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
              </div>
              <div><h2 className="font-bold text-foreground text-sm uppercase">Configuration</h2><p className="text-[10px] text-muted-foreground">SET UP YOUR SCAN TARGETS</p></div>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 bg-black border border-primary/30 rounded-lg text-[10px] font-bold">
                <span className="text-muted-foreground mr-1">PROXY:</span>
                <span className={proxies.length > 0 ? "text-primary" : "text-slate-600"}>{proxies.length > 0 ? `${proxies.length}` : "NONE"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target Portal URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                  </div>
                  <input type="text" placeholder="http://iptv-provider.com:8080" value={portal} onChange={(e) => setPortal(e.target.value)} disabled={isChecking}
                    className="block w-full pl-10 pr-3 py-3.5 bg-black border-2 border-primary/30 rounded-xl focus:border-primary outline-none text-sm transition-all text-foreground placeholder:text-muted-foreground/30" />
                </div>
                <button onClick={pasteFromClipboard} disabled={isChecking}
                  className="px-3 py-3.5 bg-black border-2 border-primary/30 hover:border-primary/60 text-muted-foreground hover:text-primary rounded-xl transition-all disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
                <button onClick={() => setPortal('')} disabled={isChecking || !portal}
                  className="px-3 py-3.5 bg-black border-2 border-primary/30 hover:border-destructive/60 text-muted-foreground hover:text-destructive rounded-xl transition-all disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Worker Threads</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <input type="number" value={threads} onChange={(e) => setThreads(parseInt(e.target.value))} disabled={isChecking} max={2000}
                  className="block w-full pl-10 pr-3 py-3.5 bg-black border-2 border-primary/30 rounded-xl focus:border-primary outline-none text-sm transition-all text-foreground" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-black/40 border border-primary/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <span className="text-xs font-bold text-foreground uppercase">Evasion</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Cloudflare</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", settings.bypassCloudflare ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-600")}>{settings.bypassCloudflare ? "ON" : "OFF"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">User Agent</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", settings.randomUserAgent ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-600")}>{settings.randomUserAgent ? "RANDOM" : "STATIC"}</span>
              </div>
            </div>
            <div className="p-4 bg-black/40 border border-primary/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>
                <span className="text-xs font-bold text-foreground uppercase">System</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Proxies</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", proxies.length > 0 ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-600")}>{proxies.length > 0 ? `${proxies.length}` : "NONE"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Sound</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", settings.playSound ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-600")}>{settings.playSound ? "ON" : "OFF"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <button onClick={() => fetchOnlineAssets('combo')} disabled={isFetchingCombo || isChecking}
                className={cn("w-full py-8 flex flex-col items-center justify-center gap-2 bg-black border-2 border-primary/30 hover:border-primary/60 rounded-xl transition-all", isFetchingCombo && "animate-pulse")}>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className={cn("w-5 h-5 text-primary", isFetchingCombo && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </div>
                <span className="text-xs font-bold text-foreground">{combo.length > 0 ? `${combo.length} ACCOUNTS` : "FETCH COMBO"}</span>
              </button>
              <label className="cursor-pointer flex items-center justify-center gap-2 py-2 border border-primary/30 rounded-lg hover:bg-primary/5 transition-all">
                <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span className="text-[10px] text-muted-foreground">UPLOAD FILE</span>
                <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'combo')} disabled={isChecking} />
              </label>
            </div>
            <div className="space-y-2">
              <button onClick={() => fetchOnlineAssets('proxy')} disabled={isFetchingProxy || isChecking}
                className={cn("w-full py-8 flex flex-col items-center justify-center gap-2 bg-black border-2 border-primary/30 hover:border-primary/60 rounded-xl transition-all", isFetchingProxy && "animate-pulse")}>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className={cn("w-5 h-5 text-muted-foreground", isFetchingProxy && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <span className="text-xs font-bold text-foreground">{proxies.length > 0 ? `${proxies.length} NODES` : "FETCH PROXIES"}</span>
              </button>
              <label className="cursor-pointer flex items-center justify-center gap-2 py-2 border border-primary/30 rounded-lg hover:bg-primary/5 transition-all">
                <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span className="text-[10px] text-muted-foreground">UPLOAD FILE</span>
                <input type="file" className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'proxy')} disabled={isChecking} />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={isChecking ? stopCheck : startCheck} disabled={!portal || combo.length === 0}
              className={cn("w-full py-4 rounded-xl font-bold flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-30",
                isChecking ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : "bg-primary hover:bg-primary/90 text-primary-foreground")}>
              {isChecking ? (
                <><svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>ABORT OPERATION</span></>
              ) : (
                <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span>START SCAN</span></>
              )}
            </button>
            {(!portal || combo.length === 0) && (
              <div className="px-4 py-2 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-[10px] font-bold text-warning">AWAITING PORTAL & ACCOUNTS</p>
              </div>
            )}
          </div>
        </section>

        {/* Stats Panel */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-black/40 border border-primary/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <div><h2 className="font-bold text-foreground text-sm uppercase">Performance</h2><p className="text-[10px] text-muted-foreground">LIVE FEEDBACK</p></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Hits" value={progress.hits} variant="green" />
              <StatCard label="Bad" value={progress.bad} variant="red" />
              <StatCard label="CPM" value={progress.cpm} variant="cyan" />
              <StatCard label="Errors" value={progress.proxyErrors || 0} variant="yellow" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground uppercase">Progress</span>
                <span className="text-foreground font-bold">{progress.percent}%</span>
              </div>
              <div className="h-3 w-full bg-black rounded-full border border-primary/30 overflow-hidden p-0.5">
                <div className="h-full bg-primary rounded-full transition-all duration-300 shadow-[0_0_10px_hsl(140_90%_50%/0.5)]" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{progress.processed} / {progress.total}</span>
                <span className="text-muted-foreground">{progress.percent}%</span>
              </div>
            </div>

            {isChecking && progress.currentUser && (
              <div className="p-3 bg-black border border-primary/30 rounded-lg">
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Current</p>
                <p className="text-xs font-mono text-foreground">{progress.currentUser} : {progress.currentPass}</p>
              </div>
            )}
          </div>

          <TerminalLog logs={logs} />

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => downloadHitsFile('mini')} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 rounded-lg transition-all text-[10px] font-bold text-primary">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              MINI HITS
            </button>
            <button onClick={() => downloadHitsFile('full')} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 rounded-lg transition-all text-[10px] font-bold text-primary">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              FULL HITS
            </button>
          </div>
          <button onClick={clearAll} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 rounded-lg transition-all text-[10px] font-bold text-destructive">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            CLEAR ALL
          </button>
        </section>
      </div>

      {/* Hits Section */}
      {hitsList.length > 0 && (
        <section className="bg-black/40 border border-primary/30 rounded-2xl overflow-hidden mt-6">
          <div className="p-4 border-b border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-primary text-lg font-bold glow-green">🎯 FOUND HITS ({hitsList.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-black border border-primary/30 rounded-lg text-xs focus:border-primary outline-none text-foreground placeholder:text-muted-foreground/30 w-48" />
              </div>
              <button onClick={downloadHits} disabled={hitsList.length === 0}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-30 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                SAVE
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredHits.map((hit, i) => (
              <HitResultCard hit={hit} index={i} portal={portal} uiSounds={settings.uiSounds} key={`${hit.username}-${i}`} />
            ))}
          </div>
        </section>
      )}
    </>
  );
};

export default ScannerTab;
