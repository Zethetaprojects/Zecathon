import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { Hackathon } from '../types';
import { formatError } from '../utils/formatError';
import { useConfirm } from '../hooks/useConfirm';
import { addHoursToLocalValue, formatDateTime, hackathonPath, toDatetimeLocalValue } from '../utils/hackathon';
import PartnerFields, { PartnerFormState, emptyPartner, partnerError } from '../components/PartnerFields';
import PageLayout from '../components/PageLayout';
import DateTimeInput from '../components/DateTimeInput';
import BackButton from '../components/BackButton';
import LoadingScreen from '../components/LoadingScreen';

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
    deadline: '',
    guidelines: '',
    oneTrack: false,
  });
  // Editing never auto-fills the deadline; the field only changes when the organiser edits it.
  const [, setDeadlineTouched] = useState(true);
  const [partner, setPartner] = useState<PartnerFormState>(emptyPartner);
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
          deadline: toDatetimeLocalValue(h.submission_deadline),
          guidelines: h.submission_guidelines || '',
          oneTrack: Boolean(h.one_statement_per_team),
        });
        setPartner({
          hasPartner: Boolean(h.partner_name),
          name: h.partner_name || '',
          slug: h.partner_slug || '',
          slugTouched: Boolean(h.partner_slug),
          website: h.partner_website || '',
          logo: null,
        });
        setPreviewUrl(resolveBannerUrl(h.banner_path));
      })
      .catch((err) => setError(formatError(err, 'Failed to load hackathon')))
      .finally(() => setLoading(false));
  }, [hackathonId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
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
      if (form.deadline !== toDatetimeLocalValue(original.submission_deadline)) {
        changes.push(`Submission deadline → ${form.deadline ? formatDateTime(new Date(form.deadline).toISOString()) : 'no deadline'}`);
      }
      if (form.guidelines.trim() !== (original.submission_guidelines || '')) changes.push('Submission guidelines updated');
      if (form.oneTrack !== Boolean(original.one_statement_per_team)) {
        changes.push(`One problem statement per team → ${form.oneTrack ? 'on' : 'off'}`);
      }
    }
    if (bannerFile) changes.push('New banner image');
    if (original) {
      const before = original.partner_name || '';
      const after = partner.hasPartner ? partner.name.trim() : '';
      if (before !== after) changes.push(after ? `Partner → ${after}` : 'Partner removed');
      if (partner.hasPartner && partner.slug !== (original.partner_slug || '')) {
        changes.push(`Page address → /hackathons/${partner.slug}/… (old links to the previous partner address stop working)`);
      }
      if (partner.hasPartner && partner.website.trim() !== (original.partner_website || '')) changes.push('Partner website updated');
      if (partner.hasPartner && partner.logo) changes.push('New partner logo');
    }
    const partnerProblem = partnerError(partner);
    if (partnerProblem) {
      setError(partnerProblem);
      setSaving(false);
      return;
    }
    if (form.deadline && form.startDate && new Date(form.deadline) <= new Date(form.startDate)) {
      setError('The submission deadline must be after the start time.');
      setSaving(false);
      return;
    }
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
      payload.submission_deadline = form.deadline ? new Date(form.deadline).toISOString() : null;
      payload.submission_guidelines = form.guidelines.trim() || null;
      payload.one_statement_per_team = form.oneTrack;
      if (partner.hasPartner) {
        payload.partner_name = partner.name.trim();
        payload.partner_slug = partner.slug;
        payload.partner_website = partner.website.trim() || null;
      } else {
        payload.partner_name = null;
      }
      const { data: updated } = await hackathonsApi.update(hackathonId, payload);
      if (partner.hasPartner && partner.logo) {
        const logoForm = new FormData();
        logoForm.append('file', partner.logo);
        await hackathonsApi.uploadPartnerLogo(hackathonId, logoForm);
      }

      if (bannerFile) {
        const formData = new FormData();
        formData.append('file', bannerFile);
        await hackathonsApi.uploadBanner(hackathonId, formData);
      }

      navigate(hackathonPath(updated));
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
                placeholder="e.g. ZECKATHON 2026"
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

            <PartnerFields
              value={partner}
              onChange={setPartner}
              numberHint={
                hackathon?.partner_number && partner.slug === hackathon.partner_slug ? String(hackathon.partner_number) : '(next number)'
              }
              hasExistingLogo={Boolean(hackathon?.partner_logo_path)}
            />

            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Submission guidelines (shown to teams)</label>
              <textarea
                name="guidelines"
                value={form.guidelines}
                onChange={handleChange}
                rows={6}
                maxLength={10000}
                className="w-full rounded px-4 py-3 neon-input text-sm"
                placeholder={'e.g.\n• Upload your report PDF (max 8 pages) as the project document.\n• Paste your GitHub repository link in "Supporting GitHub URL".\n• Put your demo video link on page 1 of the report.'}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Shown on the hackathon and submit pages below the automatic key rules (deadline, file types, one submission per
                statement). Teams must tick that they have read them before submitting.
              </p>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-black/20 cursor-pointer">
              <input
                type="checkbox"
                checked={form.oneTrack}
                onChange={(e) => setForm((f) => ({ ...f, oneTrack: e.target.checked }))}
                className="mt-1 accent-[#05d9e8]"
              />
              <span className="text-sm text-slate-200">
                One problem statement per team
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  A team's first submission fixes its track; it cannot submit to the other statements.
                </span>
              </span>
            </label>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-xs pixel-caps text-slate-300">Submission deadline</label>
                {form.deadline && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeadlineTouched(true);
                      setForm((f) => ({ ...f, deadline: '' }));
                    }}
                    className="text-[11px] text-slate-400 hover:text-neon-pink"
                  >
                    No deadline
                  </button>
                )}
              </div>
              <DateTimeInput
                name="deadline"
                value={form.deadline}
                onChange={(e) => {
                  setDeadlineTouched(true);
                  handleChange(e);
                }}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                {form.deadline
                  ? 'Participants cannot submit after this time (your local time zone). Organisers can still submit late on a team\'s behalf.'
                  : 'No deadline: teams can submit at any time.'}
              </p>
            </div>
            {!form.deadline && form.startDate && form.durationHours && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, deadline: addHoursToLocalValue(f.startDate, parseInt(f.durationHours, 10)) }))
                }
                className="-mt-2 text-[11px] text-neon-cyan hover:text-white"
              >
                Set the deadline to the hackathon end time
              </button>
            )}
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
