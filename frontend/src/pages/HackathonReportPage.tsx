import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import PageLayout from '../components/PageLayout';
import { HackathonReportDetail, TeamReportEntry, isFallbackScore } from '../types';
import { formatError } from '../utils/formatError';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';
import { safeFileName, saveBlob, uploadUrl } from '../utils/download';

function VerdictBadge({ verdict }: { verdict: string }) {
  const color =
    verdict === 'OUTSTANDING'
      ? 'text-neon-cyan'
      : verdict === 'EXCELLENT'
      ? 'text-neon-purple'
      : verdict === 'SATISFACTORY'
      ? 'text-neon-yellow'
      : 'text-slate-400';
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold ${color}`}>
      {verdict}
    </span>
  );
}

function MiniBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>{label}</span>
        <span>
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-pink to-neon-purple transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** One hackathon's report: summary, verdicts and every team entry ranked by score. */
export default function HackathonReportPage() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const [detail, setDetail] = useState<HackathonReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  // Kept in the address so the filter survives opening a team report and coming back.
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewOnly = searchParams.get('review') === '1';
  const setReviewOnly = (on: boolean) => setSearchParams(on ? { review: '1' } : {}, { replace: true });

  useEffect(() => {
    setLoading(true);
    reportsApi
      .detail(hackathonId)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load the report')))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  // Highest score first; entries that are not scored yet go last.
  const entries = useMemo(
    () =>
      [...(detail?.team_entries ?? [])].sort((a, b) => {
        if (a.total_score == null && b.total_score == null) return a.team_name.localeCompare(b.team_name);
        if (a.total_score == null) return 1;
        if (b.total_score == null) return -1;
        return b.total_score - a.total_score;
      }),
    [detail],
  );
  // Rank among scored entries, kept when the list is filtered.
  const rank = useMemo(() => {
    const map = new Map<number, number>();
    entries.filter((e) => e.total_score != null).forEach((e, i) => map.set(e.submission_id, i + 1));
    return map;
  }, [entries]);
  const reviewCount = entries.filter((e) => e.needs_review).length;
  const shown = reviewOnly ? entries.filter((e) => e.needs_review) : entries;
  const multiRound = entries.some((e) => (e.round_number ?? 1) > 1);

  const download = async (key: string, request: () => Promise<{ data: BlobPart }>, filename: string) => {
    setDownloading(key);
    setError('');
    try {
      const res = await request();
      saveBlob(res.data, filename);
    } catch (err) {
      setError(formatError(err, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton to="/reports" label="Back to reports" />
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16">
            <LoadingScreen message="Loading report..." />
          </div>
        ) : !detail ? (
          <div className="glass-panel p-10 text-center text-slate-300 text-sm">This report could not be loaded.</div>
        ) : (
        <div className="glass-panel p-6 border-t-4 border-neon-cyan">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="font-pixel text-sm text-white text-shadow-neon">{detail.name}</h2>
              <p className="text-[10px] text-slate-400 mt-1">
                {detail.problem_statement_count} problem statements · {detail.team_count} teams · {detail.submission_count} submissions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded bg-white/5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Average score</p>
              <p className="font-pixel text-lg text-neon-cyan mt-1">{detail.average_score ?? '-'}</p>
            </div>
            <div className="p-4 rounded bg-white/5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Top team</p>
              <p className="font-pixel text-sm text-white mt-1">{detail.top_team_name ?? '-'}</p>
              <p className="text-xs text-neon-pink">{detail.top_team_score ?? ''}</p>
            </div>
            <div className="p-4 rounded bg-white/5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Evaluated</p>
              <p className="font-pixel text-lg text-neon-cyan mt-1">
                {detail.evaluated_count} / {detail.submission_count}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-pixel text-[10px] text-neon-purple mb-3 uppercase tracking-wider">Verdict breakdown</h3>
              {Object.keys(detail.verdict_breakdown).length === 0 ? (
                <p className="text-xs text-slate-500">No evaluations yet.</p>
              ) : (
                Object.entries(detail.verdict_breakdown).map(([verdict, count]) => (
                  <MiniBar key={verdict} label={verdict} value={count} total={detail.evaluated_count} />
                ))
              )}
            </div>
            <div>
              <h3 className="font-pixel text-[10px] text-neon-purple mb-3 uppercase tracking-wider">Submission type</h3>
              {Object.entries(detail.type_breakdown).map(([type, count]) => (
                <MiniBar key={type} label={type} value={count} total={detail.submission_count} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-pixel text-[10px] text-neon-cyan mb-1 uppercase tracking-wider">Team entries</h3>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-[11px] text-slate-500">
                Sorted by score, highest first. "Statement" downloads the problem statement the team worked on.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewOnly}
                  onChange={(e) => setReviewOnly(e.target.checked)}
                  className="accent-[#f7ff58]"
                />
                Only needs review ({reviewCount})
              </label>
            </div>
            <div className="overflow-x-auto rounded border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Team</th>
                    {multiRound && <th className="px-4 py-3">Round</th>}
                    <th className="px-4 py-3">Problem</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3 text-right">Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={multiRound ? 9 : 8} className="px-4 py-6 text-center text-xs text-slate-500">
                        No submissions need review.
                      </td>
                    </tr>
                  )}
                  {shown.map((entry: TeamReportEntry) => (
                    <tr key={entry.submission_id} className="border-t border-white/10 hover:bg-white/5 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {rank.get(entry.submission_id) ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">{entry.team_name}</td>
                      {multiRound && <td className="px-4 py-3 text-slate-400 text-xs">R{entry.round_number ?? 1}</td>}
                      <td className="px-4 py-3 text-slate-400">{entry.problem_statement_title}</td>
                      <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{entry.type}</td>
                      <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{entry.status}</td>
                      <td className="px-4 py-3 text-neon-cyan font-mono">
                        {entry.total_score ?? '-'}
                        {isFallbackScore(entry.llm_source) && (
                          <span
                            title="Not a real AI score. Re-run the evaluation from the teams page."
                            className="ml-2 font-sans text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/30"
                          >
                            Fallback
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.verdict ? <VerdictBadge verdict={entry.verdict} /> : <span className="text-slate-500">-</span>}
                        {entry.needs_review && (
                          <span
                            title="The evaluator asks a judge to check this score: open the report and see Review flags."
                            className="block w-fit mt-1 text-[10px] px-1.5 py-0.5 rounded bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30 whitespace-nowrap"
                          >
                            Needs review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            download(
                              `ps-${entry.submission_id}`,
                              () => reportsApi.problemStatementPdf(entry.problem_statement_id),
                              `${safeFileName(entry.problem_statement_title, 'problem-statement')}.pdf`,
                            )
                          }
                          disabled={downloading === `ps-${entry.submission_id}`}
                          title={`Download "${entry.problem_statement_title}"`}
                          className="px-2.5 py-1.5 rounded text-[10px] font-semibold border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 transition disabled:opacity-50"
                        >
                          {downloading === `ps-${entry.submission_id}` ? '...' : 'Statement'}
                        </button>
                        {entry.problem_statement_file && (
                          <a
                            href={uploadUrl(entry.problem_statement_file)}
                            target="_blank"
                            rel="noreferrer"
                            title="The brief file the organisers attached"
                            className="px-2.5 py-1.5 rounded text-[10px] font-semibold border border-white/15 text-slate-300 hover:text-white transition"
                          >
                            Brief
                          </a>
                        )}
                        {entry.submission_id && entry.total_score != null && (
                          <button
                            type="button"
                            onClick={() =>
                              download(
                                `pdf-${entry.submission_id}`,
                                () => reportsApi.downloadPdf(entry.submission_id),
                                `${safeFileName(entry.team_name, 'team')}-report.pdf`,
                              )
                            }
                            disabled={downloading === `pdf-${entry.submission_id}`}
                            className="px-2.5 py-1.5 rounded text-[10px] font-semibold border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 transition disabled:opacity-50"
                          >
                            {downloading === `pdf-${entry.submission_id}` ? '...' : 'PDF'}
                          </button>
                        )}
                        {entry.submission_id && entry.total_score != null ? (
                          <Link
                            to={`/reports/submission/${entry.submission_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold neon-btn neon-btn-cyan micro-lift micro-pop"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View report
                          </Link>
                        ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </div>
    </PageLayout>
  );
}
