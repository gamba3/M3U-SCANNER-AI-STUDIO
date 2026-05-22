import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

interface VideoPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

const VideoPlayerDialog = ({ open, onClose, url, title }: VideoPlayerDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<string>("16/9");
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
    }
  }, [open, url]);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setIsFullscreen(false);
    }
  }, [open]);

  const handleVideoClick = useCallback(() => {
    if (isPlaying) {
      videoRef.current?.pause();
      setIsPlaying(false);
    } else {
      videoRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        if (isFullscreen) {
          document.exitFullscreen();
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        handleVideoClick();
      }
      if (e.key === "m") {
        setIsMuted(prev => !prev);
      }
      if (e.key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isFullscreen, onClose, handleVideoClick]);

  const togglePlay = () => handleVideoClick();
  const toggleMute = () => setIsMuted(prev => !prev);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {}
    } else {
      try { await document.exitFullscreen(); setIsFullscreen(false); } catch {}
    }
  };

  const cycleAspectRatio = () => {
    const ratios = ["16/9", "4/3", "1/1", "auto"];
    const idx = ratios.indexOf(aspectRatio);
    setAspectRatio(ratios[(idx + 1) % ratios.length]);
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    setShowControls(true);
    const timer = window.setTimeout(() => setShowControls(false), 3000);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  const getAspectIcon = () => {
    switch (aspectRatio) {
      case "16/9": return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="2"/></svg>;
      case "4/3": return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2" strokeWidth="2"/></svg>;
      case "1/1": return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" strokeWidth="2"/></svg>;
      default: return <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 8h16M4 16h16"/></svg>;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-4xl mx-4" onMouseMove={handleMouseMove}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-primary text-sm font-mono truncate glow-green">{title || "Stream Player"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden border-2 border-primary/50 box-glow-green" style={{ aspectRatio: aspectRatio === "auto" ? undefined : aspectRatio }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-primary text-sm animate-pulse glow-green">Loading stream...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-destructive text-sm glow-red">{error}</div>
            </div>
          )}
          <video
            ref={videoRef}
            src={url}
            className="w-full h-full object-contain cursor-pointer"
            muted={isMuted}
            playsInline
            onClick={togglePlay}
            onLoadedData={() => { setIsLoading(false); videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {}); }}
            onError={() => { setIsLoading(false); setError("Failed to load stream. Try another URL."); }}
          />

          {!isLoading && !error && (
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
              <button onClick={togglePlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary/80 hover:bg-primary flex items-center justify-center transition-all">
                {isPlaying ? (
                  <svg className="h-8 w-8 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg className="h-8 w-8 text-primary-foreground ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2">
                <button onClick={togglePlay} className="h-8 w-8 text-white hover:text-primary hover:bg-white/10 rounded flex items-center justify-center transition-all">
                  {isPlaying ? <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                <button onClick={toggleMute} className="h-8 w-8 text-white hover:text-primary hover:bg-white/10 rounded flex items-center justify-center transition-all">
                  {isMuted ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg> : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>}
                </button>
                <div className="flex-1" />
                <button onClick={cycleAspectRatio} className="h-8 w-8 text-white hover:text-primary hover:bg-white/10 rounded flex items-center justify-center transition-all" title={`Aspect: ${aspectRatio}`}>
                  {getAspectIcon()}
                </button>
                <button onClick={toggleFullscreen} className="h-8 w-8 text-white hover:text-primary hover:bg-white/10 rounded flex items-center justify-center transition-all">
                  {isFullscreen ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg> : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerDialog;
