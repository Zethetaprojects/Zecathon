import { useEasterEggs, EggMode } from '../hooks/useEasterEggs';

function modeClass(mode: EggMode) {
  switch (mode) {
    case 'disco':
      return 'animate-pulse hue-rotate-180 invert saturate-200';
    case 'matrix':
      return 'contrast-125 sepia-[0.6] hue-rotate-90';
    case 'rainbow':
      return 'hue-rotate-[360deg] animate-spin-slow saturate-200';
    default:
      return '';
  }
}

export default function EasterEggOverlay() {
  const { toast, mode, count } = useEasterEggs();

  return (
    <>
      {/* Mode effect overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-[60] transition-all duration-700 ${modeClass(mode)}`}
        aria-hidden="true"
      />

      {/* Disco vignette */}
      {mode === 'disco' && (
        <div className="fixed inset-0 pointer-events-none z-[61] bg-gradient-to-r from-neon-pink/20 via-neon-cyan/20 to-neon-purple/20 mix-blend-overlay animate-pulse" />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-xl glass-panel border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-bounce">
          <span
            className={`font-pixel text-xs ${
              toast.color === 'pink'
                ? 'text-neon-pink'
                : toast.color === 'purple'
                ? 'text-neon-purple'
                : toast.color === 'yellow'
                ? 'text-neon-yellow'
                : 'text-neon-cyan'
            }`}
          >
            {toast.message}
          </span>
        </div>
      )}

      {/* Hidden progress badge */}
      {count > 0 && (
        <div className="fixed bottom-5 left-5 z-[55] pointer-events-none hidden sm:block">
          <div className="px-3 py-1.5 rounded-full glass-panel border border-white/10 text-[10px] font-pixel text-slate-400">
            🥚 {count} found
          </div>
        </div>
      )}
    </>
  );
}
