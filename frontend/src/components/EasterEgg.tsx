import { useState, useCallback } from 'react';

function playCoinSound() {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(523.25, t);
  osc.frequency.exponentialRampToValueAtTime(1046.5, t + 0.1);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.3);
  ctx.resume().catch(() => {});
  setTimeout(() => ctx.close().catch(() => {}), 400);
}

function ControllerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 11h4M8 9v4M2.5 11.5A4.5 4.5 0 0 0 7 16h10a4.5 4.5 0 0 0 4.5-4.5h0A4.5 4.5 0 0 0 17 7H7a4.5 4.5 0 0 0-4.5 4.5h0Z" />
      <path d="M16 10v.01M18 12v.01" />
    </svg>
  );
}

export default function EasterEgg() {
  const [showToast, setShowToast] = useState(false);

  const handleClick = useCallback(() => {
    playCoinSound();
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2500);
  }, []);

  return (
    <>
      <button
        onClick={handleClick}
        title="?"
        data-cursor-hover
        className="fixed bottom-6 right-6 z-40 w-10 h-10 flex items-center justify-center text-slate-400/40 hover:text-neon-cyan hover:scale-125 transition-all duration-300 opacity-30 hover:opacity-100"
      >
        <ControllerIcon className="w-6 h-6" />
      </button>

      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl glass-panel border border-neon-cyan/30 text-neon-cyan font-pixel text-xs shadow-[0_0_20px_rgba(5,217,232,0.3)] animate-bounce">
          🎮 Hidden controller found! +100 XP
        </div>
      )}
    </>
  );
}
