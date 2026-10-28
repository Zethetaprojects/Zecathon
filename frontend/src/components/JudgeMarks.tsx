import { useState } from 'react';
import { judgeApi } from '../api/rounds';
import { JudgeScore } from '../types';
import { formatError } from '../utils/formatError';

/**
 * Judges' marks for one submission: the average so far, and a small form for the
 * current user's own mark out of 1000 (one mark per judge, replaceable).
 */
export default function JudgeMarks({
  submissionId,
  marks,
  userId,
  onChanged,
}: {
  submissionId: number;
  marks: JudgeScore[];
  userId?: number;
  onChanged: () => void;
}) {
  const mine = marks.find((m) => m.judge_id === userId);
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(mine ? String(mine.score) : '');
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const average = marks.length ? Math.round(marks.reduce((sum, m) => sum + m.score, 0) / marks.length) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(score);
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      setError('Enter a whole number from 0 to 1000.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await judgeApi.set(submissionId, value, comment.trim());
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(formatError(err, 'Could not save the mark'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await judgeApi.remove(submissionId);
      setScore('');
      setComment('');
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(formatError(err, 'Could not remove the mark'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-3 py-1.5 rounded-lg text-xs border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 transition"
        >
          {mine ? `Your mark: ${mine.score}` : 'Add judge mark'}
        </button>
        {average !== null && (
          <span
            className="text-[11px] text-slate-400"
            title={marks.map((m) => `${m.judge_username ?? 'judge'}: ${m.score}${m.comment ? ` — ${m.comment}` : ''}`).join('\n')}
          >
            Judges avg <span className="text-white font-semibold">{average}</span> ({marks.length})
          </span>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-2 p-3 rounded-lg bg-black/30 border border-neon-purple/30 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-300" htmlFor={`mark-${submissionId}`}>
              Mark out of 1000
            </label>
            <input
              id={`mark-${submissionId}`}
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              className="w-20 rounded px-2 py-1 neon-input text-sm text-center"
              autoFocus
            />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Optional note for the other judges"
            className="w-full rounded px-3 py-2 neon-input text-xs"
          />
          {error && <p className="text-xs text-neon-pink">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="px-3 py-1.5 rounded neon-btn neon-btn-primary text-xs disabled:opacity-50">
              {busy ? 'Saving...' : 'Save mark'}
            </button>
            {mine && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="px-3 py-1.5 rounded text-xs text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/10 transition disabled:opacity-50"
              >
                Remove my mark
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
