import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import PageLayout from '../components/PageLayout';
import { HackathonReportSummary } from '../types';
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

function ReportCard({ report }: { report: HackathonReportSummary }) {
  return (
    <Link
      to={`/reports/hackathon/${report.id}`}
      className="block text-left w-full glass-panel p-5 border-l-4 transition hover:-translate-y-1 border-white/10 hover:border-neon-cyan/50"
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
      <p className="mt-3 text-[11px] text-neon-cyan">Open team results →</p>
    </Link>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<HackathonReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .list()
      .then((res) => setReports(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load reports')))
      .finally(() => setLoading(false));
  }, []);

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
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
