interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export default function LoadingScreen({ message = 'Loading...', className = '' }: LoadingScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative mb-6">
        <svg
          className="w-16 h-16 text-neon-cyan loader-bob drop-shadow-[0_0_12px_rgba(5,217,232,0.5)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 2.25l-7 12.5h4.5L12 21.75l2.5-6.5H19L12 2.25z"
          />
        </svg>
        <div className="absolute -bottom-1 left-1/2 w-5 h-5 rounded-full bg-neon-pink blur-sm loader-flame" />
      </div>

      <div className="w-52 h-2 rounded bg-white/10 overflow-hidden mb-4 border border-white/10">
        <div className="h-full bg-gradient-to-r from-neon-pink via-neon-cyan to-neon-purple loader-progress" />
      </div>

      <p className="font-pixel text-[10px] text-neon-cyan tracking-widest animate-pulse uppercase">
        {message}
      </p>
    </div>
  );
}
