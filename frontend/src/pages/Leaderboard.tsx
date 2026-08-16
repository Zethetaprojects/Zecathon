import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaderboardApi } from '../api/leaderboard';
import { LeaderboardEntry } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

const verdictColor: Record<string, string> = {
  OUTSTANDING: 'text-neon-yellow',
  EXCELLENT: 'text-neon-cyan',
  SATISFACTORY: 'text-neon-purple',
  'NEEDS WORK': 'text-neon-pink',
  'NOT ASSESSABLE': 'text-slate-500',
};

export default function Leaderboard() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    leaderboardApi
      .get(hackathonId)
      .then((res) => setEntries(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load leaderboard')))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  const copyShareLink = async () => {
    const url = `${window.location.origin}/public/leaderboard/${hackathonId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy share link.');
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <BackButton to={`/hackathons/${hackathonId}`} label="Back to hackathon" />
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="font-pixel text-xl text-white text-shadow-neon mb-2">LEADERBOARD</h1>
              <p className="text-slate-400 text-sm">Ranked by total score — no ties, all discrete.</p>
            </div>
            <button
              onClick={copyShareLink}
              className="px-4 py-2 rounded neon-btn neon-btn-ghost text-xs micro-lift micro-pop"
            >
              {copied ? 'Link copied!' : 'Copy share link'}
            </button>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16">
              <LoadingScreen message="Loading leaderboard..." />
            </div>
          ) : entries.length === 0 ? (
            <div
              className="text-center py-12 cursor-pointer"
              data-egg-trigger="empty-state"
              data-egg-message="Still hopeful! +25 XP"
              data-egg-color="pink"
            >
              <p className="text-slate-300 mb-4">No evaluated submissions yet.</p>
              <Link
                to={`/hackathons/${hackathonId}/teams`}
                className="px-5 py-2 rounded neon-btn neon-btn-cyan text-xs"
              >
                Evaluate projects
              </Link>
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
