import { uploadUrl } from '../utils/download';

export interface SubmissionFiles {
  type?: string | null;
  submission_url?: string | null;
  github_url?: string | null;
  ppt_url?: string | null;
}

export interface SubmissionLink {
  key: string;
  label: string;
  href: string;
  kind: 'repo' | 'document' | 'slides' | 'link';
}

const isGithub = (url: string) => /^https?:\/\/(www\.)?github\.com\//i.test(url);

export function fileExtension(path: string) {
  const ext = path.split('?')[0].split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 && !ext.includes('/') ? ext : '';
}

/** Everything a team handed in, as openable links (repository, document, slides). */
export function submissionLinks(s: SubmissionFiles): SubmissionLink[] {
  const links: SubmissionLink[] = [];
  const main = s.submission_url?.trim();
  if (main) {
    if (isGithub(main)) {
      links.push({ key: 'main', label: 'GitHub repository', href: main, kind: 'repo' });
    } else if (main.startsWith('http')) {
      links.push({ key: 'main', label: 'Submitted link', href: main, kind: 'link' });
    } else {
      const ext = fileExtension(main);
      links.push({ key: 'main', label: `Document${ext ? ` (${ext})` : ''}`, href: uploadUrl(main), kind: 'document' });
    }
  }
  const github = s.github_url?.trim();
  if (github && github !== main) {
    links.push({ key: 'github', label: 'Supporting GitHub', href: github, kind: 'repo' });
  }
  const ppt = s.ppt_url?.trim();
  if (ppt) {
    const ext = fileExtension(ppt);
    links.push({ key: 'ppt', label: `Slides${ext ? ` (${ext})` : ''}`, href: uploadUrl(ppt), kind: 'slides' });
  }
  return links;
}

const KIND_STYLE: Record<SubmissionLink['kind'], string> = {
  repo: 'border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10',
  document: 'border-neon-pink/40 text-neon-pink hover:bg-neon-pink/10',
  slides: 'border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10',
  link: 'border-white/20 text-slate-200 hover:bg-white/10',
};

/** Compact chips linking to a submission's repository, document and slides. */
export default function SubmissionLinks({ submission, size = 'sm' }: { submission: SubmissionFiles; size?: 'sm' | 'md' }) {
  const links = submissionLinks(submission);
  if (links.length === 0) return <span className="text-slate-500 text-[10px]">Nothing attached</span>;
  const pad = size === 'md' ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[10px]';
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          title={l.href}
          className={`rounded border font-semibold whitespace-nowrap transition ${pad} ${KIND_STYLE[l.kind]}`}
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
