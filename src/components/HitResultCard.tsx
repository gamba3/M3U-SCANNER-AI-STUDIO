import { useState } from "react";
import { cn } from "../lib/utils";
import VideoPlayerDialog from "./VideoPlayerDialog";
import type { HitResult } from "../types";

interface HitResultCardProps {
  hit: HitResult;
  index: number;
  portal: string;
  uiSounds: boolean;
  key?: string;
}

const SOUNDS = {
  copy: () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
      setTimeout(() => ctx.close(), 100);
    } catch (e) {}
  }
};

const HitResultCard = ({ hit, index, portal, uiSounds }: HitResultCardProps) => {
  const [videoOpen, setVideoOpen] = useState(false);
  const m3uLink = hit.m3uLink || `${window.location.protocol}//${portal}/get.php?username=${hit.username}&password=${hit.password}&type=m3u_plus`;

  const copyToClipboard = (text: string) => {
    if (uiSounds) SOUNDS.copy();
    navigator.clipboard.writeText(text);
  };

  const playStream = () => setVideoOpen(true);

  return (
    <div className="bg-black/80 border border-emerald-500/30 rounded-2xl p-4 space-y-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-sm font-bold">🔥 ACTIVE</span>
          {hit.ping !== undefined && (
            <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded text-[10px] font-bold">⚡ {hit.ping}ms</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hit.serverIP && (
            <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-bold">
              🌍 {hit.serverIP}
            </span>
          )}
          {hit.daysLeft !== undefined && hit.daysLeft !== 9999 && (
            <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded text-[10px] font-bold">{hit.daysLeft}d</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">🌐 Host:</span>
        <div className="flex items-center gap-1">
          <span className="text-cyan-400 text-xs font-mono">{hit.hostPort || `${hit.realm || 'N/A'}:${hit.port || '80'}`}</span>
          <button onClick={() => copyToClipboard(hit.hostPort || `${hit.realm || ''}:${hit.port || '80'}`)} className="text-slate-500 hover:text-cyan-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">👤 User:</span>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400 text-xs font-mono">{hit.username}</span>
          <button onClick={() => copyToClipboard(hit.username)} className="text-slate-500 hover:text-emerald-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">🔑 Pass:</span>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400 text-xs font-mono">{hit.password}</span>
          <button onClick={() => copyToClipboard(hit.password)} className="text-slate-500 hover:text-emerald-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">🕐 Expire:</span>
        <span className="text-slate-300 text-xs font-mono">{hit.expiry || 'Unlimited'}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">🖥 Server IP:</span>
        <div className="flex items-center gap-1">
          <span className="text-cyan-400 text-xs font-mono">{hit.serverIP || 'N/A'}</span>
          {hit.serverIP && <button onClick={() => copyToClipboard(hit.serverIP!)} className="text-slate-500 hover:text-cyan-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </button>}
        </div>
      </div>

      {hit.vpn && (
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">📍 Location:</span>
          <span className="text-yellow-400 text-xs font-mono">{hit.vpn}</span>
        </div>
      )}

      {hit.isAdult !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">⛔ Adult:</span>
          <span className={hit.isAdult ? "text-destructive text-xs font-mono" : "text-primary text-xs font-mono"}>{hit.isAdult ? '✅ Yes' : '❌ No'}</span>
        </div>
      )}

      {(hit.liveCount !== undefined || hit.vodCount !== undefined || hit.seriesCount !== undefined) && (
        <div className="flex items-center gap-1 flex-wrap">
          {hit.liveCount !== undefined && <span className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded text-[9px] font-bold">📺 {hit.liveCount}</span>}
          {hit.vodCount !== undefined && <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded text-[9px] font-bold">🎬 {hit.vodCount}</span>}
          {hit.seriesCount !== undefined && <span className="px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded text-[9px] font-bold">📺 {hit.seriesCount}</span>}
        </div>
      )}

      <div className="flex items-center gap-1">
        <span className="text-slate-400 text-xs">🔗 M3U:</span>
        <button onClick={() => copyToClipboard(m3uLink)} className="text-cyan-500 hover:text-cyan-400 transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </button>
      </div>

      <button onClick={playStream} className="w-full mt-2 py-2 bg-primary/20 border border-primary/50 text-primary rounded-lg text-xs font-bold hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        PLAY STREAM
      </button>

      <VideoPlayerDialog open={videoOpen} onClose={() => setVideoOpen(false)} url={m3uLink} title={`${hit.username}@${hit.hostPort || portal}`} />
    </div>
  );
};

export default HitResultCard;
