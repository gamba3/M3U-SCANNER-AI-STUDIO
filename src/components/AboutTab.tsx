import { useState, useEffect } from "react";

const colors = [
  "hsl(120, 100%, 50%)", "hsl(180, 100%, 50%)", "hsl(0, 100%, 50%)", "hsl(60, 100%, 50%)",
  "hsl(280, 100%, 50%)", "hsl(30, 100%, 50%)", "hsl(200, 100%, 50%)", "hsl(320, 100%, 50%)",
  "hsl(90, 100%, 50%)", "hsl(240, 100%, 50%)", "hsl(150, 100%, 50%)", "hsl(350, 100%, 50%)",
  "hsl(45, 100%, 50%)", "hsl(270, 100%, 50%)", "hsl(165, 100%, 50%)", "hsl(15, 100%, 50%)",
  "hsl(195, 100%, 50%)", "hsl(330, 100%, 50%)", "hsl(75, 100%, 50%)", "hsl(210, 100%, 50%)",
];

const AboutTab = () => {
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setColorIndex((prev) => (prev + 1) % colors.length), 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] font-mono transition-colors duration-200"
          style={{ color: colors[colorIndex], textShadow: `0 0 10px ${colors[colorIndex]}, 0 0 20px ${colors[colorIndex]}, 0 0 30px ${colors[colorIndex]}` }}>
          SILENT A GHOST
        </h1>
        <div className="space-y-1">
          <p className="text-lg sm:text-xl text-accent font-mono tracking-wider">DEVELOPED BY: SILENT@GHOST</p>
          <p className="text-sm sm:text-base text-muted-foreground font-mono">Advanced IPTV Scanner & Proxy Checker</p>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono">High Performance | Multi-Threaded | Secure</p>
        </div>
        <a href="https://t.me/SEIFGHOST" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-background font-mono tracking-wider rounded-lg transition-all text-sm">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.127.037.336.027.52-.096 1.047-.567 3.602-.785 4.773-.098.533-.284.704-.477.726-.422.045-.742-.276-1.151-.542-.531-.344-.844-.563-1.384-.908-.594-.372-.208-.577.128-.907.088-.086.487-.447.487-.447s-2.93 1.935-3.207 2.065c-.213.1-.49.142-.726.028a.953.953 0 01-.29-.174c-.372-.296-.948-.686-1.36-.93-.3-.177-.563-.341-.542-.533.015-.174.254-.35.48-.464.942-.485 3.11-1.474 4.785-2.203.385-.17.985-.369 1.232-.369z"/></svg>
          CONTACT DEVELOPER (TELEGRAM)
        </a>
      </div>

      <div className="border-2 border-warning/50 bg-warning/10 rounded-lg p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
        <svg className="h-5 w-5 sm:h-6 sm:w-6 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <p className="text-warning text-xs sm:text-sm font-mono text-center flex-1" dir="rtl">إخلاء مسؤولية: نحن نخلي مسؤوليتنا تماماً عن أي استعمال خاطئ أو غير قانوني لهذا البرنامج</p>
        <svg className="h-5 w-5 sm:h-6 sm:w-6 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>

      <div className="flex justify-center">
        <div className="border-2 border-primary rounded-lg p-2 box-glow-green max-w-xs">
          <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20 rounded flex items-center justify-center">
            <span className="text-6xl">👻</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="border border-primary/50 rounded-lg p-3 sm:p-4 bg-background/50 text-center">
          <div className="text-2xl sm:text-3xl mb-2">🔍</div>
          <h3 className="text-primary font-mono text-sm sm:text-base">Fast Scanner</h3>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Multi-threaded scanning</p>
        </div>
        <div className="border border-primary/50 rounded-lg p-3 sm:p-4 bg-background/50 text-center">
          <div className="text-2xl sm:text-3xl mb-2">🛡️</div>
          <h3 className="text-primary font-mono text-sm sm:text-base">Proxy Support</h3>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Built-in proxy checker</p>
        </div>
        <div className="border border-primary/50 rounded-lg p-3 sm:p-4 bg-background/50 text-center sm:col-span-2 lg:col-span-1">
          <div className="text-2xl sm:text-3xl mb-2">⚡</div>
          <h3 className="text-primary font-mono text-sm sm:text-base">High Performance</h3>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Optimized for speed</p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-black/60 p-3 sm:p-4 overflow-x-auto">
        <pre className="text-[8px] sm:text-xs text-primary whitespace-pre">{`
██╗██████╗ ████████╗██╗   ██╗
██║██╔══██╗╚══██╔══╝██║   ██║
██║██████╔╝   ██║   ██║   ██║
██║██╔═══╝    ██║   ╚██╗ ██╔╝
██║██║        ██║    ╚████╔╝
╚═╝╚═╝        ╚═╝     ╚═══╝
  SCANNER v2.0 - HACKER EDITION
`}</pre>
      </div>
    </div>
  );
};

export default AboutTab;
