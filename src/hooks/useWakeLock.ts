import { useState, useCallback, useEffect, useRef } from "react";

export const useWakeLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return false;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsLocked(true);
      wakeLockRef.current.addEventListener("release", () => {
        setIsLocked(false);
        wakeLockRef.current = null;
      });
      return true;
    } catch (err) {
      console.error("Wake Lock request failed:", err);
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (err) { console.error("Wake Lock release failed:", err); }
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isLocked && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isLocked, requestWakeLock]);

  useEffect(() => {
    return () => { if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {}); };
  }, []);

  return { isLocked, isSupported: "wakeLock" in navigator, requestWakeLock, releaseWakeLock };
};
