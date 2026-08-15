import { Link } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  label?: string;
  onClick?: () => void;
}

export default function BackButton({ to, label = 'Back', onClick }: BackButtonProps) {
  const className =
    'inline-flex items-center gap-1 text-neon-cyan hover:text-white text-sm transition';
  const content = (
    <>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
