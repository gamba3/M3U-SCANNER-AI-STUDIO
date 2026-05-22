import { useState, useEffect, useCallback, useRef } from "react";

interface UsePageVisibilityOptions {
  onVisible?: () => void;
  onHidden?: () => void;
}

export const usePageVisibility = (options?: UsePageVisibilityOptions) => {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [hiddenSince, setHiddenSince] = useState<Date | null>(null);
  const [hiddenDuration, setHiddenDuration] = useState(0);
  const optionsRef = useRef(options);

  useEffect(() => { optionsRef.current = options; });

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      if (!visible) {
        setHiddenSince(new Date());
        optionsRef.current?.onHidden?.();
      } else {
        setHiddenSince((prev) => {
          if (prev) setHiddenDuration(Date.now() - prev.getTime());
          return null;
        });
        optionsRef.current?.onVisible?.();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const getHiddenDurationFormatted = useCallback(() => {
    const ms = hiddenDuration;
    if (ms < 1000) return "أقل من ثانية";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}س ${minutes % 60}د`;
    if (minutes > 0) return `${minutes}د ${seconds % 60}ث`;
    return `${seconds}ث`;
  }, [hiddenDuration]);

  return { isVisible, hiddenSince, hiddenDuration, getHiddenDurationFormatted };
};
