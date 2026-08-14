import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import PageLayout from '../components/PageLayout';

export default function CreateHackathon() {
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload: any = { name: form.name, description: form.description };
      if (form.start_date) payload.start_date = new Date(form.start_date).toISOString();
      if (form.end_date) payload.end_date = new Date(form.end_date).toISOString();
      await hackathonsApi.create(payload);
      navigate('/hackathons');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create hackathon');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/hackathons" className="text-neon-cyan hover:text-white text-sm transition">
            ← Back to hackathons
          </Link>
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
