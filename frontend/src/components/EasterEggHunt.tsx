import { useState, useRef, useEffect } from 'react';
import { useEasterEggs } from '../hooks/useEasterEggs';

function EggIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c4.97 0 8-4.03 8-9 0-4.418-3.582-9-8-9S4 7.582 4 12c0 4.97 3.03 9 8 9z" />
      <path d="M12 6c2.5 0 4.5 2.5 4.5 5.5S15 16 12 16" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function EasterEggHunt() {
  const { discovered, count, total, hints, reset, playSound } = useEasterEggs();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!panelRef.current || !target) return;
      if (!panelRef.current.contains(target) && !target.closest('[data-egg-toggle]')) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  const handleReset = () => {
    if (window.confirm('Reset all Easter egg progress?')) {
      reset();
      playSound('powerup');
    }
  };

  const sorted = [...hints].sort((a, b) => {
    const fa = discovered.includes(a.id) ? 1 : 0;
    const fb = discovered.includes(b.id) ? 1 : 0;
    return fb - fa;
  });

  return (
    <>
      {/* Toggle button */}
      <button
        data-egg-toggle
        onClick={() => {
          setOpen((v) => !v);
          playSound('pop');
        }}
        title="Easter Egg Hunt"
        className="relative micro-lift micro-pop w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-neon-pink flex items-center justify-center transition"
      >
        <EggIcon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-neon-pink text-space-900 text-[10px] font-bold border border-space-900">
            {count}
          </span>
        )}
      </button>

      {/* Modal panel */}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          <div className="absolute inset-0 z-0 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-space-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right"
          >
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-pixel text-sm text-white text-shadow-neon">EGG HUNT</h2>
                <p className="text-[10px] text-slate-400 mt-1">
                  {count} of {total} found
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="micro-lift w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition"
                type="button"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all duration-500"
                    style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{Math.round((count / total) * 100)}% complete</span>
                  <span>{total - count} left</span>
                </div>
              </div>

              {/* Grid of eggs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sorted.map((hint) => {
                  const found = discovered.includes(hint.id);
                  return (
                    <div
                      key={hint.id}
                      className={`group flex items-start gap-3 p-4 rounded-xl border transition ${
                        found
                          ? 'bg-neon-cyan/5 border-neon-cyan/20'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                          found ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 text-slate-500'
                        }`}
                      >
                        {found ? <CheckIcon className="w-5 h-5" /> : <LockIcon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold ${found ? 'text-white' : 'text-slate-400'}`}>{hint.name}</p>
                          <span className="text-[10px] text-slate-500">{hint.points} XP</span>
                        </div>
                        <p className={`text-[11px] mt-1 leading-relaxed ${found ? 'text-neon-cyan' : 'text-slate-500'}`}>
                          {hint.hint}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500 text-center">
                Explore the site to unlock the rest. No secret codes needed.
              </p>
            </div>

            {/* Footer */}
            <div className="p-5 sm:p-6 border-t border-white/10">
              <button
                onClick={handleReset}
                type="button"
                className="w-full py-2.5 rounded text-xs text-slate-400 hover:text-neon-pink hover:bg-neon-pink/10 border border-white/10 hover:border-neon-pink/30 transition"
              >
                Reset egg collection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
