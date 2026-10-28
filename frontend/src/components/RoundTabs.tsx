import { HackathonRound } from '../types';

/** Switch between a hackathon's rounds. Renders nothing for single-round hackathons. */
export default function RoundTabs({
  rounds,
  active,
  onChange,
  showUnpublished = false,
}: {
  rounds: HackathonRound[];
  active: number;
  onChange: (round: number) => void;
  showUnpublished?: boolean;
}) {
  const visible = rounds.filter((r) => r.published || showUnpublished);
  if (visible.length < 2) return null;
  return (
    <div role="tablist" aria-label="Rounds" className="flex gap-2 overflow-x-auto pb-1">
      {visible.map((r) => (
        <button
          key={r.number}
          type="button"
          role="tab"
          aria-selected={active === r.number}
          onClick={() => onChange(r.number)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition whitespace-nowrap ${
            active === r.number
              ? 'border-neon-purple bg-neon-purple/15 text-white'
              : 'border-white/10 text-slate-400 hover:text-white hover:border-white/30'
          }`}
        >
          <span className="font-mono opacity-60 mr-1.5">R{r.number}</span>
          {r.name === `Round ${r.number}` ? '' : r.name}
          {!r.published && <span className="ml-1.5 text-[10px] text-neon-yellow">(draft)</span>}
        </button>
      ))}
    </div>
  );
}
