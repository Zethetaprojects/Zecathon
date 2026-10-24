import { useEffect, useRef } from 'react';
import { useEasterEggs } from '../hooks/useEasterEggs';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  twinkle: number;
}

// 30 fps is plenty for slow-drifting stars and halves the work of 60 fps.
const FRAME_MS = 1000 / 30;

/**
 * Animated starfield behind every page. Mounted once in App.
 *
 * Performance notes: the gradient and glow are static CSS (painted once), the
 * canvas only draws small pixel squares, it runs at 30 fps, it stops while the
 * tab is hidden, and it renders a single still frame for users who prefer
 * reduced motion.
 */
export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { discover } = useEasterEggs();
  const starsRef = useRef<Star[]>([]);
  const starClickedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let animationId = 0;
    let lastFrame = 0;
    let shooting: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number } | null = null;

    const makeStars = () => {
      const count = Math.min(160, Math.floor((width * height) / 9000));
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.15 ? 2 : 1,
        speed: Math.random() * 0.25 + 0.04,
        alpha: Math.random() * 0.7 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      makeStars();
      if (reduceMotion) drawFrame(false);
    };

    const drawFrame = (advance: boolean) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      for (const s of starsRef.current) {
        if (advance) {
          s.y += s.speed;
          if (s.y > height) s.y = 0;
          s.twinkle += 0.04;
        }
        ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      if (shooting) {
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(shooting.x - shooting.vx * 6, shooting.y - shooting.vy * 6);
        ctx.strokeStyle = `rgba(255, 255, 255, ${shooting.life / shooting.maxLife})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        shooting.life -= 1;
        if (shooting.life <= 0 || shooting.x > width || shooting.y > height) shooting = null;
      }
    };

    const loop = (now: number) => {
      animationId = requestAnimationFrame(loop);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      drawFrame(true);
    };

    const start = () => {
      if (reduceMotion || animationId) return;
      animationId = requestAnimationFrame(loop);
    };

    const stop = () => {
      cancelAnimationFrame(animationId);
      animationId = 0;
    };

    // Don't burn CPU/battery in background tabs.
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = starsRef.current.some((s) => Math.hypot(mx - s.x, my - s.y) < 24);
      if (!hit) return;
      if (!starClickedRef.current) {
        starClickedRef.current = true;
        discover('star-click', 'You caught a shooting star! +50 XP', 'cyan');
      }
      shooting = { x: mx, y: my, vx: 8 + Math.random() * 6, vy: 3 + Math.random() * 3, life: 40, maxLife: 40 };
      if (reduceMotion) drawFrame(false);
    };
    canvas.addEventListener('click', onClick);

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('click', onClick);
    };
  }, [discover]);

  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      {/* Static backdrop: painted once by CSS instead of every frame on the canvas. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(176, 38, 255, 0.15), transparent 70%), linear-gradient(180deg, #050817 0%, #0a0e27 40%, #11163d 100%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
    </div>
  );
}
