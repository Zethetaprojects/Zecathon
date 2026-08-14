import { useEffect, useRef, useState } from 'react';

const CURSOR_SIZE = 36;
const TRAIL_SIZE = 28;

export default function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [hidden, setHidden] = useState(false);

  const posRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef({ x: 0, y: 0 });
  const cursorRef = useRef<HTMLImageElement>(null);
  const trailImgRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.body.classList.add('custom-cursor-active');
    setVisible(true);

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const { x, y } = posRef.current;
          const t = trailRef.current;
          t.x += (x - t.x) * 0.15;
          t.y += (y - t.y) * 0.15;
          trailRef.current = t;

          cursorRef.current?.style.setProperty(
            'transform',
            `translate3d(${x}px, ${y}px, 0) translate(-4px, -4px) scale(${hovering ? (clicking ? 0.85 : 1.2) : 1}) rotate(${clicking ? -10 : 0}deg)`
          );
          trailImgRef.current?.style.setProperty(
            'transform',
            `translate3d(${t.x}px, ${t.y}px, 0) translate(-4px, -4px) scale(${hovering ? 1.1 : 1})`
          );
        });
      }
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('a, button, [role="button"], input, textarea, select, [data-cursor-hover]') ||
        target.closest('[data-cursor-pointer]')
      ) {
        setHovering(true);
      }
    };

    const onOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('a, button, [role="button"], input, textarea, select, [data-cursor-hover]') ||
        target.closest('[data-cursor-pointer]')
      ) {
        setHovering(false);
      }
    };

    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);
    const onLeave = () => setHidden(true);
    const onEnter = () => setHidden(false);

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      document.body.classList.remove('custom-cursor-active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hovering, clicking]);

  if (!visible) return null;

  return (
    <>
      <img
        ref={trailImgRef}
        src="/pngegg.png"
        alt=""
        className={`fixed top-0 left-0 pointer-events-none z-[9998] select-none transition-opacity duration-200 ${
          hidden ? 'opacity-0' : 'opacity-40'
        }`}
        style={{
          width: TRAIL_SIZE,
          height: TRAIL_SIZE,
          filter: 'drop-shadow(0 0 6px rgba(176, 38, 255, 0.6))',
          transform: 'translate3d(0,0,0)',
        }}
        draggable={false}
      />
      <img
        ref={cursorRef}
        src="/pngegg.png"
        alt=""
        className={`fixed top-0 left-0 pointer-events-none z-[9999] select-none transition-all duration-150 ease-out ${
          hidden ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          filter: 'drop-shadow(0 0 10px rgba(176, 38, 255, 0.9))',
          transform: 'translate3d(0,0,0)',
        }}
        draggable={false}
      />
    </>
  );
}
