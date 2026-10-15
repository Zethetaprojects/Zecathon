import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hackathonsApi, problemStatementsApi } from '../api/hackathons';
import { submissionsApi } from '../api/teams';
import { Hackathon, ProblemStatement, Submission } from '../types';
import { formatError } from '../utils/formatError';
import { isManagerRole } from '../utils/role';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { getHackathonStatus, formatHackathonDateRange, getCountdownTarget } from '../utils/hackathon';
import {
  DEFAULT_NON_TECH_RUBRIC,
  DEFAULT_TECH_RUBRIC,
  RubricRow,
  rowsToRubric,
  rubricToRows,
} from '../utils/rubric';
import Countdown from '../components/Countdown';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';
import RubricEditor from '../components/RubricEditor';

const statusStyles = {
  upcoming: 'bg-neon-purple/10 text-neon-purple border-neon-purple/20',
  open: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
  ended: 'bg-neon-pink/10 text-neon-pink border-neon-pink/20',
};

const FILE_INPUT_CLASS =
  'w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer';

function resolveBannerUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/${path.split('/').pop()}`;
}

function resolveFileUrl(path: string) {
  return path.startsWith('http') || path.startsWith('/')
    ? path
    : `/uploads/${path.replace(/\\/g, '/').split('/').pop()}`;
}

function fileTypeLabel(path: string) {
  const ext = path.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : 'FILE';
}

function SubmissionPill({ submission }: { submission?: Submission }) {
  if (!submission) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-slate-400">
        Not submitted
      </span>
    );
  }
  const map: Record<string, string> = {
    pending: 'border-neon-yellow/40 text-neon-yellow bg-neon-yellow/5',
    evaluated: 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5',
    not_assessable: 'border-neon-pink/40 text-neon-pink bg-neon-pink/5',
    failed: 'border-neon-pink/40 text-neon-pink bg-neon-pink/5',
  };
  const label: Record<string, string> = {
    pending: 'Submitted · awaiting review',
    evaluated: submission.evaluation ? `Scored · ${submission.evaluation.total_score} pts` : 'Scored',
    not_assessable: 'Not assessable',
    failed: 'Evaluation failed',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${map[submission.status] ?? ''}`}>
      {label[submission.status] ?? submission.status}
    </span>
  );
}

