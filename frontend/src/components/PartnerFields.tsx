import { slugify } from '../utils/hackathon';

export interface PartnerFormState {
  hasPartner: boolean;
  name: string;
  slug: string;
  /** Once the organiser edits the URL name it no longer follows the partner name. */
  slugTouched: boolean;
  website: string;
  logo: File | null;
}

export const emptyPartner: PartnerFormState = {
  hasPartner: false,
  name: '',
  slug: '',
  slugTouched: false,
  website: '',
  logo: null,
};

export function partnerError(p: PartnerFormState): string {
  if (!p.hasPartner) return '';
  if (!p.name.trim()) return 'Enter the partner name, or untick "This hackathon has a partner".';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || p.slug.length < 2) {
    return 'The partner URL name can only use lowercase letters, digits and single hyphens, e.g. iit-patna.';
  }
  if (p.website.trim() && !/^https?:\/\/\S+\.\S+/.test(p.website.trim())) {
    return 'The partner website must be a full link starting with https://';
  }
  return '';
}

/**
 * Partner section of the create/edit hackathon forms. `numberHint` is the number in
 * the URL preview (the existing number when editing, otherwise the next one).
 */
export default function PartnerFields({
  value,
  onChange,
  numberHint,
  hasExistingLogo = false,
}: {
  value: PartnerFormState;
  onChange: (next: PartnerFormState) => void;
  numberHint: string;
  hasExistingLogo?: boolean;
}) {
  const set = (patch: Partial<PartnerFormState>) => onChange({ ...value, ...patch });
  const previewSlug = value.slug || 'partner-name';

  return (
    <div className="p-4 rounded-xl border border-neon-cyan/25 bg-neon-cyan/[0.03] space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.hasPartner}
          onChange={(e) => set({ hasPartner: e.target.checked })}
          className="mt-1 accent-[#05d9e8]"
        />
        <span className="text-sm text-slate-200">
          This hackathon has a partner (e.g. a college)
          <span className="block text-[11px] text-slate-400 mt-0.5">
            The partner is highlighted on the page and cards, and the hackathon gets its own address.
          </span>
        </span>
      </label>

      {value.hasPartner && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">Partner name</label>
              <input
                value={value.name}
                onChange={(e) =>
                  set({ name: e.target.value, ...(value.slugTouched ? {} : { slug: slugify(e.target.value) }) })
                }
                maxLength={100}
                className="w-full rounded px-4 py-3 neon-input"
                placeholder="e.g. IIT Patna Quant Club"
              />
            </div>
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">URL name</label>
              <input
                value={value.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''), slugTouched: true })}
                maxLength={50}
                className="w-full rounded px-4 py-3 neon-input font-mono text-sm"
                placeholder="iit-patna"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Page address:{' '}
            <code className="text-neon-cyan">
              {window.location.host}/hackathons/{previewSlug}/{numberHint}
            </code>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              The number counts this partner's hackathons: 1 for the first, 2 for the next, and so on.
            </span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">
                Partner website <span className="text-slate-500 normal-case">(optional)</span>
              </label>
              <input
                value={value.website}
                onChange={(e) => set({ website: e.target.value })}
                className="w-full rounded px-4 py-3 neon-input text-sm"
                placeholder="https://www.iitp.ac.in"
              />
            </div>
            <div>
              <label className="block text-xs pixel-caps text-slate-300 mb-2">
                Partner logo <span className="text-slate-500 normal-case">({hasExistingLogo ? 'replace' : 'optional'})</span>
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => set({ logo: e.target.files?.[0] || null })}
                className="w-full text-sm text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:text-xs file:bg-neon-cyan/20 file:text-neon-cyan file:cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">A square image works best.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
