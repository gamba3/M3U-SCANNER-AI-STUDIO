import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";

export interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "hit" | "system";
  timestamp: Date;
}

interface TerminalLogProps {
  logs: LogEntry[];
  className?: string;
}

const TerminalLog = ({ logs, className }: TerminalLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-primary glow-green";
      case "error": return "text-destructive glow-red";
      case "hit": return "text-warning glow-yellow";
      case "system": return "text-accent glow-cyan";
      default: return "text-foreground";
    }
  };

  return (
    <div ref={scrollRef} className={cn("h-48 sm:h-64 overflow-y-auto rounded-md border-2 border-primary bg-background p-2 sm:p-4 font-mono text-[10px] sm:text-xs md:text-sm box-glow-green", className)}>
      {logs.length === 0 ? (
        <div className="flex h-full items-center justify-center text-muted-foreground text-xs sm:text-sm">
          <span className="animate-pulse">Waiting for input...</span>
          <span className="ml-1 animate-blink">█</span>
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className={cn("mb-0.5 sm:mb-1 break-all", getLogColor(log.type))}>
            <span className="text-muted-foreground text-[9px] sm:text-xs">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
          </div>
        ))
      )}
    </div>
  );
};

export default TerminalLog;
