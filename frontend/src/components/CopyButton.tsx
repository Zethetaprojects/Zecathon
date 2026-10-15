import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/** Copies `text` and shows "Copied!" (or a hint to copy manually if the browser refuses). */
export default function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1800 : 4000);
  };

  const text_ = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Select & copy manually' : label;
  const tone =
    state === 'copied'
      ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
      : state === 'failed'
        ? 'border-neon-yellow/60 text-neon-yellow'
        : 'border-white/15 text-slate-300 hover:text-neon-cyan hover:border-neon-cyan/60';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] transition ${tone} ${className}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        {state === 'copied' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        )}
      </svg>
      {text_}
    </button>
  );
}
