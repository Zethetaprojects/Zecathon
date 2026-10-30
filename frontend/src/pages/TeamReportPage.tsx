import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { judgeApi } from '../api/rounds';
import { useAuth } from '../hooks/useAuth';
import { SubmissionReport } from '../types';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import EvaluationReport from '../components/EvaluationReport';
import LoadingScreen from '../components/LoadingScreen';
import { safeFileName, saveBlob, uploadUrl } from '../utils/download';
import { formatDateTime } from '../utils/hackathon';
import SubmissionLinks, { submissionLinks } from '../components/SubmissionLinks';

export default function TeamReportPage() {
  const { id } = useParams<{ id: string }>();
  const submissionId = Number(id);
  const navigate = useNavigate();
  const [report, setReport] = useState<SubmissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const { can } = useAuth();
  const canReview = can('evaluate_submission');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const resolveReview = async (reopen = false) => {
    if (!report) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      const { data } = reopen
        ? await judgeApi.reopenReview(report.id)
        : await judgeApi.resolveReview(report.id, reviewNote.trim());
      setReport({ ...report, evaluation: data });
      setReviewNote('');
    } catch (err) {
      setReviewError(formatError(err, 'Could not save the review'));
    } finally {
      setReviewBusy(false);
    }
  };

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

        <section className="glass-panel p-5 sm:p-6 mb-6 border border-neon-cyan/20">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[10px] uppercase tracking-wider text-neon-cyan">What the team submitted</h2>
              <p className="text-xs text-slate-400 mt-1">
                {report.type === 'tech' ? 'Code project' : 'Document'}
                {report.round_number && report.round_number > 1 ? ` · round ${report.round_number}` : ''} · submitted{' '}
                {formatDateTime(report.created_at)}
              </p>
            </div>
          </div>
          <SubmissionLinks submission={report} size="md" />
          {(() => {
            // Documents and slides saved as PDF can be read right here.
            const pdfs = submissionLinks(report).filter((l) => l.kind !== 'repo' && l.kind !== 'link' && /\.pdf$/i.test(l.href));
            if (pdfs.length === 0) return null;
            return (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {pdfs.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => setPreview(preview === l.href ? null : l.href)}
                      className="px-3 py-1.5 rounded text-xs border border-white/15 text-slate-300 hover:text-white transition"
                    >
                      {preview === l.href ? 'Hide preview' : `Preview ${l.label.toLowerCase()} here`}
                    </button>
                  ))}
                </div>
                {preview && (
                  <iframe
                    src={preview}
                    title="Submission preview"
                    className="mt-3 w-full h-[75vh] rounded border border-white/10 bg-white"
                  />
                )}
              </div>
            );
          })()}
        </section>

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

        {report.evaluation && canReview && (report.evaluation.needs_review || report.evaluation.review_note) && (
          <section
            className={`glass-panel p-5 sm:p-6 mb-6 border ${
              report.evaluation.review_note ? 'border-green-400/30' : 'border-neon-yellow/40'
            }`}
          >
            {report.evaluation.review_note ? (
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-[10px] uppercase tracking-wider text-green-400 mb-2">Reviewed by a judge</h2>
                  <p className="text-sm text-slate-200 whitespace-pre-line">{report.evaluation.review_note}</p>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {report.evaluation.reviewed_by ?? 'A judge'}
                    {report.evaluation.reviewed_at ? ` · ${formatDateTime(report.evaluation.reviewed_at)}` : ''} · visible to judges and
                    organisers only
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resolveReview(true)}
                  disabled={reviewBusy}
                  className="px-3 py-1.5 rounded text-xs border border-white/15 text-slate-300 hover:text-neon-pink whitespace-nowrap disabled:opacity-50"
                >
                  Reopen review
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  resolveReview();
                }}
              >
                <h2 className="text-[10px] uppercase tracking-wider text-neon-yellow mb-2">Needs review</h2>
                <p className="text-xs text-slate-400 mb-3">
                  The evaluator flagged this score for a human check (see Review flags below). Note what you checked and your
                  conclusion; the note is shown to judges and organisers only, and the flag is cleared. To change the score,
                  add a judge mark on the teams page or re-run the evaluation.
                </p>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. Checked the repository: the commits are genuine and the low score reflects missing features. Score stands."
                  className="w-full rounded px-3 py-2 neon-input text-sm"
                />
                {reviewError && <p className="text-xs text-neon-pink mt-2">{reviewError}</p>}
                <button
                  type="submit"
                  disabled={reviewBusy || reviewNote.trim().length < 3}
                  className="mt-3 px-4 py-2 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50"
                >
                  {reviewBusy ? 'Saving...' : 'Mark as reviewed'}
                </button>
              </form>
            )}
          </section>
        )}

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
