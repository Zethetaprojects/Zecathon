import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaderboardApi } from '../api/leaderboard';
import { LeaderboardEntry } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';

const verdictColor: Record<string, string> = {
  OUTSTANDING: 'text-neon-yellow',
  EXCELLENT: 'text-neon-cyan',
  SATISFACTORY: 'text-neon-purple',
  'NEEDS WORK': 'text-neon-pink',
  'NOT ASSESSABLE': 'text-slate-500',
};

export default function PublicLeaderboard() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    leaderboardApi
      .getPublic(hackathonId)
      .then((res) => setEntries(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load leaderboard')))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-neon-cyan hover:text-white text-sm transition">
            ← Back to ZECATHON
          </Link>
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="font-pixel text-xl text-white text-shadow-neon mb-2">PUBLIC LEADERBOARD</h1>
              <p className="text-slate-400 text-sm">Ranked by total score — no ties, all discrete.</p>
            </div>
            <span className="px-3 py-1.5 rounded text-xs bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 uppercase tracking-wider">
              Public share link
            </span>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading leaderboard...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-300 mb-4">No evaluated submissions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs pixel-caps text-slate-400">
                    <th className="py-3 pr-4">Rank</th>
                    <th className="py-3 pr-4">Team</th>
                    <th className="py-3 pr-4">Problem statement</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Score</th>
                    <th className="py-3">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={entry.submission_id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className="py-4 pr-4 font-pixel text-neon-cyan text-xs">#{idx + 1}</td>
                      <td className="py-4 pr-4 text-white font-semibold">{entry.team_name}</td>
                      <td className="py-4 pr-4 text-slate-300 text-sm">{entry.problem_statement_title}</td>
                      <td className="py-4 pr-4 text-slate-400 text-sm capitalize">
                        {entry.type.replace('_', '-')}
                      </td>
                      <td className="py-4 pr-4 font-semibold text-white">
                        {entry.total_score}
                        {entry.needs_review && (
                          <span className="ml-2 text-xs px-2 py-1 rounded bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30">
                            Review
                          </span>
                        )}
                      </td>
                      <td className={`py-4 text-sm font-semibold ${verdictColor[entry.verdict] || 'text-slate-300'}`}>
                        {entry.verdict}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
