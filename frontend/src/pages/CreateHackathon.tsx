import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import BackButton from '../components/BackButton';

function parseRubricJson(value: string): Record<string, number> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] !== 'number') return null;
    }
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

export default function CreateHackathon() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
  });
  const [techRubric, setTechRubric] = useState('');
  const [nonTechRubric, setNonTechRubric] = useState('');
  const [rubricError, setRubricError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRubricError('');
    setBusy(true);

    const tech = parseRubricJson(techRubric);
    const nonTech = parseRubricJson(nonTechRubric);

    if ((techRubric.trim() && tech === null) || (nonTechRubric.trim() && nonTech === null)) {
      setRubricError('Rubric JSON must be an object mapping category names to numeric scores.');
      setBusy(false);
      return;
    }

    try {
      const payload: any = { name: form.name, description: form.description };
      if (form.start_date) payload.start_date = new Date(form.start_date).toISOString();
      if (form.end_date) payload.end_date = new Date(form.end_date).toISOString();
      if (tech || nonTech) {
        payload.rubric = {};
        if (tech) payload.rubric.tech = tech;
        if (nonTech) payload.rubric.non_tech = nonTech;
      }
      await hackathonsApi.create(payload);
      navigate('/hackathons');
    } catch (err: any) {
      setError(formatError(err, 'Failed to create hackathon'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">NEW HACKATHON</h1>
          <p className="text-slate-400 text-sm mb-6">Configure the arena before teams enter.</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full rounded px-4 py-3 neon-input"
                placeholder="e.g. ZECATHON 2026"
              />
            </div>

            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded px-4 py-3 neon-input"
                placeholder="What is this hackathon about?"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Start date</label>
                <input
                  name="start_date"
                  type="datetime-local"
                  value={form.start_date}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">End date</label>
                <input
                  name="end_date"
                  type="datetime-local"
                  value={form.end_date}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                />
              </div>
            </div>

            {/* Advanced rubric editor */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-neon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h2 className="font-pixel text-[10px] text-white uppercase tracking-widest">Advanced rubric (optional)</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Override default scoring rubrics by providing JSON objects mapping category names to max points.
                Leave blank to use platform defaults.
              </p>

              {rubricError && (
                <div className="mb-4 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
                  {rubricError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">
                    Tech rubric <span className="text-slate-500 normal-case">JSON</span>
                  </label>
                  <textarea
                    value={techRubric}
                    onChange={(e) => setTechRubric(e.target.value)}
                    rows={5}
                    className="w-full rounded px-4 py-3 neon-input font-mono text-xs"
                    placeholder='{"Problem Understanding": 150, ...}'
                  />
                </div>
                <div>
                  <label className="block text-xs pixel-caps text-slate-300 mb-2">
                    Non-tech rubric <span className="text-slate-500 normal-case">JSON</span>
                  </label>
                  <textarea
                    value={nonTechRubric}
                    onChange={(e) => setNonTechRubric(e.target.value)}
                    rows={5}
                    className="w-full rounded px-4 py-3 neon-input font-mono text-xs"
                    placeholder='{"Research & Analysis": 150, ...}'
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-4">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded neon-btn neon-btn-primary py-3 text-sm disabled:opacity-50"
              >
                {busy ? 'Creating...' : 'Create hackathon'}
              </button>
              <Link
                to="/hackathons"
                className="px-6 py-3 rounded neon-btn neon-btn-ghost text-sm"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
