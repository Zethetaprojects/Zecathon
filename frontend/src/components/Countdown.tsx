import { useEffect, useState } from 'react';

interface CountdownProps {
  targetDate: string | undefined;
  fallback?: React.ReactNode;
  className?: string;
  label?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function formatTimeRemaining(target: Date) {
  const now = new Date().getTime();
  const distance = target.getTime() - now;
  if (distance <= 0) return null;
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, distance };
}

export default function Countdown({ targetDate, fallback, className = '', label }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => {
    if (!targetDate) return null;
    return formatTimeRemaining(new Date(targetDate));
  });

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate);
    const tick = () => setRemaining(formatTimeRemaining(target));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!remaining) {
    return <span className={className}>{fallback || '—'}</span>;
  }

  const { days, hours, minutes, seconds } = remaining;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${pad(hours)}h`);
  parts.push(`${pad(minutes)}m`);
  parts.push(`${pad(seconds)}s`);

  return (
    <span className={className}>
      {label ? <span className="opacity-70 mr-1">{label}</span> : null}
      {parts.join(' ')}
    </span>
  );
}
