import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { teamsApi, submissionsApi } from '../api/teams';
import { roundsApi } from '../api/rounds';
import { Hackathon, HackathonRound, Team, TeamMember, ProblemStatement, Submission, Evaluation, isFallbackScore } from '../types';
import { formatError } from '../utils/formatError';
import { isManagerRole } from '../utils/role';
import { formatDateTime, isPast } from '../utils/hackathon';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import PageLayout from '../components/PageLayout';
import EvaluationReport from '../components/EvaluationReport';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';
import CopyButton from '../components/CopyButton';
import Countdown from '../components/Countdown';
import SubmissionGuidelines from '../components/SubmissionGuidelines';
import RoundTabs from '../components/RoundTabs';
import JudgeMarks from '../components/JudgeMarks';

const AVATAR_COLORS = ['bg-neon-pink/20 text-neon-pink', 'bg-neon-cyan/20 text-neon-cyan', 'bg-neon-purple/20 text-neon-purple', 'bg-neon-yellow/15 text-neon-yellow'];

function Avatar({ name }: { name: string }) {
  const color = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${color}`} aria-hidden="true">
      {name.slice(0, 2)}
    </span>
  );
}

function StatusPill({ submission }: { submission?: Submission }) {
  if (!submission) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border border-white/15 text-slate-400">Not submitted</span>;
  }
  const style: Record<string, string> = {
    pending: 'border-neon-yellow/40 text-neon-yellow bg-neon-yellow/5',
    evaluated: 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5',
    not_assessable: 'border-neon-pink/40 text-neon-pink bg-neon-pink/5',
    failed: 'border-neon-pink/40 text-neon-pink bg-neon-pink/5',
  };
  const text: Record<string, string> = {
    pending: 'Awaiting evaluation',
    evaluated: 'Evaluated',
    not_assessable: 'Not assessable',
    failed: 'Evaluation failed',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${style[submission.status] ?? ''}`}>
      {text[submission.status] ?? submission.status}
    </span>
  );
}

interface BulkResult {
  label: string;
  ok: boolean;
  detail: string;
}

interface BulkState {
  running: boolean;
  total: number;
  done: number;
  current?: string;
  results: BulkResult[];
  /** Why the run ended early, if it did. */
  stoppedReason?: string;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function HackathonTeams() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const { user, can } = useAuth();
  const confirm = useConfirm();

