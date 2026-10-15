import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon } from '../types';
import { formatError } from '../utils/formatError';
import { useConfirm } from '../hooks/useConfirm';
import PageLayout from '../components/PageLayout';
import DateTimeInput from '../components/DateTimeInput';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function resolveBannerUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/uploads/${path.split('/').pop()}`;
}

export default function EditHackathon() {
  const { id } = useParams<{ id: string }>();
  const hackathonId = Number(id);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: '',
    durationHours: '',
    maxParticipants: '',
    maxTeamMembers: '',
  });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    hackathonsApi
      .get(hackathonId)
      .then((res) => {
        const h = res.data;
        setHackathon(h);
        setForm({
          name: h.name || '',
          description: h.description || '',
          startDate: toDatetimeLocalValue(h.start_date),
          durationHours: h.duration_hours?.toString() || '',
          maxParticipants: h.max_participants?.toString() || '',
          maxTeamMembers: h.max_team_members?.toString() || '',
        });
        setPreviewUrl(resolveBannerUrl(h.banner_path));
      })
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBannerFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else if (hackathon) {
      setPreviewUrl(resolveBannerUrl(hackathon.banner_path));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const durationHours = parseInt(form.durationHours, 10);
    if (form.durationHours && (isNaN(durationHours) || durationHours <= 0)) {
      setError('Duration must be a positive number of hours.');
      setSaving(false);
      return;
    }
    const maxParticipants = form.maxParticipants ? parseInt(form.maxParticipants, 10) : undefined;
    const maxTeamMembers = form.maxTeamMembers ? parseInt(form.maxTeamMembers, 10) : undefined;
    if (form.maxParticipants && (isNaN(maxParticipants as number) || (maxParticipants as number) <= 0)) {
      setError('Max participants must be a positive number.');
      setSaving(false);
      return;
    }
    if (form.maxTeamMembers && (isNaN(maxTeamMembers as number) || (maxTeamMembers as number) <= 0)) {
      setError('Max team members must be a positive number.');
      setSaving(false);
      return;
    }

    // Summarise what will change and ask before saving, so edits are deliberate.
    const original = hackathon;
    const changes: string[] = [];
    if (original) {
      if (form.name.trim() !== (original.name || '')) changes.push(`Name → "${form.name.trim()}"`);
      if (form.description !== (original.description || '')) changes.push('Description updated');
      if (form.startDate !== toDatetimeLocalValue(original.start_date)) {
        changes.push(`Start → ${form.startDate ? new Date(form.startDate).toLocaleString() : 'not set'}`);
      }
      if (form.durationHours !== (original.duration_hours?.toString() || '')) changes.push(`Duration → ${form.durationHours || 'not set'} hours`);
      if (form.maxParticipants !== (original.max_participants?.toString() || '')) {
        changes.push(`Max participants → ${form.maxParticipants || 'no limit'}`);
      }
      if (form.maxTeamMembers !== (original.max_team_members?.toString() || '')) {
        changes.push(`Max team size → ${form.maxTeamMembers || 'no limit'}`);
      }
    }
    if (bannerFile) changes.push('New banner image');
    if (changes.length === 0) {
      setError('Nothing has changed.');
      setSaving(false);
      return;
    }
    const ok = await confirm({
      title: 'Save these changes?',
      message: (
        <>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          Participants see the changes immediately. Changing dates or limits during a live event can affect teams that already joined.
        </>
      ),
      confirmLabel: 'Save changes',
    });
    if (!ok) {
      setSaving(false);
      return;
    }

    try {
      const payload: any = { name: form.name.trim(), description: form.description };
      if (form.startDate) payload.start_date = new Date(form.startDate).toISOString();
      if (form.durationHours) payload.duration_hours = durationHours;
      // An empty limit field clears the limit (explicit null), instead of being ignored.
      payload.max_participants = maxParticipants ?? null;
      payload.max_team_members = maxTeamMembers ?? null;
      await hackathonsApi.update(hackathonId, payload);

      if (bannerFile) {
        const formData = new FormData();
        formData.append('file', bannerFile);
        await hackathonsApi.uploadBanner(hackathonId, formData);
      }

      navigate(`/hackathons/${hackathonId}`);
    } catch (err: any) {
      setError(formatError(err, 'Failed to update hackathon'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout className="flex items-center justify-center">
        <LoadingScreen message="Loading arena..." />
      </PageLayout>
    );
  }

  if (!hackathon) {
    return (
      <PageLayout className="px-4 py-8">
        <div className="max-w-4xl mx-auto glass-panel p-8 text-center">
          <h2 className="font-pixel text-lg text-neon-pink mb-2">MISSION NOT FOUND</h2>
          <p className="text-slate-300 mb-4">The hackathon you are looking for does not exist.</p>
          <BackButton to="/hackathons" label="Back to hackathons" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <BackButton to={`/hackathons/${hackathonId}`} label="Back to hackathon" />
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <h1 className="font-pixel text-lg text-white text-shadow-neon mb-2">EDIT HACKATHON</h1>
          <p className="text-slate-400 text-sm mb-6">Update the arena settings.</p>

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
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Start date & time</label>
                <DateTimeInput
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Duration (hours)</label>
                <input
                  name="durationHours"
                  type="number"
                  min={1}
                  value={form.durationHours}
                  onChange={handleChange}
                  required
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="e.g. 24"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Max participants</label>
                <input
                  name="maxParticipants"
                  type="number"
                  min={1}
                  value={form.maxParticipants}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="Overall limit (optional)"
                />
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Max team members</label>
                <input
                  name="maxTeamMembers"
                  type="number"
                  min={1}
                  value={form.maxTeamMembers}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="Per team limit (optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Banner image</label>
              <div className="relative h-40 rounded border border-white/10 bg-gradient-to-br from-space-900 to-slate-900 mb-3 overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Hackathon banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleBannerChange}
                className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-2">Recommended: 1200×400 px, landscape banner.</p>
            </div>

            <div className="pt-2 flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded neon-btn neon-btn-primary py-3 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <Link
                to={`/hackathons/${hackathonId}`}
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
