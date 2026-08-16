import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { submissionsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement } from '../types';
import { formatError } from '../utils/formatError';
import { isParticipant, isOrganizer } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

export default function Submit() {
  const { hackathonId, teamId, problemStatementId } = useParams<{
    hackathonId: string;
    teamId: string;
    problemStatementId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isParticipantUser = isParticipant(user?.role);
  const canSubmit = isParticipantUser || isOrganizer(user?.role);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [ps, setPs] = useState<ProblemStatement | null>(null);
  const [type, setType] = useState<'tech' | 'non_tech'>('tech');
  const [url, setUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [ppt, setPpt] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hackathonsApi
      .get(Number(hackathonId))
      .then((res) => {
        setHackathon(res.data);
        const t = res.data.teams?.find((x) => x.id === Number(teamId));
        setTeam(t || null);
        const p = res.data.problem_statements?.find((x) => x.id === Number(problemStatementId));
        setPs(p || null);
      })
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')))
      .finally(() => setLoading(false));
  }, [hackathonId, teamId, problemStatementId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!team || !ps) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('team_id', team.id.toString());
      form.append('problem_statement_id', ps.id.toString());
      form.append('type', type);
      if (type === 'tech') {
        form.append('submission_url', url);
      } else if (file) {
        form.append('submission_file', file);
        if (githubUrl.trim()) form.append('github_url', githubUrl.trim());
      }
      if (ppt) form.append('ppt_file', ppt);
      await submissionsApi.create(form);
      navigate(`/hackathons/${hackathonId}/teams`);
    } catch (err: any) {
      setError(formatError(err, 'Submission failed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading mission..." />
      </PageLayout>
    );
  }

  if (!hackathon || !team || !ps) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-3xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">INVALID MISSION</h2>
          <p className="text-slate-300 mb-4">The team or problem statement could not be found.</p>
          <Link to="/hackathons" className="text-neon-cyan hover:text-white text-sm">
            ← Back to hackathons
          </Link>
        </div>
      </PageLayout>
    );
  }

  if (!canSubmit) {
    return (
      <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">NOT ALLOWED</h2>
          <p className="text-slate-300 mb-4">Only participants can submit their own projects. Organisers and admins can submit on behalf of a team they manage.</p>
          <Link to={`/hackathons/${hackathonId}/teams`} className="text-neon-cyan hover:text-white text-sm">
            ← Back to teams
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <BackButton to={`/hackathons/${hackathonId}/teams`} label="Back to teams" />
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">SUBMIT PROJECT</h1>
          <div className="text-slate-400 text-sm mb-6 space-y-1">
            <p>
              Hackathon: <span className="text-neon-cyan">{hackathon.name}</span>
            </p>
            <p>
              Team: <span className="text-white">{team.name}</span>
            </p>
            <p>
              Problem statement: <span className="text-white">{ps.title}</span>
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Submission type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'tech' | 'non_tech')}
                className="w-full rounded px-4 py-3 neon-input"
              >
                <option value="tech">Tech — GitHub repository</option>
                <option value="non_tech">Non-tech — document / PDF / PPT / xlsx</option>
              </select>
            </div>

            {type === 'tech' ? (
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">GitHub URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="https://github.com/owner/repo"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Project document</label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                    className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">
                    Supporting GitHub URL <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full rounded px-4 py-3 neon-input"
                    placeholder="https://github.com/owner/repo"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Optional PPT</label>
              <input
                type="file"
                onChange={(e) => setPpt(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-purple/20 file:text-neon-purple file:cursor-pointer"
              />
            </div>

            <div className="pt-2 flex gap-4">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded neon-btn neon-btn-primary py-3 text-sm disabled:opacity-50"
              >
                {busy ? 'Submitting...' : 'Submit project'}
              </button>
              <Link
                to={`/hackathons/${hackathonId}/teams`}
                className="px-6 py-3 rounded neon-btn neon-btn-ghost text-sm"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