  // What the user may do comes from the superadmin's permission matrix. The
  // backend also scopes managers to hackathons they own.
  const isManager = isManagerRole(user?.role);
  const isJudge = user?.role === 'judge';
  const isParticipantView = !isManager && !isJudge;
  const canEvaluate = can('evaluate_submission');
  const canCreateTeam = can('create_team') && can('participate');
  const canJoinTeam = can('join_team') && can('participate');
  const canSubmit = can('submit_project') && !isJudge;
  const canDeleteTeam = isManager && can('delete_team');
  const canViewReports = can('view_reports');

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissionsByTeam, setSubmissionsByTeam] = useState<Record<number, Submission[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Record<number, boolean>>({});
  const [evaluating, setEvaluating] = useState<Record<number, boolean>>({});
  const [report, setReport] = useState<Evaluation | null>(null);
  const [addMemberUser, setAddMemberUser] = useState<Record<number, string>>({});
  const [addMemberBusy, setAddMemberBusy] = useState<Record<number, boolean>>({});
  const [memberBusy, setMemberBusy] = useState<Record<number, boolean>>({});
  const [bulk, setBulk] = useState<BulkState | null>(null);
  const stopRequested = useRef(false);
  const [rounds, setRounds] = useState<HackathonRound[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const roundParam = Number(searchParams.get('round')) || undefined;
  const [activeRound, setActiveRound] = useState<number>(roundParam ?? 1);
  const chooseRound = (n: number) => {
    setActiveRound(n);
    setSearchParams(n > 1 ? { round: String(n) } : {}, { replace: true });
  };

  const fetchHackathon = () =>
    hackathonsApi
      .get(hackathonId)
      .then((res) => setHackathon(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')));

  const fetchTeams = () =>
    teamsApi
      .list(hackathonId)
      .then((res) => setTeams(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load teams')))
      .finally(() => setLoading(false));

  const fetchSubmissions = (currentTeams: Team[]) => {
    if (currentTeams.length === 0) return;
    if (!isParticipantView) {
      // Organisers and judges: one request for the whole hackathon (was one per team).
      submissionsApi
        .listByHackathon(hackathonId)
        .then((res) => {
          const map: Record<number, Submission[]> = {};
          for (const sub of res.data) (map[sub.team_id] ??= []).push(sub);
          setSubmissionsByTeam(map);
        })
        .catch((err) => setError(formatError(err, 'Failed to load submissions')));
      return;
    }
    // Participants may only read their own team's submissions.
    const visible = currentTeams.filter((t) => t.members?.some((m) => m.user_id === user?.id));
    Promise.allSettled(visible.map((t) => submissionsApi.listByTeam(t.id))).then((results) => {
      const map: Record<number, Submission[]> = {};
      let firstError: any = null;
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') map[visible[i].id] = res.value.data;
        else if (res.reason?.response?.status !== 403) firstError = firstError ?? res.reason;
      });
      setSubmissionsByTeam(map);
      if (firstError) setError(formatError(firstError, 'Failed to load submissions'));
    });
  };

  const fetchRounds = () =>
    roundsApi
      .list(hackathonId)
      .then((res) => {
        setRounds(res.data);
        return res.data;
      })
      .catch(() => [] as HackathonRound[]);

  useEffect(() => {
    fetchHackathon();
    fetchTeams();
  }, [hackathonId]);

  useEffect(() => {
    fetchSubmissions(teams);
  }, [teams]);

  useEffect(() => {
    if (!bulk?.running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [bulk?.running]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const myTeam = useMemo(() => teams.find((t) => t.members?.some((m) => m.user_id === user?.id)), [teams, user?.id]);

  // Open on the round that matters now: the latest round a participant's team
  // advanced to; for organisers and judges the latest round with submissions.
  useEffect(() => {
    if (!user || loading) return;
    fetchRounds().then((list) => {
      if (roundParam || list.length < 2) return;
      const latest = [...list].reverse();
      const pick = isParticipantView
        ? latest.find((r) => r.number > 1 && r.published && myTeam && r.shortlisted_team_ids?.includes(myTeam.id))
        : latest.find((r) => r.submission_count > 0);
      if (pick) setActiveRound(pick.number);
    });
  }, [hackathonId, user?.id, loading]);
  const isLeaderOf = (team: Team) => team.members?.some((m) => m.user_id === user?.id && m.role === 'leader') ?? false;
  const canManageMembersOf = (team: Team) => can('manage_team_members') && (isManager || isLeaderOf(team));
  const problemStatements = hackathon?.problem_statements ?? [];
  const currentRound = rounds.find((r) => r.number === activeRound);
  const roundDeadline = activeRound === 1 ? hackathon?.submission_deadline : currentRound?.submission_deadline;
  const submissionsClosed = isPast(roundDeadline);
  const roundSubs = (teamId: number) => (submissionsByTeam[teamId] ?? []).filter((s) => (s.round_number ?? 1) === activeRound);
  const inRound = (team: Team) => activeRound === 1 || Boolean(currentRound?.shortlisted_team_ids?.includes(team.id));
  // With "one statement per team", a team's first submission fixes its track.
  const trackOf = (team: Team) =>
    hackathon?.one_statement_per_team ? submissionsByTeam[team.id]?.[0]?.problem_statement_id : undefined;

  // ---- actions --------------------------------------------------------------

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await teamsApi.create(hackathonId, teamName.trim());
      setTeamName('');
      await fetchTeams();
      flash(isManager ? 'Team created.' : 'Team created. Share the invite code with your teammates.');
    } catch (err: any) {
      setError(formatError(err, 'Failed to create team'));
    } finally {
      setBusy(false);
    }
  };

  const joinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinBusy(true);
    setError('');
    try {
      await teamsApi.joinByCode(joinCodeInput.trim());
      setJoinCodeInput('');
      await fetchTeams();
      flash('You joined the team.');
    } catch (err: any) {
      setError(formatError(err, 'Failed to join team'));
    } finally {
      setJoinBusy(false);
    }
  };

  const addMember = async (team: Team) => {
    const username = addMemberUser[team.id]?.trim();
    if (!username) return;
    setAddMemberBusy((prev) => ({ ...prev, [team.id]: true }));
    setError('');
    try {
      await teamsApi.addMember(team.id, username);
      setAddMemberUser((prev) => ({ ...prev, [team.id]: '' }));
      await fetchTeams();
      flash(`${username} added to ${team.name}.`);
    } catch (err: any) {
      setError(formatError(err, 'Failed to add member'));
    } finally {
      setAddMemberBusy((prev) => ({ ...prev, [team.id]: false }));
    }
  };

  const changeRole = async (team: Team, member: TeamMember, role: string) => {
    if (role === member.role) return;
    const currentLeader = team.members?.find((m) => m.role === 'leader' && m.id !== member.id);
    const ok = await confirm({
      title: role === 'leader' ? `Make ${member.username} the team leader?` : `Make ${member.username} a regular member?`,
      message:
        role === 'leader'
          ? `${member.username} will manage the team${currentLeader ? ` and ${currentLeader.username} will become a regular member` : ''}.`
          : 'A team always needs one leader, so promote someone else first if this is the only leader.',
      confirmLabel: role === 'leader' ? 'Change leader' : 'Change role',
    });
    if (!ok) return;
    setMemberBusy((prev) => ({ ...prev, [member.id]: true }));
    setError('');
    try {
      await teamsApi.updateMember(team.id, member.id, role);
      await fetchTeams();
    } catch (err: any) {
      setError(formatError(err, 'Failed to update member role'));
    } finally {
      setMemberBusy((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  const removeMember = async (team: Team, member: TeamMember) => {
    const self = member.user_id === user?.id;
    const ok = await confirm({
      title: self ? 'Leave this team?' : `Remove ${member.username} from ${team.name}?`,
      message: self
        ? 'You will lose access to this team and its submissions until someone adds you back.'
        : `${member.username} will lose access to the team and its submissions.`,
      confirmLabel: self ? 'Leave team' : 'Remove member',
      tone: 'danger',
    });
    if (!ok) return;
    setMemberBusy((prev) => ({ ...prev, [member.id]: true }));
    setError('');
    try {
      await teamsApi.removeMember(team.id, member.id);
      await fetchTeams();
    } catch (err: any) {
      setError(formatError(err, 'Failed to remove member'));
    } finally {
      setMemberBusy((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  const deleteTeam = async (team: Team) => {
    const subs = submissionsByTeam[team.id]?.length ?? 0;
    const ok = await confirm({
      title: `Delete team "${team.name}"?`,
      message: `This permanently deletes the team, its ${team.members?.length ?? 0} memberships${
        subs ? `, ${subs} submission${subs === 1 ? '' : 's'} and their evaluations` : ''
      }. It cannot be undone.`,
      confirmLabel: 'Delete team',
      tone: 'danger',
      requireText: team.name,
    });
    if (!ok) return;
    setDeletingTeam((prev) => ({ ...prev, [team.id]: true }));
    setError('');
    try {
      await teamsApi.delete(team.id);
      await Promise.all([fetchTeams(), fetchHackathon()]);
      flash(`Team ${team.name} deleted.`);
    } catch (err: any) {
      setError(formatError(err, 'Failed to delete team'));
    } finally {
      setDeletingTeam((prev) => ({ ...prev, [team.id]: false }));
    }
  };

  const evaluate = async (submission: Submission, retry = false) => {
    if (retry) {
      const ok = await confirm({
        title: 'Re-run this evaluation?',
        message: 'The AI evaluates the submission again and the new score replaces the current one. If the evaluator is unavailable, the current score is kept.',
        confirmLabel: 'Re-run evaluation',
      });
      if (!ok) return;
    }
    setEvaluating((prev) => ({ ...prev, [submission.id]: true }));
    setError('');
    try {
      if (submission.type === 'tech') {
        retry ? await submissionsApi.retryTech(submission.id) : await submissionsApi.evaluateTech(submission.id);
      } else {
        retry ? await submissionsApi.retryNonTech(submission.id) : await submissionsApi.evaluateNonTech(submission.id);
      }
      fetchSubmissions(teams);
      flash('Evaluation complete.');
    } catch (err: any) {
      setError(formatError(err, retry ? 'Retry failed' : 'Evaluation failed'));
    } finally {
      setEvaluating((prev) => ({ ...prev, [submission.id]: false }));
    }
  };

  // Submissions without an evaluation, in team order then problem statement order.
  const pendingQueue = useMemo(() => {
    const order = new Map((hackathon?.problem_statements ?? []).map((ps, i) => [ps.id, i]));
    const titles = new Map((hackathon?.problem_statements ?? []).map((ps) => [ps.id, ps.title]));
    return teams.flatMap((team) =>
      roundSubs(team.id)
        .filter((sub) => !sub.evaluation)
        .sort((a, b) => (order.get(a.problem_statement_id) ?? 0) - (order.get(b.problem_statement_id) ?? 0))
        .map((sub) => ({ sub, label: `${team.name} — ${titles.get(sub.problem_statement_id) ?? 'Problem statement'}` })),
    );
  }, [teams, submissionsByTeam, hackathon?.problem_statements, activeRound]);

  /** Evaluate every pending submission one at a time (serially), with progress and a stop button. */
  const runBulkEvaluation = async () => {
    const queue = pendingQueue;
    if (queue.length === 0) return;
    const ok = await confirm({
      title: `Evaluate ${queue.length} pending submission${queue.length === 1 ? '' : 's'}?`,
      message: (
        <>
          Submissions are evaluated one at a time, which can take up to a minute each (roughly {queue.length} minute
          {queue.length === 1 ? '' : 's'} in total). Keep this page open until it finishes. You can stop after the current
          submission at any time. Already-evaluated submissions are not touched.
        </>
      ),
      confirmLabel: 'Start evaluating',
    });
    if (!ok) return;

    stopRequested.current = false;
    setError('');
    setBulk({ running: true, total: queue.length, done: 0, results: [] });
    let stoppedReason: string | undefined;

    for (const { sub, label } of queue) {
      if (stopRequested.current) {
        stoppedReason = 'Stopped by you.';
        break;
      }
      setBulk((b) => (b ? { ...b, current: label } : b));
      let result: BulkResult;
      try {
        const { data } =
          sub.type === 'tech' ? await submissionsApi.evaluateTech(sub.id) : await submissionsApi.evaluateNonTech(sub.id);
        result = { label, ok: true, detail: `${data.total_score} pts · ${data.verdict}` };
      } catch (err: any) {
        result = { label, ok: false, detail: formatError(err, 'Evaluation failed') };
        if (err?.response?.status === 503) {
          // The AI evaluator is down; every remaining submission would fail the same way.
          stoppedReason = 'The AI evaluator is unavailable, so the run was paused. Try again later; finished scores are kept.';
        }
      }
      setBulk((b) => (b ? { ...b, done: b.done + 1, results: [...b.results, result] } : b));
      fetchSubmissions(teams);
      if (stoppedReason) break;
      await sleep(1000); // a short gap between requests keeps us clear of AI rate limits
    }

    setBulk((b) => (b ? { ...b, running: false, current: undefined, stoppedReason } : b));
    fetchSubmissions(teams);
  };

  // ---- shared pieces ----------------------------------------------------------

  const memberList = (team: Team) => {
    const manageable = canManageMembersOf(team);
    return (
      <ul className="space-y-2">
        {team.members?.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-black/20 border border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={m.username} />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {m.username}
                  {m.user_id === user?.id && <span className="text-slate-500 ml-1">(you)</span>}
                </p>
                {m.role === 'leader' && <p className="text-[10px] uppercase tracking-wider text-neon-cyan">Team leader</p>}
              </div>
            </div>
            {manageable && (
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => changeRole(team, m, e.target.value)}
                  disabled={memberBusy[m.id]}
                  aria-label={`Role of ${m.username}`}
                  className="rounded px-2 py-1 pr-7 text-xs neon-input neon-select"
                >
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeMember(team, m)}
                  disabled={memberBusy[m.id]}
                  className="px-2 py-1 rounded text-[11px] text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/10 transition disabled:opacity-50"
                >
                  {m.user_id === user?.id ? 'Leave' : 'Remove'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const addMemberForm = (team: Team) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addMember(team);
      }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <input
        value={addMemberUser[team.id] || ''}
        onChange={(e) => setAddMemberUser((prev) => ({ ...prev, [team.id]: e.target.value }))}
        placeholder="Add a teammate by username"
        className="flex-1 rounded px-3 py-2 text-xs neon-input"
      />
      <button
        type="submit"
        disabled={addMemberBusy[team.id] || !addMemberUser[team.id]?.trim()}
        className="px-4 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
      >
        {addMemberBusy[team.id] ? 'Adding...' : 'Add'}
      </button>
    </form>
  );

  const inviteCode = (team: Team, explain: boolean) =>
    team.join_code ? (
      <div>
        {explain && <p className="text-xs text-slate-400 mb-2">Share this code with teammates so they can join from this page.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded bg-black/30 border border-neon-cyan/30 font-mono text-sm text-neon-cyan tracking-[0.25em] select-all">
            {team.join_code}
          </span>
          <CopyButton text={team.join_code} label="Copy code" />
        </div>
      </div>
    ) : null;

  const submissionRows = (team: Team, onBehalf: boolean) => {
    if (!inRound(team)) {
      return (
        <p className="text-xs text-slate-400">
          {isParticipantView
            ? `Your team was not shortlisted for ${currentRound?.name ?? 'this round'}. Thank you for taking part!`
            : `Not shortlisted for ${currentRound?.name ?? 'this round'}.`}
        </p>
      );
    }
    if (problemStatements.length === 0) {
      return hackathon?.problem_statements_hidden ? (
        <p className="text-xs text-neon-purple">
          Problem statements and submissions unlock when the hackathon starts (
          <Countdown targetDate={hackathon.start_date} label="in" />
          ).
        </p>
      ) : (
        <p className="text-xs text-slate-500">No problem statements yet. Submissions open once the organisers publish them.</p>
      );
    }
    return (
      <ul className="space-y-2">
        {problemStatements.map((ps: ProblemStatement, i: number) => {
          const sub = roundSubs(team.id).find((s) => s.problem_statement_id === ps.id);
          const ev = sub?.evaluation;
          return (
            <li key={ps.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg bg-black/20 border border-white/10">
              <div className="min-w-0">
                <p className="text-sm text-white">
                  <span className="font-mono text-slate-500 mr-2">{String(i + 1).padStart(2, '0')}</span>
                  {ps.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill submission={sub} />
                  {sub && <span className="text-[11px] text-slate-500 uppercase">{sub.type === 'tech' ? 'Tech' : 'Non-tech'}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ev && (
                  <button
                    type="button"
                    onClick={() => setReport(ev)}
                    className="px-3 py-1.5 rounded-lg border border-neon-cyan/40 text-xs text-neon-cyan hover:bg-neon-cyan/10 transition"
                  >
                    {ev.total_score} pts · {ev.verdict}
                  </button>
                )}
                {ev && isFallbackScore(ev.llm_source) && (
                  <span title="Not a real AI score. Re-run the evaluation." className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/30">
                    Fallback score
                  </span>
                )}
                {sub && ev && canViewReports && (
                  <Link to={`/reports/submission/${sub.id}`} className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-300 hover:text-white transition">
                    Full report
                  </Link>
                )}
                {sub && canEvaluate && !isParticipantView && (
                  <JudgeMarks
                    key={`${sub.id}-${sub.judge_scores?.length ?? 0}`}
                    submissionId={sub.id}
                    marks={sub.judge_scores ?? []}
                    userId={user?.id}
                    onChanged={() => fetchSubmissions(teams)}
                  />
                )}
                {sub && canEvaluate && !isParticipantView && (
                  <button
                    type="button"
                    onClick={() => evaluate(sub, Boolean(ev))}
                    disabled={evaluating[sub.id] || bulk?.running}
                    className={`px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-60 ${
                      ev ? 'border border-white/15 text-slate-300 hover:text-neon-pink hover:border-neon-pink/50' : 'neon-btn neon-btn-primary'
                    }`}
                  >
                    {evaluating[sub.id] ? 'Evaluating… up to a minute' : ev ? 'Re-run' : 'Evaluate'}
                  </button>
                )}
                {!sub && canSubmit && trackOf(team) !== undefined && trackOf(team) !== ps.id && (
                  <span className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-white/15">Team chose another statement</span>
                )}
                {!sub && canSubmit && trackOf(team) === undefined && submissionsClosed && !isManager && (
                  <span className="px-3 py-1.5 rounded-lg text-xs text-neon-pink border border-neon-pink/30">Submissions closed</span>
                )}
                {!sub && canSubmit && trackOf(team) === undefined && (!submissionsClosed || isManager) && (
                  <Link
                    to={`/hackathons/${hackathonId}/submit/${team.id}/${ps.id}${activeRound > 1 ? `?round=${activeRound}` : ''}`}
                    className={`px-3 py-1.5 rounded-lg text-xs ${submissionsClosed ? 'border border-neon-yellow/50 text-neon-yellow hover:bg-neon-yellow/10' : 'neon-btn neon-btn-cyan'}`}
                  >
                    {submissionsClosed ? 'Submit late (organiser)' : onBehalf ? 'Submit on behalf' : 'Submit project'}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  // ---- render ------------------------------------------------------------------

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading teams..." />
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">MISSION NOT FOUND</h2>
          <p className="text-slate-300 mb-4">{error || 'This hackathon does not exist or you do not have access.'}</p>
          <Link to="/hackathons" className="text-neon-cyan hover:text-white text-sm">← Back to hackathons</Link>
        </div>
      </PageLayout>
    );
  }

  const otherTeams = teams.filter((t) => t.id !== myTeam?.id);
  const teamLimit = hackathon.max_team_members;
  const deadline = roundDeadline;
  const shownTeams = activeRound === 1 ? teams : teams.filter(inRound);

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to={`/hackathons/${hackathonId}`} label="Back to hackathon" />
        </div>

        <div className="glass-panel p-6 sm:p-8 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              {isManager ? 'Manage teams & submissions' : isJudge ? 'Review submissions' : 'Your team'}
            </p>
            <h1 className="font-pixel text-lg sm:text-xl text-white text-shadow-neon leading-snug">{hackathon.name}</h1>
            <p className="text-xs text-slate-400 mt-2">
              {teams.length} team{teams.length === 1 ? '' : 's'} · {problemStatements.length} problem statement
              {problemStatements.length === 1 ? '' : 's'}
              {teamLimit ? ` · up to ${teamLimit} per team` : ''}
            </p>
            {deadline && (
              <p className={`text-xs mt-1 ${submissionsClosed ? 'text-neon-pink' : 'text-neon-yellow'}`}>
                {submissionsClosed ? (
                  <>Submissions closed {formatDateTime(deadline)}</>
                ) : (
                  <Countdown targetDate={deadline} label="Submissions close in" />
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isManager && can('edit_hackathon') && (
              <Link to={`/hackathons/${hackathonId}/rounds`} className="px-5 py-2.5 rounded neon-btn neon-btn-ghost text-xs">
                Manage rounds
              </Link>
            )}
            {can('view_leaderboard') && (
              <Link to={`/hackathons/${hackathonId}/leaderboard`} className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs">
                Leaderboard
              </Link>
            )}
          </div>
        </div>

        {rounds.length > 1 && (
          <div className="glass-panel p-4 sm:p-5 mb-6 border border-neon-purple/25">
            <RoundTabs rounds={rounds} active={activeRound} onChange={chooseRound} showUnpublished={!isParticipantView} />
            {currentRound && (
              <div className="mt-3 text-xs text-slate-400 space-y-1">
                <p>
                  <span className="text-white font-semibold">{currentRound.name}</span>
                  {activeRound > 1 && (
                    <>
                      {' '}
                      · {currentRound.shortlisted_team_ids?.length ?? 0} shortlisted team
                      {(currentRound.shortlisted_team_ids?.length ?? 0) === 1 ? '' : 's'}
                      {!currentRound.published && <span className="text-neon-yellow"> · draft, not visible to teams yet</span>}
                    </>
                  )}
                  {currentRound.judge_weight > 0 && <> · judges&apos; marks count {currentRound.judge_weight}%</>}
                </p>
                {currentRound.instructions && <p className="text-slate-300 whitespace-pre-line">{currentRound.instructions}</p>}
                {isParticipantView && myTeam && activeRound > 1 && inRound(myTeam) && (
                  <p className="text-neon-cyan">Your team advanced to this round. Submit below before the deadline.</p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">{error}</div>}
        {notice && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm" role="status">
            {notice}
          </div>
        )}

        {report && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
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

        {/* ---------------- Participant view ---------------- */}
        {isParticipantView && (
          <>
            <details className="mb-6 group" open={!submissionsClosed}>
              <summary className="cursor-pointer text-sm text-neon-yellow mb-3">Submission guidelines (read before submitting)</summary>
              <SubmissionGuidelines hackathon={hackathon} compact />
            </details>
            {myTeam ? (
              <section className="glass-panel p-6 sm:p-8 mb-6 border border-neon-cyan/20">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-neon-cyan mb-1">My team</p>
                    <h2 className="text-xl font-semibold text-white">{myTeam.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {myTeam.members?.length ?? 0} member{myTeam.members?.length === 1 ? '' : 's'}
                      {teamLimit ? ` of ${teamLimit}` : ''}
                      {isLeaderOf(myTeam) ? ' · you are the leader' : ''}
                    </p>
                  </div>
                  {inviteCode(myTeam, true)}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="font-pixel text-[10px] text-slate-300 uppercase tracking-widest">Members</h3>
                    {memberList(myTeam)}
                    {canManageMembersOf(myTeam) && addMemberForm(myTeam)}
                  </div>
                  <div className="lg:col-span-3 space-y-3">
                    <h3 className="font-pixel text-[10px] text-slate-300 uppercase tracking-widest">Submissions</h3>
                    {submissionRows(myTeam, false)}
                  </div>
                </div>
              </section>
            ) : (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {canCreateTeam && (
                  <div className="glass-panel p-6 border-t-4 border-neon-pink/60">
                    <h2 className="font-pixel text-xs text-white mb-2">CREATE A TEAM</h2>
                    <p className="text-sm text-slate-400 mb-5">
                      Start a new team and become its leader. You get an invite code to share with teammates.
                    </p>
                    <form onSubmit={createTeam} className="space-y-3">
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Team name"
                        required
                        className="w-full rounded px-4 py-3 neon-input"
                      />
                      <button type="submit" disabled={busy || !teamName.trim()} className="w-full rounded neon-btn neon-btn-primary py-3 text-xs disabled:opacity-50">
                        {busy ? 'Creating...' : 'Create team'}
                      </button>
                    </form>
                  </div>
                )}
                {canJoinTeam && (
                  <div className="glass-panel p-6 border-t-4 border-neon-cyan/60">
                    <h2 className="font-pixel text-xs text-white mb-2">JOIN WITH A CODE</h2>
                    <p className="text-sm text-slate-400 mb-5">
                      Ask your team leader for the 8-character invite code and enter it here.
                    </p>
                    <form onSubmit={joinByCode} className="space-y-3">
                      <input
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder="AB3D9F2K"
                        maxLength={8}
                        className="w-full rounded px-4 py-3 neon-input font-mono tracking-[0.3em] text-center"
                      />
                      <button
                        type="submit"
                        disabled={joinBusy || joinCodeInput.trim().length < 8}
                        className="w-full rounded neon-btn neon-btn-cyan py-3 text-xs disabled:opacity-50"
                      >
                        {joinBusy ? 'Joining...' : 'Join team'}
                      </button>
                    </form>
                  </div>
                )}
                {!canCreateTeam && !canJoinTeam && (
                  <div className="glass-panel p-6 md:col-span-2 text-sm text-slate-300">
                    Your account can't join teams in this hackathon. Contact the organisers if you think this is a mistake.
                  </div>
                )}
              </section>
            )}

            {otherTeams.length > 0 && (
              <section className="glass-panel p-6">
                <h2 className="font-pixel text-[10px] text-slate-300 uppercase tracking-widest mb-4">Other teams</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {otherTeams.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/10">
                      <Avatar name={t.name} />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {t.members?.length ?? 0} member{t.members?.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* ---------------- Bulk evaluation ---------------- */}
        {!isParticipantView && canEvaluate && (pendingQueue.length > 0 || bulk) && (
          <section className="glass-panel p-5 sm:p-6 mb-6 border border-neon-purple/30" aria-live="polite">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-pixel text-xs text-white mb-1">BULK EVALUATION</h2>
                <p className="text-xs text-slate-400">
                  {bulk?.running
                    ? `Evaluating ${Math.min(bulk.done + 1, bulk.total)} of ${bulk.total}. Keep this page open.`
                    : pendingQueue.length > 0
                      ? `${pendingQueue.length} submission${pendingQueue.length === 1 ? ' is' : 's are'} waiting for evaluation. They run one at a time.`
                      : 'All submissions have been evaluated.'}
                </p>
              </div>
              <div className="flex gap-2">
                {bulk?.running ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopRequested.current = true;
                      setBulk((b) => (b ? { ...b, current: `${b.current ?? ''} (stopping after this one)` } : b));
                    }}
                    className="px-4 py-2 rounded text-xs border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10 transition"
                  >
                    Stop after current
                  </button>
                ) : (
                  <>
                    {pendingQueue.length > 0 && (
                      <button type="button" onClick={runBulkEvaluation} className="px-4 py-2 rounded neon-btn neon-btn-primary text-xs">
                        Evaluate all pending ({pendingQueue.length})
                      </button>
                    )}
                    {bulk && (
                      <button
                        type="button"
                        onClick={() => setBulk(null)}
                        className="px-3 py-2 rounded text-xs border border-white/10 text-slate-400 hover:text-white transition"
                      >
                        Dismiss
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {bulk && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all duration-500"
                    style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-2 mt-2 text-[11px] text-slate-400">
                  <span>{bulk.current ? `Now: ${bulk.current}` : bulk.running ? 'Starting…' : 'Finished'}</span>
                  <span>
                    {bulk.results.filter((r) => r.ok).length} scored · {bulk.results.filter((r) => !r.ok).length} failed ·{' '}
                    {bulk.done}/{bulk.total}
                  </span>
                </div>
                {bulk.stoppedReason && <p className="mt-3 text-xs text-neon-yellow">{bulk.stoppedReason}</p>}
                {bulk.results.length > 0 && (
                  <ul className="mt-3 max-h-48 overflow-y-auto space-y-1 text-xs">
                    {bulk.results.map((r, i) => (
                      <li key={i} className={`flex gap-2 ${r.ok ? 'text-slate-300' : 'text-neon-pink'}`}>
                        <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                        <span className="min-w-0">
                          <span className="text-white">{r.label}</span> — {r.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---------------- Organiser / judge view ---------------- */}
        {!isParticipantView && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {activeRound > 1 && shownTeams.length === 0 ? (
                <div className="glass-panel p-8 text-center">
                  <p className="text-slate-300">No teams are shortlisted for this round yet.</p>
                  {isManager && (
                    <Link to={`/hackathons/${hackathonId}/rounds`} className="inline-block mt-3 text-xs text-neon-cyan hover:text-white">
                      Shortlist teams →
                    </Link>
                  )}
                </div>
              ) : teams.length === 0 ? (
                <div
                  className="glass-panel p-8 text-center cursor-pointer"
                  data-egg-trigger="empty-state"
                  data-egg-message="Still hopeful! +25 XP"
                  data-egg-color="pink"
                >
                  <p className="text-slate-300">No teams yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Teams appear here as participants create or join them.</p>
                </div>
              ) : (
                shownTeams.map((team) => (
                  <section key={team.id} className="glass-panel p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={team.name} />
                        <div>
                          <h2 className="text-base font-semibold text-white">{team.name}</h2>
                          <p className="text-[11px] text-slate-500">
                            {team.members?.length ?? 0} member{team.members?.length === 1 ? '' : 's'}
                            {teamLimit ? ` of ${teamLimit}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isManager && inviteCode(team, false)}
                        {canDeleteTeam && (
                          <button
                            type="button"
                            onClick={() => deleteTeam(team)}
                            disabled={deletingTeam[team.id]}
                            className="px-3 py-1.5 rounded text-xs text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/10 transition disabled:opacity-50"
                          >
                            {deletingTeam[team.id] ? 'Deleting...' : 'Delete team'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                      <div className="md:col-span-2 space-y-3">
                        {memberList(team)}
                        {canManageMembersOf(team) && addMemberForm(team)}
                      </div>
                      <div className="md:col-span-3">{submissionRows(team, isManager)}</div>
                    </div>
                  </section>
                ))
              )}
            </div>

            {isManager && canCreateTeam && (
              <aside className="glass-panel p-6 h-fit">
                <h3 className="font-pixel text-xs text-white mb-2">CREATE A TEAM</h3>
                <p className="text-xs text-slate-400 mb-4">Create a team on behalf of participants, then add members by username.</p>
                <form onSubmit={createTeam} className="space-y-3">
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team name"
                    required
                    className="w-full rounded px-4 py-3 neon-input"
                  />
                  <button type="submit" disabled={busy || !teamName.trim()} className="w-full rounded neon-btn neon-btn-primary py-3 text-xs disabled:opacity-50">
                    {busy ? 'Creating...' : 'Create team'}
                  </button>
                </form>
              </aside>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
