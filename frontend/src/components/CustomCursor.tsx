import { useEffect, useRef, useState } from 'react';

const CURSOR_SIZE = 32;

export default function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const cursorRef = useRef<HTMLImageElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const hoverRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.body.classList.add('custom-cursor-active');
    setVisible(true);

    const updateTransform = () => {
      const { x, y } = posRef.current;
      const hovering = hoverRef.current > 0;
      const scale = hovering ? 1.25 : 1;
      cursorRef.current?.style.setProperty(
        'transform',
        `translate3d(${x}px, ${y}px, 0) translate(-${CURSOR_SIZE / 2}px, -${CURSOR_SIZE / 2}px) scale(${scale})`
      );
    };

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      updateTransform();
    };

    const isInteractive = (target: HTMLElement) =>
      target.closest('a, button, [role="button"], input, textarea, select, [data-cursor-hover], [data-egg-toggle]') !== null;

    const onOver = (e: MouseEvent) => {
      if (isInteractive(e.target as HTMLElement)) {
        hoverRef.current += 1;
        updateTransform();
      }
    };

    const onOut = (e: MouseEvent) => {
      if (isInteractive(e.target as HTMLElement)) {
        hoverRef.current = Math.max(0, hoverRef.current - 1);
        updateTransform();
      }
    };

    const onDown = () => {
      const { x, y } = posRef.current;
      cursorRef.current?.style.setProperty(
        'transform',
        `translate3d(${x}px, ${y}px, 0) translate(-${CURSOR_SIZE / 2}px, -${CURSOR_SIZE / 2}px) scale(0.9)`
      );
    };

    const onUp = () => {
      updateTransform();
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

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
    };
  }, []);

  if (!visible) return null;

  return (
    <img
      ref={cursorRef}
      src="/pngegg.png"
      alt=""
      className="fixed top-0 left-0 pointer-events-none z-[9999] select-none will-change-transform"
      style={{
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        filter: 'drop-shadow(0 0 4px rgba(176, 38, 255, 0.7))',
        transform: 'translate3d(0,0,0)',
      }}
      draggable={false}
    />
  );
}
