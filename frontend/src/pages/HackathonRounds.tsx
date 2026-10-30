import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { leaderboardApi } from '../api/leaderboard';
import { roundsApi, RoundSettings } from '../api/rounds';
import { Hackathon, HackathonRound, LeaderboardEntry, Team } from '../types';
import { formatError } from '../utils/formatError';
import { formatDateTime, isPast, toDatetimeLocalValue } from '../utils/hackathon';
import { useConfirm } from '../hooks/useConfirm';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';
import DateTimeInput from '../components/DateTimeInput';

interface Draft {
  name: string;
  instructions: string;
  deadline: string;
  judgeWeight: number;
}

const draftOf = (r: HackathonRound): Draft => ({
  name: r.name === `Round ${r.number}` ? '' : r.name,
  instructions: r.instructions ?? '',
  deadline: toDatetimeLocalValue(r.submission_deadline),
  judgeWeight: r.judge_weight,
});

function weightLabel(w: number) {
  if (w === 0) return 'AI evaluation only';
  if (w === 100) return "Judges' marks only";
  return `${100 - w}% AI · ${w}% judges`;
}

/**
 * Organiser page for a hackathon's rounds: round 1 is the hackathon itself; later
 * rounds are for the teams the organiser shortlists, and open once published.
 */
export default function HackathonRounds() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const confirm = useConfirm();

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [rounds, setRounds] = useState<HackathonRound[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [shortlists, setShortlists] = useState<Record<number, number[]>>({});
  const [boards, setBoards] = useState<Record<number, LeaderboardEntry[]>>({});
  const [topN, setTopN] = useState<Record<number, string>>({});
  const [perTrack, setPerTrack] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const applyRounds = (list: HackathonRound[]) => {
    setRounds(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.number, draftOf(r)])));
    setShortlists(Object.fromEntries(list.map((r) => [r.number, r.shortlisted_team_ids ?? []])));
  };

  const load = async () => {
    try {
      const [h, r] = await Promise.all([hackathonsApi.get(hackathonId), roundsApi.list(hackathonId)]);
      setHackathon(h.data);
      applyRounds(r.data);
      // Results of every round, to shortlist from the previous one.
      const results = await Promise.allSettled(r.data.map((x) => leaderboardApi.get(hackathonId, x.number)));
      setBoards(
        Object.fromEntries(
          results.map((res, i) => [r.data[i].number, res.status === 'fulfilled' ? res.value.data : []]),
        ),
      );
    } catch (err) {
      setError(formatError(err, 'Failed to load rounds'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [hackathonId]);

  const teams: Team[] = useMemo(
    () => [...(hackathon?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [hackathon?.teams],
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(formatError(err, 'Something went wrong'));
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const replaceRound = (updated: HackathonRound) => {
    setRounds((list) => list.map((r) => (r.number === updated.number ? updated : r)));
    setDrafts((d) => ({ ...d, [updated.number]: draftOf(updated) }));
    setShortlists((s) => ({ ...s, [updated.number]: updated.shortlisted_team_ids ?? [] }));
  };

  const saveSettings = (round: HackathonRound) =>
    run(`save-${round.number}`, async () => {
      const d = drafts[round.number];
      const payload: RoundSettings = { name: d.name.trim() || null, judge_weight: d.judgeWeight };
      if (round.number > 1) {
        payload.instructions = d.instructions.trim() || null;
        payload.submission_deadline = d.deadline ? new Date(d.deadline).toISOString() : null;
      }
      const { data } = await roundsApi.update(hackathonId, round.number, payload);
      replaceRound(data);
      flash(`${data.name} saved.`);
    });

  const addRound = () =>
    run('add', async () => {
      const { data } = await roundsApi.add(hackathonId, {});
      setRounds((list) => [...list, data]);
      setDrafts((d) => ({ ...d, [data.number]: draftOf(data) }));
      setShortlists((s) => ({ ...s, [data.number]: [] }));
      setBoards((b) => ({ ...b, [data.number]: [] }));
      flash(`Round ${data.number} added. Name it, shortlist teams, then publish it.`);
    });

  const removeRound = async (round: HackathonRound) => {
    const ok = await confirm({
      title: `Remove ${round.name}?`,
      message: 'The round, its settings and its shortlist are deleted. This is only possible before any team submits to it.',
      confirmLabel: 'Remove round',
      tone: 'danger',
    });
    if (!ok) return;
    run(`remove-${round.number}`, async () => {
      await roundsApi.remove(hackathonId, round.number);
      setRounds((list) => list.filter((r) => r.number !== round.number));
      flash(`${round.name} removed.`);
    });
  };

  const saveShortlist = (round: HackathonRound) =>
    run(`shortlist-${round.number}`, async () => {
      const { data } = await roundsApi.setShortlist(hackathonId, round.number, shortlists[round.number] ?? []);
      replaceRound(data);
      flash(`Shortlist saved: ${data.shortlisted_team_ids?.length ?? 0} team(s).`);
    });

  const setPublished = async (round: HackathonRound, published: boolean) => {
    const saved = round.shortlisted_team_ids ?? [];
    const pending = shortlists[round.number] ?? [];
    const unsaved = saved.length !== pending.length || pending.some((t) => !saved.includes(t));
    if (published && unsaved) {
      setError('Save the shortlist before publishing the round.');
      return;
    }
    const ok = await confirm(
      published
        ? {
            title: `Publish ${round.name}?`,
            message: (
              <>
                The {saved.length} shortlisted team{saved.length === 1 ? '' : 's'} will see that they advanced and can submit
                {round.submission_deadline ? ` until ${formatDateTime(round.submission_deadline)}` : ''}. Everyone else sees that
                they were not shortlisted, and the round's leaderboard becomes public.
              </>
            ),
            confirmLabel: 'Publish round',
          }
        : {
            title: `Hide ${round.name} again?`,
            message: 'Teams can no longer see the shortlist or submit to this round until you publish it again.',
            confirmLabel: 'Unpublish',
            tone: 'danger',
          },
    );
    if (!ok) return;
    run(`publish-${round.number}`, async () => {
      const { data } = await roundsApi.update(hackathonId, round.number, { published });
      replaceRound(data);
      flash(published ? `${data.name} is live for the shortlisted teams.` : `${data.name} is hidden again.`);
    });
  };

  const setResultsPublished = async (round: HackathonRound, publish: boolean) => {
    const ok = await confirm(
      publish
        ? {
            title: `Publish the results of ${round.name}?`,
            message: 'Teams and anyone with the leaderboard link will see every score and the ranking for this round.',
            confirmLabel: 'Publish results',
          }
        : {
            title: `Hide the results of ${round.name}?`,
            message: 'Teams and the public will see "Results not published yet" until you publish again.',
            confirmLabel: 'Hide results',
            tone: 'danger',
          },
    );
    if (!ok) return;
    run(`results-${round.number}`, async () => {
      const { data } = await roundsApi.update(hackathonId, round.number, { results_published: publish });
      replaceRound(data);
      flash(publish ? `Results of ${data.name} are public.` : `Results of ${data.name} are private again.`);
    });
  };

  /** Best score per team in a round's results, for shortlisting. */
  const resultsByTeam = (number: number) => {
    const map = new Map<number, LeaderboardEntry>();
    for (const e of boards[number] ?? []) {
      const prev = map.get(e.team_id);
      if (!prev || e.total_score > prev.total_score) map.set(e.team_id, e);
    }
    return map;
  };

  const pickTop = (round: HackathonRound) => {
    const n = Number(topN[round.number]);
    if (!Number.isInteger(n) || n < 1) {
      setError('Enter how many teams to pick, e.g. 10.');
      return;
    }
    const ranked = [...resultsByTeam(round.number - 1).values()].sort((a, b) => b.total_score - a.total_score);
    let picked: number[];
    if (perTrack[round.number]) {
      const byTrack = new Map<number, LeaderboardEntry[]>();
      for (const e of ranked) (byTrack.get(e.problem_statement_id) ?? byTrack.set(e.problem_statement_id, []).get(e.problem_statement_id)!).push(e);
      picked = [...byTrack.values()].flatMap((list) => list.slice(0, n).map((e) => e.team_id));
    } else {
      picked = ranked.slice(0, n).map((e) => e.team_id);
    }
    setShortlists((s) => ({ ...s, [round.number]: picked }));
    flash(`Selected ${picked.length} team(s). Review the list, then save the shortlist.`);
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading rounds..." />
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-3xl mx-auto glass-panel p-8 text-center">
          <p className="text-neon-pink mb-4">{error || 'Hackathon not found.'}</p>
          <Link to="/hackathons" className="text-neon-cyan text-sm">← Back to hackathons</Link>
        </div>
      </PageLayout>
    );
  }

  const lastNumber = rounds[rounds.length - 1]?.number ?? 1;

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <BackButton to={`/hackathons/${hackathonId}/teams`} label="Back to teams & submissions" />
        </div>

        <div className="glass-panel p-6 sm:p-8 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Rounds</p>
          <h1 className="font-pixel text-lg sm:text-xl text-white text-shadow-neon leading-snug">{hackathon.name}</h1>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Round 1 is the hackathon itself: every team can submit until its deadline. Add a round to run a second stage
            (for example finals): shortlist the teams that advance, then publish the round so they can submit again. Each
            round has its own leaderboard, and judges can mark submissions to count towards it.
          </p>
        </div>

        {error && <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">{error}</div>}
        {notice && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm" role="status">
            {notice}
          </div>
        )}

        <div className="space-y-6">
          {rounds.map((round) => {
            const d = drafts[round.number] ?? draftOf(round);
            const setD = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [round.number]: { ...d, ...patch } }));
            const previous = round.number > 1 ? resultsByTeam(round.number - 1) : null;
            const selected = new Set(shortlists[round.number] ?? []);
            const savedShortlist = new Set(round.shortlisted_team_ids ?? []);
            const shortlistDirty = selected.size !== savedShortlist.size || [...selected].some((t) => !savedShortlist.has(t));
            const deadline = round.number === 1 ? hackathon.submission_deadline : round.submission_deadline;
            const orderedTeams = previous
              ? [...teams].sort((a, b) => (previous.get(b.id)?.total_score ?? -1) - (previous.get(a.id)?.total_score ?? -1))
              : teams;

            return (
              <section
                key={round.number}
                className={`glass-panel p-6 sm:p-7 border ${round.published ? 'border-neon-cyan/25' : 'border-neon-yellow/30'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Round {round.number}</p>
                    <h2 className="text-lg font-semibold text-white">{round.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {round.submission_count} submission{round.submission_count === 1 ? '' : 's'} ·{' '}
                      {deadline ? `${isPast(deadline) ? 'closed' : 'closes'} ${formatDateTime(deadline)}` : 'no deadline'} ·{' '}
                      {weightLabel(round.judge_weight)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {round.number === 1 ? (
                      <span className="px-2.5 py-1 rounded text-[11px] border border-neon-cyan/40 text-neon-cyan">Open to every team</span>
                    ) : round.published ? (
                      <>
                        <span className="px-2.5 py-1 rounded text-[11px] border border-neon-cyan/40 text-neon-cyan">Published</span>
                        <button
                          type="button"
                          onClick={() => setPublished(round, false)}
                          disabled={busy[`publish-${round.number}`]}
                          className="px-3 py-1.5 rounded text-xs border border-white/15 text-slate-300 hover:text-neon-pink transition disabled:opacity-50"
                        >
                          Unpublish
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 rounded text-[11px] border border-neon-yellow/40 text-neon-yellow">Draft</span>
                        <button
                          type="button"
                          onClick={() => setPublished(round, true)}
                          disabled={busy[`publish-${round.number}`] || (round.shortlisted_team_ids?.length ?? 0) === 0}
                          title={(round.shortlisted_team_ids?.length ?? 0) === 0 ? 'Save a shortlist first' : undefined}
                          className="px-3 py-1.5 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                        >
                          Publish round
                        </button>
                      </>
                    )}
                    {round.number > 1 && round.number === lastNumber && round.submission_count === 0 && (
                      <button
                        type="button"
                        onClick={() => removeRound(round)}
                        disabled={busy[`remove-${round.number}`]}
                        className="px-3 py-1.5 rounded text-xs text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/10 transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`mb-5 px-4 py-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    round.results_published ? 'border-neon-cyan/30 bg-neon-cyan/5 text-slate-300' : 'border-white/10 bg-black/20 text-slate-400'
                  }`}
                >
                  <span>
                    <span className="text-white font-semibold">Results: {round.results_published ? 'published' : 'private'}.</span>{' '}
                    {round.results_published
                      ? 'Teams and the public can see the scores and ranking.'
                      : 'Only organisers, admins and judges can see scores, so you can check and correct them first.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setResultsPublished(round, !round.results_published)}
                    disabled={busy[`results-${round.number}`] || (round.number > 1 && !round.published)}
                    title={round.number > 1 && !round.published ? 'Publish the round first' : undefined}
                    className={`px-3 py-1.5 rounded text-xs whitespace-nowrap disabled:opacity-50 ${
                      round.results_published ? 'border border-white/15 text-slate-300 hover:text-neon-pink' : 'neon-btn neon-btn-primary'
                    }`}
                  >
                    {round.results_published ? 'Hide results' : 'Publish results'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs pixel-caps text-slate-300 mb-2">Round name</label>
                    <input
                      value={d.name}
                      onChange={(e) => setD({ name: e.target.value })}
                      maxLength={80}
                      placeholder={round.number === 1 ? 'e.g. Online round' : 'e.g. Finals'}
                      className="w-full rounded px-4 py-3 neon-input"
                    />
                  </div>
                  {round.number > 1 ? (
                    <div>
                      <label className="block text-xs pixel-caps text-slate-300 mb-2">Submission deadline</label>
                      <DateTimeInput value={d.deadline} onChange={(e) => setD({ deadline: e.target.value })} />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 self-end pb-3">
                      Round 1 uses the hackathon's deadline. Change it in{' '}
                      <Link to={`/hackathons/${hackathonId}/edit`} className="text-neon-cyan hover:text-white">Edit hackathon</Link>.
                    </div>
                  )}
                </div>

                {round.number > 1 && (
                  <div className="mt-4">
                    <label className="block text-xs pixel-caps text-slate-300 mb-2">What shortlisted teams should submit</label>
                    <textarea
                      value={d.instructions}
                      onChange={(e) => setD({ instructions: e.target.value })}
                      rows={3}
                      maxLength={5000}
                      placeholder="e.g. Upload a 10-slide pitch deck and your updated repository. Finals presentations are on 12 Dec at 10:00."
                      className="w-full rounded px-4 py-3 neon-input text-sm"
                    />
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">
                    How this round is scored: <span className="text-white normal-case">{weightLabel(d.judgeWeight)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={d.judgeWeight}
                    onChange={(e) => setD({ judgeWeight: Number(e.target.value) })}
                    className="w-full accent-[#b967ff]"
                    aria-label="Judges' share of the score"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>AI only</span>
                    <span>Judges only</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Judges mark each submission out of 1000 on the teams page; the marks are averaged across judges.
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveSettings(round)}
                    disabled={busy[`save-${round.number}`]}
                    className="px-4 py-2 rounded neon-btn neon-btn-cyan text-xs disabled:opacity-50"
                  >
                    {busy[`save-${round.number}`] ? 'Saving...' : 'Save settings'}
                  </button>
                </div>

                {round.number > 1 && (
                  <div className="mt-6 pt-5 border-t border-white/10">
                    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-pixel text-[10px] text-slate-300 uppercase tracking-widest">Shortlist</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {selected.size} of {teams.length} teams selected. Teams are ordered by their round {round.number - 1} score.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={topN[round.number] ?? ''}
                          onChange={(e) => setTopN((t) => ({ ...t, [round.number]: e.target.value.replace(/\D/g, '') }))}
                          placeholder="N"
                          inputMode="numeric"
                          className="w-16 rounded px-2 py-1.5 neon-input text-xs text-center"
                          aria-label="Number of top teams"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(perTrack[round.number])}
                            onChange={(e) => setPerTrack((p) => ({ ...p, [round.number]: e.target.checked }))}
                            className="accent-[#05d9e8]"
                          />
                          per track
                        </label>
                        <button
                          type="button"
                          onClick={() => pickTop(round)}
                          className="px-3 py-1.5 rounded text-xs border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 transition"
                        >
                          Select top N
                        </button>
                        <button
                          type="button"
                          onClick={() => setShortlists((s) => ({ ...s, [round.number]: [] }))}
                          className="px-3 py-1.5 rounded text-xs border border-white/15 text-slate-400 hover:text-white transition"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {teams.length === 0 ? (
                      <p className="text-xs text-slate-500">No teams yet.</p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                        {orderedTeams.map((team) => {
                          const result = previous?.get(team.id);
                          return (
                            <li key={team.id}>
                              <label
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer transition ${
                                  selected.has(team.id) ? 'border-neon-cyan/50 bg-neon-cyan/5' : 'border-white/10 bg-black/20 hover:border-white/25'
                                }`}
                              >
                                <span className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(team.id)}
                                    onChange={(e) =>
                                      setShortlists((s) => {
                                        const next = new Set(s[round.number] ?? []);
                                        if (e.target.checked) next.add(team.id);
                                        else next.delete(team.id);
                                        return { ...s, [round.number]: [...next] };
                                      })
                                    }
                                    className="accent-[#05d9e8]"
                                  />
                                  <span className="text-sm text-white truncate">{team.name}</span>
                                </span>
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                  {result ? (
                                    <>
                                      <span className="text-white font-semibold">{result.total_score}</span> · {result.problem_statement_title.slice(0, 28)}
                                    </>
                                  ) : (
                                    'no score'
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-slate-500">
                        {shortlistDirty ? 'Unsaved changes.' : round.published ? 'Shortlisted teams can see this round.' : 'Teams cannot see this list until you publish.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => saveShortlist(round)}
                        disabled={busy[`shortlist-${round.number}`] || !shortlistDirty}
                        className="px-4 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                      >
                        {busy[`shortlist-${round.number}`] ? 'Saving...' : 'Save shortlist'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={addRound}
            disabled={busy.add}
            className="px-6 py-3 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
          >
            {busy.add ? 'Adding...' : `+ Add round ${lastNumber + 1}`}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