/** One problem statement: readable view for everyone, inline edit/delete for unlocked organisers. */
function ProblemStatementCard({
  ps,
  index,
  editable,
  submission,
  submitHref,
  onSaved,
  onDeleted,
}: {
  ps: ProblemStatement;
  index: number;
  editable: boolean;
  submission?: Submission;
  submitHref?: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ps.title);
  const [description, setDescription] = useState(ps.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const locked = (ps.submission_count ?? 0) > 0;
  const lockReason = `Locked: ${ps.submission_count} team${ps.submission_count === 1 ? ' has' : 's have'} already submitted to this statement.`;
  const description_ = ps.description ?? '';
  const long = description_.length > 320 || description_.split('\n').length > 6;

  const startEdit = () => {
    setTitle(ps.title);
    setDescription(ps.description ?? '');
    setFile(null);
    setRemoveFile(false);
    setError('');
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const ok = await confirm({
      title: 'Save changes to this problem statement?',
      message: 'Every participant will see the updated wording straight away. Make sure the change is final.',
      confirmLabel: 'Save changes',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      if (file) form.append('file', file);
      else if (removeFile) form.append('remove_file', 'true');
      await problemStatementsApi.update(ps.id, form);
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(formatError(err, 'Failed to save problem statement'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this problem statement?',
      message: (
        <>
          <span className="text-white">{ps.title}</span> will be removed for everyone. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete statement',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await problemStatementsApi.delete(ps.id);
      onDeleted();
    } catch (err: any) {
      setError(formatError(err, 'Failed to delete problem statement'));
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="p-5 rounded-xl bg-black/30 border border-neon-cyan/40">
        <form onSubmit={save} className="space-y-4">
          <p className="font-pixel text-[10px] text-neon-cyan">EDITING PROBLEM STATEMENT {index + 1}</p>
          {error && <p className="text-sm text-neon-pink">{error}</p>}
          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded px-4 py-3 neon-input" />
          </div>
          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded px-4 py-3 neon-input"
            />
          </div>
          <div>
            <label className="block text-xs pixel-caps text-slate-300 mb-2">Attachment</label>
            {ps.file_path && !file && (
              <label className="flex items-center gap-2 text-xs text-slate-300 mb-2 cursor-pointer">
                <input type="checkbox" checked={removeFile} onChange={(e) => setRemoveFile(e.target.checked)} />
                Remove the current attachment ({fileTypeLabel(ps.file_path)})
              </label>
            )}
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className={FILE_INPUT_CLASS} />
            <p className="text-[11px] text-slate-500 mt-1">Choosing a file replaces the current attachment.</p>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50">
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-5 py-2 rounded neon-btn neon-btn-ghost text-xs">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group relative p-5 sm:p-6 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 hover:border-neon-cyan/30 transition">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center font-pixel text-[10px] text-neon-cyan">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">{ps.title}</h3>
            {submitHref !== undefined && <SubmissionPill submission={submission} />}
          </div>

          {description_ ? (
            <div className="mt-3">
              <p className={`text-sm text-slate-300 leading-relaxed whitespace-pre-line ${long && !expanded ? 'line-clamp-5' : ''}`}>
                {description_}
              </p>
              {long && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-xs text-neon-cyan hover:text-white transition"
                >
                  {expanded ? 'Show less' : 'Read full statement'}
                </button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 italic">No description provided{ps.file_path ? '; see the attached brief.' : '.'}</p>
          )}

          {error && <p className="mt-3 text-sm text-neon-pink">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {ps.file_path && (
              <a
                href={resolveFileUrl(ps.file_path)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 text-xs text-neon-cyan hover:bg-neon-cyan/10 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M6 20h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Open brief · {fileTypeLabel(ps.file_path)}
              </a>
            )}
            {submitHref && !submission && (
              <Link to={submitHref} className="px-3 py-1.5 rounded-lg neon-btn neon-btn-primary text-xs">
                Submit for this statement
              </Link>
            )}
            {editable && (
              <>
                {locked && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-400 border border-white/10" title={lockReason}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {ps.submission_count} submission{ps.submission_count === 1 ? '' : 's'} · locked
                  </span>
                )}
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={locked || busy}
                  title={locked ? lockReason : 'Edit this problem statement'}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/15 text-slate-300 hover:text-neon-cyan hover:border-neon-cyan/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={locked || busy}
                  title={locked ? lockReason : 'Delete this problem statement'}
                  className="px-3 py-1.5 rounded-lg text-xs border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const { user, can } = useAuth();
  const confirm = useConfirm();
  // The backend only lets organizers see their own hackathons, so a manager role
  // on this page means the user manages it; the toggles decide which actions.
  const isManager = isManagerRole(user?.role);
  const canEdit = isManager && can('edit_hackathon');
  const canManageStatements = isManager && can('manage_problem_statements');
  const hasOrganiserTools = canEdit || canManageStatements;

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Organiser controls start locked on every visit so nothing changes by accident.
  const [unlocked, setUnlocked] = useState(false);

  const [psTitle, setPsTitle] = useState('');
  const [psDescription, setPsDescription] = useState('');
  const [psFile, setPsFile] = useState<File | null>(null);
  const [psBusy, setPsBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [editingRubric, setEditingRubric] = useState(false);
  const [techCustom, setTechCustom] = useState(false);
  const [nonTechCustom, setNonTechCustom] = useState(false);
  const [techRows, setTechRows] = useState<RubricRow[]>([]);
  const [nonTechRows, setNonTechRows] = useState<RubricRow[]>([]);
  const [rubricBusy, setRubricBusy] = useState(false);
  const [rubricError, setRubricError] = useState('');

  const fetchHackathon = () =>
    hackathonsApi
      .get(hackathonId)
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchHackathon();
  }, [hackathonId]);

  const myTeam = useMemo(
    () => hackathon?.teams?.find((t) => t.members?.some((m) => m.user_id === user?.id)),
    [hackathon, user?.id],
  );

  useEffect(() => {
    if (!myTeam) return;
    submissionsApi
      .listByTeam(myTeam.id)
      .then((res) => setMySubmissions(res.data))
      .catch(() => setMySubmissions([]));
  }, [myTeam?.id]);

  const resetRubricEditor = (h: Hackathon) => {
    setTechCustom(Boolean(h.rubric?.tech));
    setNonTechCustom(Boolean(h.rubric?.non_tech));
    setTechRows(rubricToRows(h.rubric?.tech ?? DEFAULT_TECH_RUBRIC));
    setNonTechRows(rubricToRows(h.rubric?.non_tech ?? DEFAULT_NON_TECH_RUBRIC));
    setRubricError('');
  };

  useEffect(() => {
    if (hackathon) resetRubricEditor(hackathon);
  }, [hackathon?.rubric]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const toggleLock = async () => {
    if (unlocked) {
      setUnlocked(false);
      setEditingRubric(false);
      return;
    }
    const ok = await confirm({
      title: 'Unlock organiser controls?',
      message:
        'You will be able to add, edit, and delete problem statements and change the banner and rubric. Participants see changes immediately, so only unlock when you mean to change something.',
      confirmLabel: 'Unlock',
    });
    if (ok) setUnlocked(true);
  };

  const handleAddStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!psTitle.trim()) return;
    const ok = await confirm({
      title: 'Publish this problem statement?',
      message: (
        <>
          <span className="text-white">{psTitle.trim()}</span> will be visible to every participant right away.
        </>
      ),
      confirmLabel: 'Publish',
    });
    if (!ok) return;
    setPsBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('title', psTitle.trim());
      if (psDescription.trim()) form.append('description', psDescription.trim());
      if (psFile) form.append('file', psFile);
      await problemStatementsApi.upload(hackathonId, form);
      setPsTitle('');
      setPsDescription('');
      setPsFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await fetchHackathon();
      flash('Problem statement published.');
    } catch (err: any) {
      setError(formatError(err, 'Failed to upload problem statement'));
    } finally {
      setPsBusy(false);
    }
  };

  const handleBannerUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerFile) return;
    const ok = await confirm({
      title: 'Replace the banner?',
      message: 'The new image replaces the current banner on the hackathon list, this page, and the public landing page.',
      confirmLabel: 'Replace banner',
    });
    if (!ok) return;
    setBannerBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', bannerFile);
      await hackathonsApi.uploadBanner(hackathonId, form);
      setBannerFile(null);
      if (bannerRef.current) bannerRef.current.value = '';
      await fetchHackathon();
      flash('Banner updated.');
    } catch (err: any) {
      setError(formatError(err, 'Failed to upload banner'));
    } finally {
      setBannerBusy(false);
    }
  };

  const handleSaveRubric = async () => {
    setRubricError('');
    const rubric: { tech?: Record<string, number>; non_tech?: Record<string, number> } = {};
    if (techCustom) {
      const { rubric: tech, error: err } = rowsToRubric(techRows, 'Tech');
      if (err) return setRubricError(err);
      rubric.tech = tech;
    }
    if (nonTechCustom) {
      const { rubric: nonTech, error: err } = rowsToRubric(nonTechRows, 'Non-tech');
      if (err) return setRubricError(err);
      rubric.non_tech = nonTech;
    }
    const ok = await confirm({
      title: 'Change how submissions are scored?',
      message:
        'New evaluations will use this rubric. Submissions that were already evaluated keep their current scores unless a judge re-runs them, so changing the rubric mid-event can make scores inconsistent.',
      confirmLabel: 'Save rubric',
    });
    if (!ok) return;
    setRubricBusy(true);
    try {
      await hackathonsApi.update(hackathonId, { rubric: Object.keys(rubric).length ? rubric : null });
      setEditingRubric(false);
      await fetchHackathon();
      flash('Rubric saved.');
    } catch (err: any) {
      setRubricError(formatError(err, 'Failed to update rubric'));
    } finally {
      setRubricBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">MISSION NOT FOUND</h2>
          <p className="text-slate-300 mb-4">{error || 'The hackathon you are looking for does not exist.'}</p>
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>
      </PageLayout>
    );
  }

  const status = getHackathonStatus(hackathon.start_date, hackathon.end_date);
  const { target, label } = getCountdownTarget(hackathon.start_date, hackathon.end_date);
  const bannerUrl = resolveBannerUrl(hackathon.banner_path);
  const statements = hackathon.problem_statements ?? [];
  const teamsHref = `/hackathons/${hackathonId}/teams`;

  // One clear next step per role instead of a generic "manage" button.
  const primaryAction = isManager
    ? { label: 'Manage teams & submissions', hint: `${hackathon.teams?.length ?? 0} teams registered` }
    : user?.role === 'judge'
      ? { label: 'Review & evaluate submissions', hint: 'Score team submissions' }
      : myTeam
        ? { label: 'My team & submissions', hint: `You're in ${myTeam.name}` }
        : { label: 'Join or create a team', hint: "You're not in a team yet" };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>

        {/* Banner + hero */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-space-900 to-slate-900 mb-6">
          <div className="relative min-h-[11rem] sm:min-h-[15rem]">
            {bannerUrl ? (
              <img src={bannerUrl} alt={`${hackathon.name} banner`} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(176,38,255,0.25),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(5,217,232,0.2),transparent_60%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-space-900/95 via-space-900/50 to-transparent" />
            <div className="relative p-6 pt-20 sm:pt-28">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span
                  className={`px-2.5 py-1 rounded text-[10px] border uppercase tracking-wider cursor-pointer ${statusStyles[status.status]}`}
                  data-egg-trigger="status-badge"
                  data-egg-message="Status checked! +25 XP"
                  data-egg-color="cyan"
                >
                  {status.label}
                </span>
                {status.status !== 'ended' && target && (
                  <span
                    className="font-mono text-xs text-white cursor-pointer"
                    data-egg-trigger="countdown-click"
                    data-egg-message="Time is ticking... +25 XP"
                    data-egg-color="yellow"
                  >
                    <Countdown targetDate={target} label={label} />
                  </span>
                )}
              </div>
              <h1 className="font-pixel text-xl sm:text-2xl text-white text-shadow-neon mb-2 leading-snug">{hackathon.name}</h1>
              {hackathon.description && (
                <p className="text-slate-200 text-sm max-w-2xl whitespace-pre-line">{hackathon.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Primary actions */}
        <div className="glass-panel p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white font-semibold">{primaryAction.hint}</p>
            <p className="text-xs text-slate-400">{formatHackathonDateRange(hackathon.start_date, hackathon.end_date)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={teamsHref} className="px-5 py-2.5 rounded neon-btn neon-btn-primary text-xs">
              {primaryAction.label}
            </Link>
            {can('view_leaderboard') && (
              <Link to={`/hackathons/${hackathonId}/leaderboard`} className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs">
                Leaderboard
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">{error}</div>
        )}
        {notice && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm" role="status">
            {notice}
          </div>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { k: 'Status', v: status.label },
            { k: 'Duration', v: hackathon.duration_hours ? `${hackathon.duration_hours} hours` : 'Not set' },
            { k: 'Problem statements', v: String(statements.length) },
            {
              k: 'Team size',
              v: hackathon.max_team_members ? `Up to ${hackathon.max_team_members}` : 'No limit',
            },
          ].map((item) => (
            <div key={item.k} className="p-4 rounded-xl bg-black/20 border border-white/10">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.k}</p>
              <p className="text-sm font-semibold text-white">{item.v}</p>
            </div>
          ))}
        </div>

        {/* Organiser lock bar */}
        {hasOrganiserTools && (
          <div
            className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              unlocked ? 'border-neon-yellow/40 bg-neon-yellow/5' : 'border-white/10 bg-black/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 ${unlocked ? 'text-neon-yellow' : 'text-slate-400'}`} aria-hidden="true">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {unlocked ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  )}
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {unlocked ? 'Organiser controls unlocked' : 'Organiser controls are locked'}
                </p>
                <p className="text-xs text-slate-400">
                  {unlocked
                    ? 'Changes are visible to participants immediately. Every change asks for confirmation.'
                    : 'Unlock to edit problem statements, the banner, or the scoring rubric.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {unlocked && canEdit && (
                <Link to={`/hackathons/${hackathonId}/edit`} className="px-4 py-2 rounded neon-btn neon-btn-ghost text-xs">
                  Edit name, dates & limits
                </Link>
              )}
              <button
                type="button"
                onClick={toggleLock}
                className={`px-4 py-2 rounded text-xs border transition ${
                  unlocked
                    ? 'border-neon-yellow/60 text-neon-yellow hover:bg-neon-yellow/10'
                    : 'border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10'
                }`}
              >
                {unlocked ? 'Lock controls' : 'Unlock to edit'}
              </button>
            </div>
          </div>
        )}

        {/* Problem statements */}
        <section className="glass-panel p-6 sm:p-8 mb-8">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="font-pixel text-sm text-white">PROBLEM STATEMENTS</h2>
              <p className="text-xs text-slate-400 mt-2">
                {statements.length === 0
                  ? 'Nothing published yet.'
                  : myTeam
                    ? 'Pick a statement and submit your project for it.'
                    : `${statements.length} challenge${statements.length === 1 ? '' : 's'} to choose from.`}
              </p>
            </div>
          </div>

          {statements.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-dashed border-white/15 text-center cursor-pointer"
              data-egg-trigger="empty-state"
              data-egg-message="Still hopeful! +25 XP"
              data-egg-color="pink"
            >
              <p className="text-slate-300 text-sm">No problem statements yet.</p>
              <p className="text-slate-500 text-xs mt-1">
                {hasOrganiserTools ? 'Unlock organiser controls to publish the first one.' : 'Check back soon. The organisers will publish them here.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {statements.map((ps, i) => (
                <ProblemStatementCard
                  key={ps.id}
                  ps={ps}
                  index={i}
                  editable={unlocked && canManageStatements}
                  submission={mySubmissions.find((s) => s.problem_statement_id === ps.id)}
                  submitHref={myTeam && can('submit_project') ? `/hackathons/${hackathonId}/submit/${myTeam.id}/${ps.id}` : undefined}
                  onSaved={() => {
                    fetchHackathon();
                    flash('Problem statement updated.');
                  }}
                  onDeleted={() => {
                    fetchHackathon();
                    flash('Problem statement deleted.');
                  }}
                />
              ))}
            </ul>
          )}

          {unlocked && canManageStatements && (
            <form onSubmit={handleAddStatement} className="mt-8 p-5 rounded-xl bg-black/20 border border-dashed border-neon-cyan/30">
              <h3 className="font-pixel text-xs text-white mb-4">ADD A PROBLEM STATEMENT</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Title</label>
                  <input
                    value={psTitle}
                    onChange={(e) => setPsTitle(e.target.value)}
                    required
                    className="w-full rounded px-4 py-3 neon-input"
                    placeholder="e.g. Reduce food waste on campus"
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Description</label>
                  <textarea
                    value={psDescription}
                    onChange={(e) => setPsDescription(e.target.value)}
                    rows={5}
                    className="w-full rounded px-4 py-3 neon-input"
                    placeholder="What should teams build? Include goals, constraints, and how it will be judged."
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">Brief / attachment (optional)</label>
                  <input ref={fileRef} type="file" onChange={(e) => setPsFile(e.target.files?.[0] || null)} className={FILE_INPUT_CLASS} />
                </div>
                <button type="submit" disabled={psBusy || !psTitle.trim()} className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50">
                  {psBusy ? 'Publishing...' : 'Publish statement'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Banner */}
        {unlocked && canEdit && (
          <section className="glass-panel p-6 sm:p-8 mb-8">
            <h2 className="font-pixel text-sm text-white mb-2">BANNER</h2>
            <p className="text-xs text-slate-400 mb-4">PNG, JPG, GIF, or WebP. Shown on the hackathon list and landing page.</p>
            <form onSubmit={handleBannerUpload} className="flex flex-col sm:flex-row gap-4 items-start">
              <input
                ref={bannerRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                className={`flex-1 ${FILE_INPUT_CLASS}`}
              />
              <button type="submit" disabled={bannerBusy || !bannerFile} className="px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50">
                {bannerBusy ? 'Uploading...' : 'Replace banner'}
              </button>
            </form>
          </section>
        )}

        {/* Rubric */}
        {canEdit && (
          <section className="glass-panel p-6 sm:p-8 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 className="font-pixel text-sm text-white">SCORING RUBRIC</h2>
              {unlocked && (
                <button
                  type="button"
                  onClick={() => {
                    if (editingRubric) resetRubricEditor(hackathon);
                    setEditingRubric((v) => !v);
                  }}
                  className="px-3 py-1.5 rounded text-xs neon-btn neon-btn-ghost"
                  data-egg-trigger="rubric-toggle"
                  data-egg-message="Rubric curious! +25 XP"
                  data-egg-color="purple"
                >
                  {editingRubric ? 'Cancel' : 'Edit rubric'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Categories and maximum points the AI evaluator scores against. Each rubric must total 1000 points.
            </p>

            {rubricError && (
              <div className="mb-4 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">{rubricError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RubricEditor
                label="Tech submissions"
                custom={techCustom}
                onCustomChange={setTechCustom}
                rows={techRows}
                onRowsChange={setTechRows}
                defaults={DEFAULT_TECH_RUBRIC}
                disabled={!editingRubric}
              />
              <RubricEditor
                label="Non-tech submissions"
                custom={nonTechCustom}
                onCustomChange={setNonTechCustom}
                rows={nonTechRows}
                onRowsChange={setNonTechRows}
                defaults={DEFAULT_NON_TECH_RUBRIC}
                disabled={!editingRubric}
              />
            </div>

            {editingRubric && (
              <button
                type="button"
                onClick={handleSaveRubric}
                disabled={rubricBusy}
                className="mt-4 px-5 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
              >
                {rubricBusy ? 'Saving...' : 'Save rubric'}
              </button>
            )}
          </section>
        )}
      </div>
    </PageLayout>
  );
}
