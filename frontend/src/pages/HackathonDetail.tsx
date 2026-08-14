import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hackathonsApi, problemStatementsApi } from '../api/hackathons';
import { Hackathon, ProblemStatement } from '../types';
import { formatError } from '../utils/formatError';
import { isOrganizer } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';

export default function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = isOrganizer(user?.role);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [psTitle, setPsTitle] = useState('');
  const [psDescription, setPsDescription] = useState('');
  const [psFile, setPsFile] = useState<File | null>(null);
  const [psBusy, setPsBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchHackathon = () => {
    hackathonsApi
      .get(Number(id))
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHackathon();
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!psTitle) return;
    setPsBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', psTitle);
      if (psDescription) form.append('description', psDescription);
      if (psFile) form.append('file', psFile);
      await problemStatementsApi.upload(Number(id), form);
      setPsTitle('');
      setPsDescription('');
      setPsFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchHackathon();
    } catch (err: any) {
      setError(formatError(err, 'Failed to upload problem statement'));
    } finally {
      setPsBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading hackathon...</p>
        </div>
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">MISSION NOT FOUND</h2>
          <p className="text-slate-300 mb-4">The hackathon you are looking for does not exist.</p>
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
          <Link to="/hackathons" className="text-neon-cyan hover:text-white text-sm transition">
            ← Back to hackathons
          </Link>
        </div>

        <div className="glass-panel p-6 sm:p-8 mb-8">
          <h1 className="font-pixel text-xl text-white text-shadow-neon mb-3">{hackathon.name}</h1>
          <p className="text-slate-300 mb-6 leading-relaxed">{hackathon.description}</p>

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/hackathons/${id}/teams`}
              className="px-5 py-2.5 rounded neon-btn neon-btn-primary text-xs"
            >
              Manage teams & submissions
            </Link>
            <Link
              to={`/hackathons/${id}/leaderboard`}
              className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        <div className="glass-panel p-6 sm:p-8 mb-8">
          <h2 className="font-pixel text-sm text-white mb-4">PROBLEM STATEMENTS</h2>

          {hackathon.problem_statements?.length === 0 ? (
            <p className="text-slate-400 text-sm mb-6">No problem statements yet.</p>
          ) : (
            <ul className="space-y-4 mb-8">
              {hackathon.problem_statements?.map((ps: ProblemStatement) => (
                <li key={ps.id} className="p-4 rounded bg-black/20 border border-white/10">
                  <p className="font-semibold text-white mb-1">{ps.title}</p>
                  <p className="text-sm text-slate-400 mb-2">{ps.description}</p>
                  {ps.file_path && (
                    <a
                      href={ps.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neon-cyan hover:text-white transition"
                    >
                      View file →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <form onSubmit={handleUpload} className="p-5 rounded bg-black/20 border border-white/10">
              <h3 className="font-pixel text-xs text-white mb-4">UPLOAD NEW STATEMENT</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Title</label>
                  <input
                    value={psTitle}
                    onChange={(e) => setPsTitle(e.target.value)}
                    required
                    className="w-full rounded px-4 py-3 neon-input"
                    placeholder="Problem statement title"
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Description</label>
                  <textarea
                    value={psDescription}
                    onChange={(e) => setPsDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded px-4 py-3 neon-input"
                    placeholder="Detailed description"
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">File (optional)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={(e) => setPsFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={psBusy}
                  className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                >
                  {psBusy ? 'Uploading...' : 'Upload statement'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
