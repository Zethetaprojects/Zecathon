import { useState } from 'react';
import { useEasterEggs } from '../hooks/useEasterEggs';

function MascotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="12" y="14" width="40" height="44" rx="14" className="fill-neon-purple" />
      <rect x="12" y="14" width="40" height="44" rx="14" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      {/* Screen/face */}
      <rect x="18" y="24" width="28" height="18" rx="6" fill="#0b0f27" />
      {/* Eyes */}
      <circle cx="26" cy="33" r="4" fill="#05d9e8" className="animate-pulse-glow" />
      <circle cx="38" cy="33" r="4" fill="#05d9e8" className="animate-pulse-glow" />
      <circle cx="27" cy="31" r="1.5" fill="white" />
      <circle cx="39" cy="31" r="1.5" fill="white" />
      {/* Mouth */}
      <path d="M28 46c2 2 6 2 8 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Antenna */}
      <line x1="32" y1="14" x2="32" y2="6" stroke="#ff2a6d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill="#ff2a6d" className="animate-pulse-glow" />
    </svg>
  );
}

export default function EggMascot() {
  const { discover, playSound } = useEasterEggs();
  const [bop, setBop] = useState(false);
  const [wobble, setWobble] = useState(false);

  const handleClick = () => {
    discover('mascot-click', 'Mascot friend! +100 XP', 'purple');
    playSound('magic');
    setBop(true);
    setWobble(true);
    window.setTimeout(() => setBop(false), 200);
    window.setTimeout(() => setWobble(false), 500);
  };

  return (
    <button
      onClick={handleClick}
      title="Z-bot is watching"
      className={`fixed bottom-24 right-5 z-40 w-12 h-12 rounded-full bg-space-900/80 border border-neon-purple/30 shadow-[0_0_20px_rgba(176,38,255,0.25)] flex items-center justify-center transition-transform hover:scale-110 hover:rotate-3 ${
        wobble ? 'animate-wobble' : 'animate-bob-slow'
      }`}
      data-cursor-hover
    >
      <MascotIcon className={`w-10 h-10 ${bop ? 'scale-125' : ''} transition-transform`} />
    </button>
  );
}
