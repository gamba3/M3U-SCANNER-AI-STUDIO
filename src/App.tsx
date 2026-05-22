import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { cn } from './lib/utils';
import { HitResult, ProgressState } from './types';
import LoginGate from './components/LoginGate';
import ScannerTab from './components/ScannerTab';
import SettingsTab from './components/SettingsTab';
import type { ScannerSettings } from './components/SettingsTab';
import AboutTab from './components/AboutTab';
import { useWakeLock } from './hooks/useWakeLock';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("iptv_authenticated") === "true");
  const [activeTab, setActiveTab] = useState<'engine' | 'settings' | 'about'>('engine');

  const [portal, setPortal] = useState(() => localStorage.getItem('ghost_portal') || '');
  const [combo, setCombo] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('ghost_combo'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [proxies, setProxies] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('ghost_proxies'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [threads, setThreads] = useState(() => parseInt(localStorage.getItem('ghost_threads') || '150'));
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    processed: 0, total: 0, hits: 0, bad: 0, cpm: 0, percent: 0, proxyErrors: 0, statusCode: 200, currentUser: '', currentPass: ''
  });
  const [hitsList, setHitsList] = useState<HitResult[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState<{ message: string; sub: string; visible: boolean }>({ message: '', sub: '', visible: false });

  // Settings
  const [bypassCloudflare, setBypassCloudflare] = useState(() => localStorage.getItem('ghost_bypass') !== 'false');
  const [randomUserAgent, setRandomUserAgent] = useState(() => localStorage.getItem('ghost_randomUA') !== 'false');
  const [fetchCategories, setFetchCategories] = useState(() => localStorage.getItem('ghost_fetchCategories') === 'true');
  const [playSound, setPlaySound] = useState(() => localStorage.getItem('ghost_playSound') === 'true');
  const [uiSounds, setUiSounds] = useState(() => localStorage.getItem('ghost_uiSounds') !== 'false');
  const [soundUrl, setSoundUrl] = useState<string | null>(() => localStorage.getItem('ghost_soundUrl'));
  const [hideConfigOnScan, setHideConfigOnScan] = useState(() => {
    try { const s = localStorage.getItem('iptv_scanner_settings'); return s ? JSON.parse(s).hideConfigOnScan : false; } catch { return false; }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSoundRef = useRef(playSound);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);

  const { requestWakeLock, releaseWakeLock } = useWakeLock();

  // Persistence
  useEffect(() => { localStorage.setItem('ghost_portal', portal); }, [portal]);
  useEffect(() => { try { localStorage.setItem('ghost_combo', JSON.stringify(combo)); } catch (e) {} }, [combo]);
  useEffect(() => { try { localStorage.setItem('ghost_proxies', JSON.stringify(proxies)); } catch (e) {} }, [proxies]);
  useEffect(() => { localStorage.setItem('ghost_threads', threads.toString()); }, [threads]);
  useEffect(() => {
    localStorage.setItem('ghost_bypass', bypassCloudflare.toString());
    localStorage.setItem('ghost_randomUA', randomUserAgent.toString());
    localStorage.setItem('ghost_playSound', playSound.toString());
    localStorage.setItem('ghost_fetchCategories', fetchCategories.toString());
    localStorage.setItem('ghost_uiSounds', uiSounds.toString());
  }, [bypassCloudflare, randomUserAgent, playSound, fetchCategories, uiSounds]);

  // Socket connection
  useEffect(() => {
    const newSocket = io();
    newSocket.on('connect', () => { console.log('[SOCKET] Connected:', newSocket.id); setSocketConnected(true); setSocket(newSocket); });
    newSocket.on('disconnect', () => { setSocketConnected(false); });
    newSocket.on('connect_error', (err) => { console.error('[SOCKET] Connection error:', err.message); });
    newSocket.on('progress', (data: ProgressState) => setProgress(data));
    newSocket.on('hit', (hit: HitResult) => {
      setHitsList((prev) => [hit, ...prev]);
      if (playSoundRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        [880, 1100, 1320].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);
          g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.12);
          o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + i * 0.08); o.stop(ctx.currentTime + i * 0.08 + 0.12);
        });
        setTimeout(() => ctx.close(), 400);
        if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
      }
    });
    newSocket.on('hitUpdate', (updatedHit: HitResult) => {
      setHitsList((prev) => prev.map(h => (h.username === updatedHit.username && h.password === updatedHit.password) ? updatedHit : h));
    });
    newSocket.on('finished', (data?: { hits?: number; bad?: number; proxyErrors?: number; error?: string }) => {
      setIsChecking(false);
      releaseWakeLock();
    });
    return () => { newSocket.disconnect(); };
  }, []);

  // Wake lock during scan
  useEffect(() => {
    if (isChecking) requestWakeLock();
    else releaseWakeLock();
  }, [isChecking]);

  const showNotification = (msg: string, sub: string) => {
    setNotification({ message: msg, sub, visible: true });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  // Build settings object for ScannerTab
  const scannerSettings = { bypassCloudflare, randomUserAgent, fetchCategories, playSound, uiSounds, soundUrl, hideConfigOnScan };

  // Settings tab
  const [scannerConfig, setScannerConfig] = useState<ScannerSettings>(() => {
    try {
      const s = localStorage.getItem('iptv_scanner_settings');
      if (s) return JSON.parse(s);
    } catch {}
    return {
      autoSave: true, debugMode: false, timeout: '10000', maxRetries: '2',
      proxyBypass: false, proxyRotation: true, cloudflareBypass: bypassCloudflare,
      userAgent: randomUserAgent, hitSoundFile: soundUrl, hitSoundName: null,
      hitSoundEnabled: playSound, hideConfigOnScan: false, corsAnywhereEnabled: false, corsAnywhereUrl: ''
    };
  });
  const handleSettingsChange = (s: ScannerSettings) => {
    setScannerConfig(s);
    setBypassCloudflare(s.cloudflareBypass);
    setRandomUserAgent(s.userAgent);
    setPlaySound(s.hitSoundEnabled);
    setSoundUrl(s.hitSoundFile);
    setHideConfigOnScan(s.hideConfigOnScan);
    showNotification('SETTINGS SAVED', 'Configuration saved successfully');
  };

  if (!authenticated) return <LoginGate onSuccess={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <audio ref={audioRef} src={soundUrl || undefined} preload="auto" />

      {/* Notification */}
      <AnimatePresence>
        {notification.visible && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm pointer-events-none">
            <div className="bg-black/90 border border-primary/50 rounded-xl p-4 shadow-[0_0_40px_hsl(140_90%_50%/0.2)] backdrop-blur-xl flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_10px_hsl(140_90%_50%/0.8)]" />
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12" />
              <div className="p-2 bg-primary/10 rounded-lg">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-primary uppercase tracking-widest glow-green">{notification.message}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">{notification.sub}</p>
              </div>
              <motion.div className="absolute bottom-0 left-1 h-[2px] bg-primary shadow-[0_0_5px_hsl(140_90%_50%/0.8)]" initial={{ width: "0%" }} animate={{ width: "98%" }} transition={{ duration: 4, ease: "linear" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-primary/20 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_hsl(140_90%_50%/0.3)]">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none glow-green">M3U<span className="text-accent">GHOST</span></h1>
              <p className="text-[9px] text-muted-foreground font-bold tracking-[0.2em] mt-0.5">SPECTRAL_ENGINE_v3</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex bg-black p-1 rounded-lg border border-primary/30">
              {(['engine', 'settings', 'about'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-1.5 rounded text-[11px] font-bold transition-all uppercase tracking-wider",
                    activeTab === tab ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {tab === 'engine' && '🎯'} {tab === 'settings' && '⚙️'} {tab === 'about' && 'ℹ️'} {tab}
                </button>
              ))}
            </nav>

            <div className={cn("w-2 h-2 rounded-full animate-pulse", isChecking ? "bg-primary shadow-[0_0_8px_hsl(140_90%_50%/0.6)]" : "bg-amber-500")} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {activeTab === 'engine' && (
          <ScannerTab
            portal={portal} setPortal={setPortal}
            combo={combo} setCombo={setCombo}
            proxies={proxies} setProxies={setProxies}
            threads={threads} setThreads={setThreads}
            isChecking={isChecking} setIsChecking={setIsChecking}
            progress={progress} setProgress={setProgress}
            hitsList={hitsList} setHitsList={setHitsList}
            socket={socket}
            settings={scannerSettings}
            onNotification={showNotification}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab settings={scannerConfig} onSettingsChange={handleSettingsChange} />
        )}
        {activeTab === 'about' && <AboutTab />}
      </main>

      <footer className="border-t border-primary/20 py-3 text-center">
        <p className="text-[10px] text-muted-foreground animate-pulse-glow">[ SYSTEM ONLINE ] — SILENT@GHOST v2.0</p>
      </footer>
    </div>
  );
}
