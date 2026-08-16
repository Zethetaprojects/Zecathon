import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hackathonsApi, problemStatementsApi } from '../api/hackathons';
import { Hackathon, ProblemStatement } from '../types';
import { formatError } from '../utils/formatError';
import { isOrganizer } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import { getHackathonStatus, formatHackathonDateRange, getCountdownTarget } from '../utils/hackathon';
import Countdown from '../components/Countdown';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';

const statusStyles = {
  upcoming: 'bg-neon-purple/10 text-neon-purple border-neon-purple/20',
  open: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  ended: 'bg-neon-pink/10 text-neon-pink border-neon-pink/20',
};

function resolveBannerUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/${path.split('/').pop()}`;
}

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
  const [editingRubric, setEditingRubric] = useState(false);
  const [techRubric, setTechRubric] = useState('');
  const [nonTechRubric, setNonTechRubric] = useState('');
  const [rubricBusy, setRubricBusy] = useState(false);
  const [rubricError, setRubricError] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (hackathon?.rubric) {
      setTechRubric(
        hackathon.rubric.tech ? JSON.stringify(hackathon.rubric.tech, null, 2) : ''
      );
      setNonTechRubric(
        hackathon.rubric.non_tech ? JSON.stringify(hackathon.rubric.non_tech, null, 2) : ''
      );
    }
  }, [hackathon?.rubric]);

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

  const parseRubricJson = (value: string): Record<string, number> | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
      for (const key of Object.keys(parsed)) {
        if (typeof parsed[key] !== 'number') return null;
      }
      return parsed as Record<string, number>;
    } catch {
      return null;
    }
  };

  const handleUpdateRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    setRubricError('');
    const tech = parseRubricJson(techRubric);
    const nonTech = parseRubricJson(nonTechRubric);

    if ((techRubric.trim() && tech === null) || (nonTechRubric.trim() && nonTech === null)) {
      setRubricError('Rubric JSON must be an object mapping category names to numeric scores.');
      return;
    }

    setRubricBusy(true);
    setError('');
    try {
      const payload: any = {};
      if (tech || nonTech) {
        payload.rubric = {};
        if (tech) payload.rubric.tech = tech;
        if (nonTech) payload.rubric.non_tech = nonTech;
      }
      await hackathonsApi.update(Number(id), payload);
      setEditingRubric(false);
      fetchHackathon();
    } catch (err: any) {
      setRubricError(formatError(err, 'Failed to update rubric'));
    } finally {
      setRubricBusy(false);
    }
  };

  const handleBannerUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerFile) return;
    setBannerBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', bannerFile);
      await hackathonsApi.uploadBanner(Number(id), form);
      setBannerFile(null);
      if (bannerRef.current) bannerRef.current.value = '';
      fetchHackathon();
    } catch (err: any) {
      setError(formatError(err, 'Failed to upload banner'));
    } finally {
      setBannerBusy(false);
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
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>
      </PageLayout>
    );
  }

  const status = getHackathonStatus(hackathon.start_date, hackathon.end_date);
  const { target, label } = getCountdownTarget(hackathon.start_date, hackathon.end_date);
  const bannerUrl = resolveBannerUrl(hackathon.banner_path);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>

        {/* Banner + hero */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-space-900 to-slate-900 mb-6">
          <div className="relative h-40 sm:h-56">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`${hackathon.name} banner`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-space-900/90 via-space-900/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded text-[10px] border uppercase tracking-wider ${statusStyles[status.status]}`}>
                  {status.label}
                </span>
                {status.status !== 'ended' && target && (
                  <span className="font-mono text-xs text-white">
                    <Countdown targetDate={target} label={label} />
                  </span>
                )}
              </div>
              <h1 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-2">{hackathon.name}</h1>
              <p className="text-slate-300 text-sm max-w-2xl">{hackathon.description}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
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
          {canManage && (
            <Link
              to={`/hackathons/${id}/edit`}
              className="px-5 py-2.5 rounded neon-btn neon-btn-ghost text-xs"
            >
              Edit hackathon
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        <div className="glass-panel p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-pixel text-sm text-white">SCHEDULE</h2>
            <p className="text-xs text-slate-400">{formatHackathonDateRange(hackathon.start_date, hackathon.end_date)}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-black/20 border border-white/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm font-semibold text-white">{status.label}</p>
            </div>
            <div className="p-4 rounded bg-black/20 border border-white/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Duration</p>
              <p className="text-sm font-semibold text-white">{hackathon.duration_hours ? `${hackathon.duration_hours} hours` : 'Not set'}</p>
            </div>
            <div className="p-4 rounded bg-black/20 border border-white/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Countdown</p>
              <p className="text-sm font-semibold text-neon-cyan font-mono">
                {status.status === 'ended' ? 'Ended' : <Countdown targetDate={target} label={label} />}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="glass-panel p-6 sm:p-8 mb-8">
            <h2 className="font-pixel text-sm text-white mb-4">BANNER</h2>
            <form onSubmit={handleBannerUpload} className="flex flex-col sm:flex-row gap-4 items-start">
              <input
                ref={bannerRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
              />
              <button
                type="submit"
                disabled={bannerBusy || !bannerFile}
                className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
              >
                {bannerBusy ? 'Uploading...' : 'Upload banner'}
              </button>
            </form>
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
                      href={
                        ps.file_path.startsWith('http') || ps.file_path.startsWith('/')
                          ? ps.file_path
                          : `/uploads/${ps.file_path.replace(/\\/g, '/').split('/').pop()}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neon-cyan hover:text-white transition inline-flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
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

        {canManage && (
          <div className="glass-panel p-6 sm:p-8 mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-pixel text-sm text-white">CUSTOM RUBRIC</h2>
              <button
                type="button"
                onClick={() => setEditingRubric((prev) => !prev)}
                className="px-3 py-1.5 rounded text-xs neon-btn neon-btn-ghost"
              >
                {editingRubric ? 'Cancel' : 'Edit rubric'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Override default scoring categories for tech and non-tech submissions.
            </p>

            {editingRubric ? (
              <form onSubmit={handleUpdateRubric} className="space-y-4">
                {rubricError && (
                  <div className="px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
                    {rubricError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs pixel-caps text-slate-300 mb-2">
                      Tech rubric <span className="text-slate-500 normal-case">JSON</span>
                    </label>
                    <textarea
                      value={techRubric}
                      onChange={(e) => setTechRubric(e.target.value)}
                      rows={5}
                      className="w-full rounded px-4 py-3 neon-input font-mono text-xs"
                      placeholder='{"Problem Understanding": 150, ...}'
                    />
                  </div>
                  <div>
                    <label className="block text-xs pixel-caps text-slate-300 mb-2">
                      Non-tech rubric <span className="text-slate-500 normal-case">JSON</span>
                    </label>
                    <textarea
                      value={nonTechRubric}
                      onChange={(e) => setNonTechRubric(e.target.value)}
                      rows={5}
                      className="w-full rounded px-4 py-3 neon-input font-mono text-xs"
                      placeholder='{"Research & Analysis": 150, ...}'
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={rubricBusy}
                  className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                >
                  {rubricBusy ? 'Saving...' : 'Save rubric'}
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded bg-black/20 border border-white/10">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Tech</p>
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                    {hackathon.rubric?.tech ? JSON.stringify(hackathon.rubric.tech, null, 2) : 'Using platform defaults'}
                  </pre>
                </div>
                <div className="p-4 rounded bg-black/20 border border-white/10">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Non-tech</p>
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                    {hackathon.rubric?.non_tech ? JSON.stringify(hackathon.rubric.non_tech, null, 2) : 'Using platform defaults'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
