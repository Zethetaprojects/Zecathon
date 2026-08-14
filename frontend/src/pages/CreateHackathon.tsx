import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Create hackathon</h1>
        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start date</label>
              <input
                name="start_date"
                type="datetime-local"
                value={form.start_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End date</label>
              <input
                name="end_date"
                type="datetime-local"
                value={form.end_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}
