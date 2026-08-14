import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { submissionsApi } from '../api/teams';
import { Hackathon, Team, ProblemStatement } from '../types';

export default function Submit() {
  const { hackathonId, teamId, problemStatementId } = useParams<{
    hackathonId: string;
    teamId: string;
    problemStatementId: string;
  }>();
  const navigate = useNavigate();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [ps, setPs] = useState<ProblemStatement | null>(null);
  const [type, setType] = useState<'tech' | 'non_tech'>('tech');
  const [url, setUrl] = useState('');
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
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load hackathon'))
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
      }
      if (ppt) form.append('ppt_file', ppt);
      await submissionsApi.create(form);
      navigate(`/hackathons/${hackathonId}/teams`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!hackathon || !team || !ps) return <div className="p-8">Invalid submission route</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <Link to={`/hackathons/${hackathonId}/teams`} className="text-blue-600 text-sm hover:underline">
            ← Back to teams
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-2">Submit project</h1>
        <p className="text-gray-600 mb-6">
          Team: <span className="font-semibold">{team.name}</span> | Problem statement:{' '}
          <span className="font-semibold">{ps.title}</span>
        </p>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Submission type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'tech' | 'non_tech')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="tech">Tech (GitHub repository)</option>
              <option value="non_tech">Non-tech (document)</option>
            </select>
          </div>

          {type === 'tech' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">GitHub URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">Project document</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                className="mt-1 block w-full text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Optional PPT</label>
            <input
              type="file"
              onChange={(e) => setPpt(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Submitting...' : 'Submit project'}
          </button>
        </form>
      </div>
    </div>
  );
}
