import { useEffect, useRef, memo } from 'react';

const MatrixRain = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01';
    const charArray = chars.split('');
    const fontSize = 16;
    const columnSpacing = fontSize * 1.6;
    const columns = Math.floor(canvas.width / columnSpacing);
    const drops: number[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
      speeds[i] = 0.35 + Math.random() * 0.45;
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fontSize}px JetBrains Mono, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * columnSpacing;
        const y = drops[i] * fontSize;

        const gradient = ctx.createLinearGradient(x, y - fontSize * 6, x, y);
        gradient.addColorStop(0, 'rgba(0, 255, 70, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 255, 70, 0.35)');
        gradient.addColorStop(1, 'rgba(0, 255, 70, 0.85)');

        ctx.shadowBlur = 0;
        ctx.fillStyle = gradient;
        ctx.fillText(char, x, y);

        ctx.shadowColor = '#00ff46';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#d6ffe0';
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;

        if (y > canvas.height && Math.random() > 0.97) drops[i] = 0;
        drops[i] += speeds[i];
      }
    };

    const interval = setInterval(draw, 75);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />;
});

MatrixRain.displayName = 'MatrixRain';
export default MatrixRain;
