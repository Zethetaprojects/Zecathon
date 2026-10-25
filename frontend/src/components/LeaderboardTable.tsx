import { useMemo, useState } from 'react';
import { LeaderboardEntry } from '../types';

const verdictColor: Record<string, string> = {
  OUTSTANDING: 'text-neon-yellow',
  EXCELLENT: 'text-neon-cyan',
  SATISFACTORY: 'text-neon-purple',
  'NEEDS WORK': 'text-neon-pink',
  'NOT ASSESSABLE': 'text-slate-500',
};

/**
 * Ranked leaderboard with one tab per problem statement (track). Ranks restart
 * within each track; "All tracks" ranks everything together.
 */
export default function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const tracks = useMemo(() => {
    const seen = new Map<number, string>();
    for (const e of entries) if (!seen.has(e.problem_statement_id)) seen.set(e.problem_statement_id, e.problem_statement_title);
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([id, title]) => ({ id, title }));
  }, [entries]);
  const [track, setTrack] = useState<number | 'all'>('all');

  const rows = useMemo(
    () =>
      (track === 'all' ? entries : entries.filter((e) => e.problem_statement_id === track))
        .slice()
        .sort((a, b) => b.total_score - a.total_score),
    [entries, track],
  );

  const tab = (value: number | 'all', label: string, count: number) => (
    <button
      key={String(value)}
      type="button"
      role="tab"
      aria-selected={track === value}
      onClick={() => setTrack(value)}
      className={`px-3 py-1.5 rounded-lg text-xs border transition whitespace-nowrap ${
        track === value
          ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
          : 'border-white/10 text-slate-400 hover:text-white hover:border-white/30'
      }`}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );

  return (
    <div>
      {tracks.length > 1 && (
        <div role="tablist" aria-label="Problem statement tracks" className="flex gap-2 overflow-x-auto pb-3 mb-3">
          {tab('all', 'All tracks', entries.length)}
          {tracks.map((t) => tab(t.id, t.title, entries.filter((e) => e.problem_statement_id === t.id).length))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-xs pixel-caps text-slate-400">
              <th className="py-3 pr-4">Rank</th>
              <th className="py-3 pr-4">Team</th>
              {track === 'all' && <th className="py-3 pr-4">Problem statement</th>}
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Score</th>
              <th className="py-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, idx) => (
              <tr key={entry.submission_id} className="border-b border-white/10 hover:bg-white/5 transition">
                <td className="py-4 pr-4 font-pixel text-neon-cyan text-xs">#{idx + 1}</td>
                <td className="py-4 pr-4 text-white font-semibold">{entry.team_name}</td>
                {track === 'all' && <td className="py-4 pr-4 text-slate-300 text-sm">{entry.problem_statement_title}</td>}
                <td className="py-4 pr-4 text-slate-400 text-sm capitalize">{entry.type.replace('_', '-')}</td>
                <td className="py-4 pr-4 font-semibold text-white">
                  {entry.total_score}
                  {entry.needs_review && (
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30">
                      Review
                    </span>
                  )}
                </td>
                <td className={`py-4 text-sm font-semibold ${verdictColor[entry.verdict] || 'text-slate-300'}`}>{entry.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
