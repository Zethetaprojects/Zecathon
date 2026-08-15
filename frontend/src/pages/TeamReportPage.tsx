import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { SubmissionReport } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import EvaluationReport from '../components/EvaluationReport';

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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading report...</p>
        </div>
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
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded neon-btn neon-btn-cyan text-xs micro-lift micro-pop"
          >
            Download / Print PDF
          </button>
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
