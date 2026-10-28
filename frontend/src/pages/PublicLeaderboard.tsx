import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaderboardApi } from '../api/leaderboard';
import { HackathonRound, LeaderboardEntry } from '../types';
import { roundsApi } from '../api/rounds';
import RoundTabs from '../components/RoundTabs';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';
import LeaderboardTable from '../components/LeaderboardTable';


export default function PublicLeaderboard() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rounds, setRounds] = useState<HackathonRound[]>([]);
  // Undefined until the first load: the server then picks the latest scored round.
  const [round, setRound] = useState<number | undefined>(undefined);

  useEffect(() => {
    roundsApi
      .publicList(hackathonId)
      .then((res) => setRounds(res.data))
      .catch(() => setRounds([]));
  }, [hackathonId]);

  useEffect(() => {
    setLoading(true);
    leaderboardApi
      .getPublic(hackathonId, round)
      .then((res) => {
        setEntries(res.data);
        if (round === undefined) setRound(res.data[0]?.round_number ?? 1);
      })
      .catch((err) => setError(formatError(err, 'Failed to load leaderboard')))
      .finally(() => setLoading(false));
  }, [hackathonId, round]);

  const activeRound = rounds.find((r) => r.number === round);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-neon-cyan hover:text-white text-sm transition">
            ← Back to ZECKATHON
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

          {rounds.length > 1 && round !== undefined && (
            <div className="mb-5">
              <RoundTabs rounds={rounds} active={round} onChange={setRound} />
              {activeRound && activeRound.judge_weight > 0 && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {activeRound.judge_weight === 100
                    ? "This round is scored by the judges' marks."
                    : `This round's score is ${100 - activeRound.judge_weight}% AI evaluation and ${activeRound.judge_weight}% judges' marks.`}
                </p>
              )}
            </div>
          )}

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
            </div>
          ) : (
            <LeaderboardTable entries={entries} />
          )}
        </div>
      </div>
    </PageLayout>
  );
}
