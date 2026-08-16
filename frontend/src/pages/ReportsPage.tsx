import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import PageLayout from '../components/PageLayout';
import { HackathonReportSummary, HackathonReportDetail, TeamReportEntry } from '../types';
import { formatError } from '../utils/formatError';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-3 rounded bg-white/5">
      <p className="font-pixel text-sm text-neon-cyan">{value}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

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

function ReportCard({
  report,
  onClick,
  active,
}: {
  report: HackathonReportSummary;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full glass-panel p-5 border-l-4 transition hover:-translate-y-1 ${
        active ? 'border-neon-cyan' : 'border-white/10 hover:border-neon-cyan/50'
      }`}
    >
      <h3 className="font-pixel text-xs text-white mb-3">{report.name}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Problems" value={report.problem_statement_count} />
        <Stat label="Teams" value={report.team_count} />
        <Stat label="Submissions" value={report.submission_count} />
        <Stat label="Evaluated" value={report.evaluated_count} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Avg score: <span className="text-white font-semibold">{report.average_score ?? '-'}</span>
        </span>
        <span className="text-slate-400">
          Top: <span className="text-neon-pink font-semibold">{report.top_team_name ?? '-'} {report.top_team_score ?? ''}</span>
        </span>
      </div>
    </button>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<HackathonReportSummary[]>([]);
  const [detail, setDetail] = useState<HackathonReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail]);

  useEffect(() => {
    reportsApi
      .list()
      .then((res) => setReports(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load reports')))
      .finally(() => setLoading(false));
  }, []);

  const loadDetail = (id: number) => {
    setDetail(null);
    reportsApi
      .detail(id)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load report detail')));
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton to="/dashboard" label="Back to dashboard" />
        </div>
        <div className="mb-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">REPORTS</h1>
          <p className="text-slate-400 text-sm">Hackathon analytics for organisers and admins. Students only see leaderboards.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16">
            <LoadingScreen message="Loading reports..." />
          </div>
        ) : reports.length === 0 ? (
          <div
            className="glass-panel p-10 text-center cursor-pointer"
            data-egg-trigger="empty-state"
            data-egg-message="Still hopeful! +25 XP"
            data-egg-color="pink"
          >
            <p className="text-slate-300 text-sm">No hackathons to report on yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  active={detail?.id === report.id}
                  onClick={() => loadDetail(report.id)}
                />
              ))}
            </div>

            {detail && (
              <div className="glass-panel p-6 border-t-4 border-neon-cyan animate-slide-in-right">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h2 className="font-pixel text-sm text-white text-shadow-neon">{detail.name}</h2>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {detail.problem_statement_count} problem statements · {detail.team_count} teams · {detail.submission_count} submissions
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetail(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close detail
                  </button>
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
                  <h3 className="font-pixel text-[10px] text-neon-cyan mb-3 uppercase tracking-wider">Team entries</h3>
                  <div className="overflow-x-auto rounded border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-4 py-3">Problem</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Score</th>
                          <th className="px-4 py-3">Verdict</th>
                          <th className="px-4 py-3 text-right">Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.team_entries.map((entry: TeamReportEntry) => (
                          <tr key={entry.submission_id} className="border-t border-white/10 hover:bg-white/5 transition">
                            <td className="px-4 py-3 text-white font-semibold">{entry.team_name}</td>
                            <td className="px-4 py-3 text-slate-400">{entry.problem_statement_title}</td>
                            <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{entry.type}</td>
                            <td className="px-4 py-3 text-slate-400 uppercase text-[10px]">{entry.status}</td>
                            <td className="px-4 py-3 text-neon-cyan font-mono">
                              {entry.total_score ?? '-'}
                            </td>
                            <td className="px-4 py-3">
                              {entry.verdict ? <VerdictBadge verdict={entry.verdict} /> : <span className="text-slate-500">-</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {entry.submission_id && entry.total_score !== undefined ? (
                                <Link
                                  to={`/reports/submission/${entry.submission_id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold neon-btn neon-btn-cyan micro-lift micro-pop"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  View report
                                </Link>
                              ) : (
                                <span className="text-slate-500 text-[10px]">-</span>
                              )}
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
        )}
      </div>
    </PageLayout>
  );
}
