import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { SubmissionReport } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import EvaluationReport from '../components/EvaluationReport';
import LoadingScreen from '../components/LoadingScreen';
import { safeFileName, saveBlob, uploadUrl } from '../utils/download';

export default function TeamReportPage() {
  const { id } = useParams<{ id: string }>();
  const submissionId = Number(id);
  const navigate = useNavigate();
  const [report, setReport] = useState<SubmissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .submission(submissionId)
      .then((res) => setReport(res.data))
      .catch((err) => setError(formatError(err, 'Failed to load report')))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    try {
      const response = await reportsApi.downloadPdf(submissionId);
      saveBlob(response.data, `${safeFileName(report.team_name, 'team')}-report.pdf`);
    } catch (err) {
      setError(formatError(err, 'Failed to download PDF'));
    }
  };

  const handleDownloadStatement = async () => {
    if (!report) return;
    try {
      const response = await reportsApi.problemStatementPdf(report.problem_statement_id);
      saveBlob(response.data, `${safeFileName(report.problem_statement_title, 'problem-statement')}.pdf`);
    } catch (err) {
      setError(formatError(err, 'Failed to download the problem statement'));
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading report..." />
      </PageLayout>
    );
  }

  if (error || !report) {
    return (
      <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">REPORT NOT FOUND</h2>
          <p className="text-slate-300 mb-4">{error || 'This report could not be loaded.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-neon-cyan hover:text-white text-sm transition"
          >
            ← Go back
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print">
          <div className="mb-4 sm:mb-0">
            <button
              onClick={() => navigate(-1)}
              className="text-neon-cyan hover:text-white text-sm transition"
            >
              ← Back
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadStatement}
              className="px-5 py-2.5 rounded neon-btn neon-btn-ghost text-xs micro-lift micro-pop"
            >
              Problem statement PDF
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs micro-lift micro-pop"
            >
              Download report PDF
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 sm:p-8 border border-neon-cyan/20 mb-6 print-header">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Hackathon Evaluation Report</p>
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-4">
            {report.hackathon_name || 'Hackathon'}
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Team</span>
              <span className="text-white font-semibold">{report.team_name}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Problem statement</span>
              <span className="text-white">{report.problem_statement_title}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Submission type</span>
              <span className="text-white capitalize">{report.type.replace('_', '-')}</span>
            </div>
          </div>
        </div>

        <details className="glass-panel p-5 sm:p-6 mb-6 border border-neon-purple/20 group">
          <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-white">
              <span className="text-[10px] uppercase tracking-wider text-neon-purple mr-2">Problem statement</span>
              {report.problem_statement_title}
            </span>
            <span className="text-[11px] text-slate-400 group-open:hidden">Show</span>
          </summary>
          <div className="mt-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {report.problem_statement_description?.trim() || 'No written description was provided for this statement.'}
          </div>
          {report.problem_statement_file && (
            <a
              href={uploadUrl(report.problem_statement_file)}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-4 text-xs text-neon-cyan hover:text-white"
            >
              Open the attached brief →
            </a>
          )}
        </details>

        {report.evaluation ? (
          <EvaluationReport evaluation={report.evaluation} />
        ) : (
          <div className="glass-panel p-8 text-center">
            <p className="text-slate-300">This submission has not been evaluated yet.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
