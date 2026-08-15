import { useEffect, useRef } from 'react';
import { useEasterEggs } from '../hooks/useEasterEggs';

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { discover } = useEasterEggs();
  const starsRef = useRef<{ x: number; y: number; r: number; speed: number; alpha: number; twinkle: number }[]>([]);
  const starClickedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    resize();
    window.addEventListener('resize', resize);

    const stars: typeof starsRef.current = [];
    const count = Math.min(220, Math.floor((width * height) / 6000));

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.15 + 0.02,
        alpha: Math.random() * 0.7 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;

    // Shooting star state
    let shooting: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number } | null = null;

    const draw = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#050817');
      gradient.addColorStop(0.4, '#0a0e27');
      gradient.addColorStop(1, '#11163d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // subtle purple glow at bottom
      const glow = ctx.createRadialGradient(width * 0.5, height, 0, width * 0.5, height, width * 0.8);
      glow.addColorStop(0, 'rgba(176, 38, 255, 0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > height) s.y = 0;
        s.twinkle += 0.02;
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fill();
      });

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
        if (shooting.life <= 0 || shooting.x > width || shooting.y > height) {
          shooting = null;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hit = false;
      for (const s of starsRef.current) {
        const dx = mx - s.x;
        const dy = my - s.y;
        if (Math.sqrt(dx * dx + dy * dy) < 24) {
          hit = true;
          break;
        }
      }
      if (hit) {
        if (!starClickedRef.current) {
          starClickedRef.current = true;
          discover('star-click', 'You caught a shooting star! +50 XP', 'cyan');
        }
        // spawn a shooting star from the click area
        shooting = {
          x: mx,
          y: my,
          vx: 8 + Math.random() * 6,
          vy: 3 + Math.random() * 3,
          life: 40,
          maxLife: 40,
        };
      }
    };

    canvas.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', onClick);
    };
  }, [discover]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 cursor-crosshair"
      aria-hidden="true"
    />
  );
}
