import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { teamsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement } from '../types';

export default function HackathonTeams() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const fetch = () => {
    hackathonsApi
      .get(hackathonId)
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load hackathon'));
    teamsApi
      .list(hackathonId)
      .then((res) => setTeams(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load teams'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch();
  }, [hackathonId]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;
    setBusy(true);
    setError('');
    try {
      await teamsApi.create(hackathonId, teamName);
      setTeamName('');
      fetch();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create team');
    } finally {
      setBusy(false);
    }
  };

  const joinTeam = async (teamId: number) => {
    setError('');
    try {
      await teamsApi.join(teamId);
      fetch();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join team');
    }
  };

  const submitFor = (teamId: number, ps: ProblemStatement) => {
    navigate(`/hackathons/${hackathonId}/submit/${teamId}/${ps.id}`);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!hackathon) return <div className="p-8">Hackathon not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <Link to={`/hackathons/${hackathonId}`} className="text-blue-600 text-sm hover:underline">
            ← Back to hackathon
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">{hackathon.name}</h1>
        <p className="text-gray-700 mb-6">Teams & submissions</p>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Teams</h2>
          {teams.length === 0 ? (
            <p className="text-gray-600 text-sm">No teams yet. Create one below.</p>
          ) : (
            <ul className="divide-y mb-4">
              {teams.map((team) => (
                <li key={team.id} className="py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg">{team.name}</p>
                      <p className="text-sm text-gray-600">
                        Members: {team.members?.map((m) => `${m.username} (${m.role})`).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => joinTeam(team.id)}
                      className="text-sm border border-blue-600 text-blue-600 px-3 py-1 rounded hover:bg-blue-50"
                    >
                      Join
                    </button>
                  </div>
                  {hackathon.problem_statements?.map((ps) => (
                    <button
                      key={ps.id}
                      onClick={() => submitFor(team.id, ps)}
                      className="mt-2 mr-2 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Submit for {ps.title}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createTeam} className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold mb-3">Create a new team</h3>
            <div className="flex gap-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              />
              <button
                type="submit"
                disabled={busy}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
