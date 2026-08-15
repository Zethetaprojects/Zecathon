import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { teamsApi, submissionsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement, Submission, Evaluation } from '../types';
import { formatError } from '../utils/formatError';
import { isJudge, isParticipant, isOrganizer } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';
import EvaluationReport from '../components/EvaluationReport';
import BackButton from '../components/BackButton';

export default function HackathonTeams() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const { user } = useAuth();
  const canEvaluate = isJudge(user?.role);
  const isParticipantUser = isParticipant(user?.role);
  const canManage = isOrganizer(user?.role);
  const canActOnTeams = isParticipantUser || canManage;
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissionsByTeam, setSubmissionsByTeam] = useState<Record<number, Submission[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Record<number, boolean>>({});
  const [evaluating, setEvaluating] = useState<Record<number, boolean>>({});
  const [report, setReport] = useState<Evaluation | null>(null);
  const navigate = useNavigate();

  const fetchHackathon = () => {
    hackathonsApi
      .get(hackathonId)
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')));
  };

  const fetchTeams = () => {
    teamsApi
      .list(hackathonId)
      .then((res) => setTeams(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load teams')))
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
      .catch((err) => setError(formatError(err, 'Failed to load submissions')));
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
      setError(formatError(err, 'Failed to create team'));
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
      setError(formatError(err, 'Failed to join team'));
    }
  };

  const deleteTeam = async (teamId: number) => {
    if (!window.confirm('Delete this team and all its submissions?')) return;
    setDeletingTeam((prev) => ({ ...prev, [teamId]: true }));
    setError('');
    try {
      await teamsApi.delete(teamId);
      fetchTeams();
      fetchHackathon();
    } catch (err: any) {
      setError(formatError(err, 'Failed to delete team'));
    } finally {
      setDeletingTeam((prev) => ({ ...prev, [teamId]: false }));
    }
  };

  const submitFor = (teamId: number, ps: ProblemStatement) => {
    navigate(`/hackathons/${hackathonId}/submit/${teamId}/${ps.id}`);
  };

  const evaluate = async (submission: Submission, retry = false) => {
    setEvaluating((prev) => ({ ...prev, [submission.id]: true }));
    setError('');
    try {
      if (submission.type === 'tech') {
        retry ? await submissionsApi.retryTech(submission.id) : await submissionsApi.evaluateTech(submission.id);
      } else {
        retry ? await submissionsApi.retryNonTech(submission.id) : await submissionsApi.evaluateNonTech(submission.id);
      }
      fetchSubmissions(teams);
    } catch (err: any) {
      setError(formatError(err, retry ? 'Retry failed' : 'Evaluation failed'));
    } finally {
      setEvaluating((prev) => ({ ...prev, [submission.id]: false }));
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading teams...</p>
        </div>
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">MISSION NOT FOUND</h2>
          <Link to="/hackathons" className="text-neon-cyan hover:text-white text-sm">
            ← Back to hackathons
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to={`/hackathons/${hackathonId}`} label="Back to hackathon" />
        </div>

        <div className="glass-panel p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
            <h1 className="font-pixel text-xl text-white text-shadow-neon">{hackathon.name}</h1>
            <Link
              to={`/hackathons/${hackathonId}/leaderboard`}
              className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs"
            >
              Leaderboard
            </Link>
          </div>
          <p className="text-slate-400 text-sm">Teams & submissions</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {report && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setReport(null);
            }}
          >
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-panel p-6 sm:p-8 border border-neon-cyan/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-pixel text-lg text-white text-shadow-neon">EVALUATION REPORT</h2>
                <button
                  onClick={() => setReport(null)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white border border-white/10 hover:border-neon-cyan transition"
                >
                  Close
                </button>
              </div>
              <EvaluationReport evaluation={report} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {teams.length === 0 ? (
              <div className="glass-panel p-8 text-center">
                <p className="text-slate-300">No teams yet. Create the first team to start.</p>
              </div>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="glass-panel p-6">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <h2 className="font-pixel text-xs text-white mb-2">{team.name}</h2>
                      <p className="text-xs text-slate-400">
                        Members: {team.members?.map((m) => `${m.username} (${m.role})`).join(', ') || 'none'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isParticipantUser && (
                        <button
                          onClick={() => joinTeam(team.id)}
                          className="px-3 py-1.5 rounded neon-btn neon-btn-ghost text-xs"
                        >
                          Join
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => deleteTeam(team.id)}
                          disabled={deletingTeam[team.id]}
                          className="px-3 py-1.5 rounded text-xs text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/10 transition disabled:opacity-50"
                        >
                          {deletingTeam[team.id] ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {hackathon.problem_statements?.map((ps) => {
                      const sub = submissionsByTeam[team.id]?.find((s) => s.problem_statement_id === ps.id);
                      return (
                        <div
                          key={ps.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-black/20 border border-white/10"
                        >
                          <span className="text-sm text-slate-300">{ps.title}</span>
                          <div className="flex items-center gap-3">
                            {sub ? (
                              <>
                                <span className="text-xs text-slate-400 capitalize">
                                  {sub.status.replace('_', '-')}
                                </span>
                                {sub.evaluation ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => setReport(sub.evaluation || null)}
                                      className="text-sm font-semibold text-neon-cyan hover:text-white transition micro-lift"
                                    >
                                      {sub.evaluation.total_score} pts — {sub.evaluation.verdict}
                                    </button>
                                    {canManage && (
                                      <Link
                                        to={`/reports/submission/${sub.id}`}
                                        className="text-[10px] px-2 py-1 rounded border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 transition"
                                      >
                                        View report
                                      </Link>
                                    )}
                                    {canEvaluate && (
                                      <button
                                        onClick={() => evaluate(sub, true)}
                                        disabled={evaluating[sub.id]}
                                        className="px-2 py-1 rounded border border-white/10 text-[10px] text-slate-400 hover:text-neon-pink hover:border-neon-pink/50 transition disabled:opacity-50"
                                      >
                                        {evaluating[sub.id] ? '...' : 'Retry'}
                                      </button>
                                    )}
                                  </div>
                                ) : canEvaluate ? (
                                  <button
                                    onClick={() => evaluate(sub)}
                                    disabled={evaluating[sub.id]}
                                    className="px-3 py-1.5 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                                  >
                                    {evaluating[sub.id] ? 'Evaluating...' : 'Evaluate'}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">Pending evaluation</span>
                                )}
                              </>
                            ) : (
                              canActOnTeams && (
                                <button
                                  onClick={() => submitFor(team.id, ps)}
                                  className="px-3 py-1.5 rounded neon-btn neon-btn-cyan text-xs"
                                >
                                  Submit
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!hackathon.problem_statements?.length && (
                      <p className="text-xs text-slate-500">Upload problem statements to enable submissions.</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {canActOnTeams && (
            <div className="glass-panel p-6 h-fit">
              <h3 className="font-pixel text-xs text-white mb-4">CREATE TEAM</h3>
              <form onSubmit={createTeam} className="space-y-4">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name"
                  required
                  className="w-full rounded px-4 py-3 neon-input"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded neon-btn neon-btn-primary py-3 text-xs disabled:opacity-50"
                >
                  {busy ? 'Creating...' : 'Create team'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
