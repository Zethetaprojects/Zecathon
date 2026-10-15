import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { submissionsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement } from '../types';
import { formatError } from '../utils/formatError';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
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
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const canSubmit = can('submit_project') && user?.role !== 'judge';
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
    if (type === 'tech' && !/^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/i.test(url.trim())) {
      setError('Enter the full GitHub repository link, e.g. https://github.com/your-team/your-project. The repository must be public.');
      return;
    }
    if (type === 'non_tech' && !file) {
      setError('Choose your project document to upload.');
      return;
    }
    // One submission per team and problem statement, and it cannot be edited afterwards.
    const ok = await confirm({
      title: 'Submit your project?',
      message: (
        <>
          This is your team's only submission for <span className="text-white">{ps.title}</span>, and it can't be changed
          after you submit. Check that the {type === 'tech' ? 'repository link is correct and public' : 'document is the final version'}.
        </>
      ),
      confirmLabel: 'Submit project',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('team_id', team.id.toString());
      form.append('problem_statement_id', ps.id.toString());
      form.append('type', type);
      if (type === 'tech') {
        form.append('submission_url', url.trim());
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
          <p className="text-slate-300 mb-4">Your role is not allowed to submit projects. Team members submit their own projects; organisers and admins can submit on behalf of a team they manage.</p>
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
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-4">SUBMIT PROJECT</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[
              { k: 'Hackathon', v: hackathon.name, tone: 'text-neon-cyan' },
              { k: 'Team', v: team.name, tone: 'text-white' },
              { k: 'Problem statement', v: ps.title, tone: 'text-white' },
            ].map((item) => (
              <div key={item.k} className="p-3 rounded-lg bg-black/20 border border-white/10 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{item.k}</p>
                <p className={`text-sm font-semibold truncate ${item.tone}`} title={item.v}>
                  {item.v}
                </p>
              </div>
            ))}
          </div>
          {ps.description && (
            <details className="mb-6 rounded-lg bg-black/20 border border-white/10 p-4 text-sm text-slate-300">
              <summary className="cursor-pointer text-xs text-neon-cyan">Re-read the problem statement</summary>
              <p className="mt-3 whitespace-pre-line leading-relaxed">{ps.description}</p>
            </details>
          )}

          {error && (
            <div className="mb-5 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset>
              <legend className="block text-xs pixel-caps text-slate-300 mb-2">What are you submitting?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'tech' as const, title: 'Code project', desc: 'A public GitHub repository. The AI reviews the code, README, and commit history.' },
                  { value: 'non_tech' as const, title: 'Document', desc: 'A report, proposal, or deck (PDF, DOCX, PPTX, XLSX, TXT). An optional GitHub link can support it.' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`p-4 rounded-lg border cursor-pointer transition ${
                      type === option.value ? 'border-neon-cyan bg-neon-cyan/10' : 'border-white/10 bg-black/20 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="submission-type"
                      value={option.value}
                      checked={type === option.value}
                      onChange={() => setType(option.value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-semibold text-white mb-1">{option.title}</span>
                    <span className="block text-xs text-slate-400 leading-relaxed">{option.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {type === 'tech' ? (
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">GitHub repository link</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="https://github.com/your-team/your-project"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">Make sure the repository is public, otherwise it cannot be evaluated.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Project document</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                    className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">PDF, Word, PowerPoint, Excel, or text. Up to 20 MB.</p>
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
              <label className="block text-xs pixel-caps text-slate-300 mb-2">
                Presentation <span className="text-slate-500 normal-case">(optional)</span>
              </label>
              <input
                type="file"
                accept=".ppt,.pptx,.pdf"
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
