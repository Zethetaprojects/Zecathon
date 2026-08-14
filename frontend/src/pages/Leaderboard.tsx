import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaderboardApi } from '../api/leaderboard';
import { LeaderboardEntry } from '../types';

export default function Leaderboard() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    leaderboardApi
      .get(hackathonId)
      .then((res) => setEntries(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <Link to={`/hackathons/${hackathonId}`} className="text-blue-600 text-sm hover:underline">
            ← Back to hackathon
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        {entries.length === 0 ? (
          <p className="text-gray-600">No evaluated submissions yet. Evaluate projects to see the leaderboard.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">Rank</th>
                <th>Team</th>
                <th>Problem statement</th>
                <th>Type</th>
                <th>Score</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.submission_id} className="border-b">
                  <td className="py-3">{idx + 1}</td>
                  <td>{entry.team_name}</td>
                  <td>{entry.problem_statement_title}</td>
                  <td className="capitalize">{entry.type.replace('_', '-')}</td>
                  <td className="font-semibold">
                    {entry.total_score}
                    {entry.needs_review && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Review</span>
                    )}
                  </td>
                  <td>{entry.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
