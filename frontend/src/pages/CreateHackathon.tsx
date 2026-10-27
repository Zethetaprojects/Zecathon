import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { hackathonsApi } from '../api/hackathons';
import { formatError } from '../utils/formatError';
import PageLayout from '../components/PageLayout';
import DateTimeInput from '../components/DateTimeInput';
import BackButton from '../components/BackButton';
import RubricEditor from '../components/RubricEditor';
import { DEFAULT_NON_TECH_RUBRIC, DEFAULT_TECH_RUBRIC, RubricRow, rowsToRubric } from '../utils/rubric';
import { addHoursToLocalValue, hackathonPath } from '../utils/hackathon';
import PartnerFields, { PartnerFormState, emptyPartner, partnerError } from '../components/PartnerFields';

export default function CreateHackathon() {
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
  // The deadline follows the hackathon end time until the organiser sets it themselves.
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [partner, setPartner] = useState<PartnerFormState>(emptyPartner);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [techCustom, setTechCustom] = useState(false);
  const [nonTechCustom, setNonTechCustom] = useState(false);
  const [techRows, setTechRows] = useState<RubricRow[]>([]);
  const [nonTechRows, setNonTechRows] = useState<RubricRow[]>([]);
  const [rubricError, setRubricError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    if (deadlineTouched) return;
    setForm((f) => ({ ...f, deadline: addHoursToLocalValue(f.startDate, parseInt(f.durationHours, 10)) }));
  }, [form.startDate, form.durationHours, deadlineTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRubricError('');
    setBusy(true);

    const techResult = techCustom ? rowsToRubric(techRows, 'Tech') : {};
    const nonTechResult = nonTechCustom ? rowsToRubric(nonTechRows, 'Non-tech') : {};
    const rubricProblem = techResult.error || nonTechResult.error;
    if (rubricProblem) {
      setRubricError(rubricProblem);
      setBusy(false);
      return;
    }
    const tech = techResult.rubric;
    const nonTech = nonTechResult.rubric;

    const durationHours = parseInt(form.durationHours, 10);
    if (form.durationHours && (isNaN(durationHours) || durationHours <= 0)) {
      setError('Duration must be a positive number of hours.');
      setBusy(false);
      return;
    }

    const maxParticipants = form.maxParticipants ? parseInt(form.maxParticipants, 10) : undefined;
    if (form.maxParticipants && (isNaN(maxParticipants as number) || (maxParticipants as number) < 1)) {
      setError('Overall participant limit must be at least 1.');
      setBusy(false);
      return;
    }

    const maxTeamMembers = form.maxTeamMembers ? parseInt(form.maxTeamMembers, 10) : undefined;
    if (form.maxTeamMembers && (isNaN(maxTeamMembers as number) || (maxTeamMembers as number) < 1)) {
      setError('Team member limit must be at least 1.');
      setBusy(false);
      return;
    }

    if (form.deadline && form.startDate && new Date(form.deadline) <= new Date(form.startDate)) {
      setError('The submission deadline must be after the start time.');
      setBusy(false);
      return;
    }

    const partnerProblem = partnerError(partner);
    if (partnerProblem) {
      setError(partnerProblem);
      setBusy(false);
      return;
    }

    try {
      const payload: any = { name: form.name, description: form.description };
      if (form.startDate) payload.start_date = new Date(form.startDate).toISOString();
      if (form.durationHours) payload.duration_hours = durationHours;
      if (maxParticipants !== undefined) payload.max_participants = maxParticipants;
      if (maxTeamMembers !== undefined) payload.max_team_members = maxTeamMembers;
      if (form.deadline) payload.submission_deadline = new Date(form.deadline).toISOString();
      if (form.guidelines.trim()) payload.submission_guidelines = form.guidelines.trim();
      payload.one_statement_per_team = form.oneTrack;
      if (partner.hasPartner) {
        payload.partner_name = partner.name.trim();
        payload.partner_slug = partner.slug;
        if (partner.website.trim()) payload.partner_website = partner.website.trim();
      }
      if (tech || nonTech) {
        payload.rubric = {};
        if (tech) payload.rubric.tech = tech;
        if (nonTech) payload.rubric.non_tech = nonTech;
      }
      const res = await hackathonsApi.create(payload);
      const hackathon = res.data;

      if (bannerFile && hackathon.id) {
        const bannerForm = new FormData();
        bannerForm.append('file', bannerFile);
        await hackathonsApi.uploadBanner(hackathon.id, bannerForm);
      }

      if (partner.hasPartner && partner.logo && hackathon.id) {
        const logoForm = new FormData();
        logoForm.append('file', partner.logo);
        await hackathonsApi.uploadPartnerLogo(hackathon.id, logoForm);
      }

      navigate(hackathonPath(hackathon));
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

            <PartnerFields value={partner} onChange={setPartner} numberHint="(next number)" />

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

            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Banner image</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-300 file:mr-4 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-2">Recommended: 1200×400 px, landscape banner.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Overall participant limit</label>
                <input
                  name="maxParticipants"
                  type="number"
                  min={1}
                  value={form.maxParticipants}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="Leave blank for no limit"
                />
                <p className="text-[10px] text-slate-500 mt-1">Maximum total members across all teams.</p>
              </div>
              <div>
                <label className="block text-xs pixel-caps text-slate-300 mb-2">Max members per team</label>
                <input
                  name="maxTeamMembers"
                  type="number"
                  min={1}
                  value={form.maxTeamMembers}
                  onChange={handleChange}
                  className="w-full rounded px-4 py-3 neon-input"
                  placeholder="Leave blank for no limit"
                />
                <p className="text-[10px] text-slate-500 mt-1">Includes the team leader.</p>
              </div>
            </div>

            {/* Advanced rubric editor */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-neon-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h2 className="font-pixel text-[10px] text-white uppercase tracking-widest">Scoring rubric (optional)</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                By default submissions are scored on the platform rubric. Tick "Custom rubric" to choose your own categories;
                each rubric must total 1000 points. You can change this later from the hackathon page.
              </p>

              {rubricError && (
                <div className="mb-4 px-4 py-3 rounded bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm">
                  {rubricError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RubricEditor
                  label="Tech submissions"
                  custom={techCustom}
                  onCustomChange={setTechCustom}
                  rows={techRows}
                  onRowsChange={setTechRows}
                  defaults={DEFAULT_TECH_RUBRIC}
                />
                <RubricEditor
                  label="Non-tech submissions"
                  custom={nonTechCustom}
                  onCustomChange={setNonTechCustom}
                  rows={nonTechRows}
                  onRowsChange={setNonTechRows}
                  defaults={DEFAULT_NON_TECH_RUBRIC}
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
