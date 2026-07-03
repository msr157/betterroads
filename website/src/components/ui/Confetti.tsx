import { useEffect, useRef } from 'react';

const COLORS = ['#ff9933', '#ffffff', '#22c55e', '#ffd24d'];

/**
 * Lightweight canvas confetti in the India tricolor palette.
 * Each increment of `trigger` fires a fresh burst.
 * No dependencies — respects prefers-reduced-motion.
 */
export default function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const parts = Array.from({ length: 170 }).map(() => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.25,
      y: h * 0.38,
      vx: (Math.random() - 0.5) * 15 * dpr,
      vy: (Math.random() * -1 - 0.4) * 15 * dpr,
      g: 0.32 * dpr,
      size: (Math.random() * 6 + 4) * dpr,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }));

    const start = performance.now();
    let raf = 0;
    const DURATION = 2800;

    const loop = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (t < DURATION) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 100,
      }}
    />
  );
}
