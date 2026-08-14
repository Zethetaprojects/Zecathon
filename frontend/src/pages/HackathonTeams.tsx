import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { teamsApi } from '../api/teams';
import { submissionsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement, Submission } from '../types';

export default function HackathonTeams() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissionsByTeam, setSubmissionsByTeam] = useState<Record<number, Submission[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [evaluating, setEvaluating] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  const fetchHackathon = () => {
    hackathonsApi
      .get(hackathonId)
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load hackathon'));
  };

  const fetchTeams = () => {
    teamsApi
      .list(hackathonId)
      .then((res) => setTeams(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load teams'))
      .finally(() => setLoading(false));
  };

  const fetchSubmissions = (currentTeams: Team[]) => {
    if (currentTeams.length === 0) return;
    Promise.all(currentTeams.map((t) => submissionsApi.listByTeam(t.id)))
      .then((results) => {
        const map: Record<number, Submission[]> = {};
        results.forEach((res, i) => {
          map[currentTeams[i].id] = res.data;
        });
        setSubmissionsByTeam(map);
      })
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load submissions'));
  };

  useEffect(() => {
    fetchHackathon();
    fetchTeams();
  }, [hackathonId]);

  useEffect(() => {
    fetchSubmissions(teams);
  }, [teams]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;
    setBusy(true);
    setError('');
    try {
      await teamsApi.create(hackathonId, teamName);
      setTeamName('');
      fetchTeams();
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
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join team');
    }
  };

  const submitFor = (teamId: number, ps: ProblemStatement) => {
    navigate(`/hackathons/${hackathonId}/submit/${teamId}/${ps.id}`);
  };

  const evaluate = async (submission: Submission) => {
    setEvaluating({ ...evaluating, [submission.id]: true });
    setError('');
    try {
      if (submission.type === 'tech') {
        await submissionsApi.evaluateTech(submission.id);
      } else {
        await submissionsApi.evaluateNonTech(submission.id);
      }
      fetchSubmissions(teams);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Evaluation failed');
    } finally {
      setEvaluating({ ...evaluating, [submission.id]: false });
    }
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
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">{hackathon.name}</h1>
          <Link
            to={`/hackathons/${hackathonId}/leaderboard`}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Leaderboard
          </Link>
        </div>
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
                  <div className="mt-3 space-y-2">
                    {hackathon.problem_statements?.map((ps) => {
                      const sub = submissionsByTeam[team.id]?.find((s) => s.problem_statement_id === ps.id);
                      return (
                        <div key={ps.id} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">{ps.title}:</span>
                          {sub ? (
                            <>
                              <span className="capitalize">{sub.status.replace('_', '-')}</span>
                              {sub.evaluation ? (
                                <span className="font-semibold text-blue-700">
                                  {sub.evaluation.total_score} — {sub.evaluation.verdict}
                                </span>
                              ) : (
                                <button
                                  onClick={() => evaluate(sub)}
                                  disabled={evaluating[sub.id]}
                                  className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                                >
                                  {evaluating[sub.id] ? 'Evaluating...' : 'Evaluate'}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => submitFor(team.id, ps)}
                              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                            >
                              Submit
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
