import { useLayoutEffect, useRef, useState } from 'react';

interface ExpandableTextProps {
  text: string;
  /** Lines shown while collapsed. */
  lines?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
}

/**
 * Shows the first few lines of a long text with a "read more" toggle. The toggle
 * appears only when the text is actually cut off at the current width (measured,
 * not guessed from the character count), and re-checks when the layout resizes.
 */
export default function ExpandableText({
  text,
  lines = 5,
  className = '',
  moreLabel = 'Read more',
  lessLabel = 'Show less',
}: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, lines, expanded]);

  const clampStyle = expanded
    ? undefined
    : {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical' as const,
        WebkitLineClamp: lines,
        overflow: 'hidden',
      };

  return (
    <div>
      <p ref={ref} className={`whitespace-pre-line ${className}`} style={clampStyle}>
        {text}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-white transition"
        >
          {expanded ? lessLabel : moreLabel}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
