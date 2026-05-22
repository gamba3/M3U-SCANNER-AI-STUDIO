import React, { useState, useEffect } from "react";
import MatrixRain from "./MatrixRain";

const ACCESS_PASSWORD = "silent@GHOST2026";

const fireColors = [
  "0 0 15px hsl(120 100% 50% / 0.6), 0 0 30px hsl(120 100% 50% / 0.4), 0 0 60px hsl(120 100% 50% / 0.2)",
  "0 0 15px hsl(345 100% 50% / 0.6), 0 0 30px hsl(345 100% 50% / 0.4), 0 0 60px hsl(345 100% 50% / 0.2)",
  "0 0 15px hsl(195 100% 50% / 0.6), 0 0 30px hsl(195 100% 50% / 0.4), 0 0 60px hsl(195 100% 50% / 0.2)",
  "0 0 15px hsl(60 100% 50% / 0.6), 0 0 30px hsl(60 100% 50% / 0.4), 0 0 60px hsl(60 100% 50% / 0.2)",
  "0 0 15px hsl(280 100% 50% / 0.6), 0 0 30px hsl(280 100% 50% / 0.4), 0 0 60px hsl(280 100% 50% / 0.2)",
  "0 0 15px hsl(25 100% 50% / 0.6), 0 0 30px hsl(25 100% 50% / 0.4), 0 0 60px hsl(25 100% 50% / 0.2)",
];

const borderColors = ["hsl(120 100% 50%)", "hsl(345 100% 50%)", "hsl(195 100% 50%)", "hsl(60 100% 50%)", "hsl(280 100% 50%)", "hsl(25 100% 50%)"];

interface LoginGateProps {
  onSuccess: () => void;
}

const LoginGate = ({ onSuccess }: LoginGateProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setColorIdx((prev) => (prev + 1) % fireColors.length), 1200);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      sessionStorage.setItem("iptv_authenticated", "true");
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <MatrixRain />
      <div className={`w-full max-w-sm bg-[hsl(var(--card))/0.9] backdrop-blur-md z-10 rounded-lg p-8 transition-all duration-700 ${shake ? "animate-shake" : ""}`}
        style={{ boxShadow: fireColors[colorIdx], borderColor: borderColors[colorIdx], borderWidth: "2px" }}>
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden transition-all duration-700" style={{ boxShadow: fireColors[colorIdx], borderColor: borderColors[colorIdx], borderWidth: "2px", borderStyle: "solid" }}>
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl">👻</div>
          </div>
          <p className="font-mono text-base tracking-wider font-bold text-foreground glow-green">SILENT 🧞‍♂️GHOST</p>
          <a href="https://t.me/SEIFGHOST" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 text-accent hover:text-primary transition-colors text-xs font-mono">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.127.037.336.027.52-.096 1.047-.567 3.602-.785 4.773-.098.533-.284.704-.477.726-.422.045-.742-.276-1.151-.542-.531-.344-.844-.563-1.384-.908-.594-.372-.208-.577.128-.907.088-.086.487-.447.487-.447s-2.93 1.935-3.207 2.065c-.213.1-.49.142-.726.028a.953.953 0 01-.29-.174c-.372-.296-.948-.686-1.36-.93-.3-.177-.563-.341-.542-.533.015-.174.254-.35.48-.464.942-.485 3.11-1.474 4.785-2.203.385-.17.985-.369 1.232-.369z"/></svg>
            @SEIFGHOST
          </a>
          <h2 className="tracking-wider text-xl text-foreground glow-green">ACCESS REQUIRED</h2>
          <p className="text-muted-foreground text-xs uppercase tracking-widest">أدخل كلمة المرور للمتابعة</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <input type="password" placeholder="PASSWORD" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }}
              className={`w-full pl-10 pr-4 py-3 bg-[hsl(var(--input))] border-2 rounded-lg font-mono tracking-widest text-foreground outline-none transition-all ${error ? "border-destructive" : "border-primary/30 focus:border-primary"}`} autoFocus />
          </div>
          {error && <p className="text-destructive text-xs text-center font-mono animate-pulse">[ ACCESS DENIED ] كلمة المرور غير صحيحة</p>}
          <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-mono tracking-wider hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            دخول
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginGate;
