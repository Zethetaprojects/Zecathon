import { Hackathon } from '../types';

function resolveUrl(path: string) {
  return path.startsWith('http') || path.startsWith('/') ? path : `/uploads/${path.split('/').pop()}`;
}

/** "In partnership with <logo> IIT Patna" for partner hackathons; renders nothing otherwise. */
export default function PartnerBadge({
  hackathon,
  size = 'sm',
}: {
  hackathon: Pick<Hackathon, 'partner_name' | 'partner_logo_path'>;
  size?: 'sm' | 'lg';
}) {
  if (!hackathon.partner_name) return null;
  const logo = hackathon.partner_logo_path ? resolveUrl(hackathon.partner_logo_path) : null;
  const initials = hackathon.partner_name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  if (size === 'lg') {
    return (
      <div className="flex items-center gap-4">
        <span className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-neon-cyan">
          {logo ? (
            <img src={logo} alt={`${hackathon.partner_name} logo`} className="w-full h-full object-contain p-1.5" />
          ) : (
            <span className="font-pixel text-sm text-space-900">{initials}</span>
          )}
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neon-cyan">In partnership with</p>
          <p className="text-lg sm:text-xl font-semibold text-white leading-snug">{hackathon.partner_name}</p>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-saturate-150">
      <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center overflow-hidden">
        {logo ? (
          <img src={logo} alt="" className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="text-[9px] font-bold text-space-900">{initials}</span>
        )}
      </span>
      <span className="text-[11px] text-white">
        <span className="text-slate-300">with </span>
        {hackathon.partner_name}
      </span>
    </span>
  );
}
