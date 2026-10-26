import { Hackathon } from '../types';
import { formatDateTime, isPast } from '../utils/hackathon';
import Countdown from './Countdown';
import ExpandableText from './ExpandableText';

/**
 * The rules teams must follow before submitting: key rules derived from the
 * hackathon's settings (so they are always accurate), followed by the
 * organiser's own guidelines.
 */
export default function SubmissionGuidelines({ hackathon, compact = false }: { hackathon: Hackathon; compact?: boolean }) {
  const deadline = hackathon.submission_deadline;
  const closed = isPast(deadline);

  const startsLater = Boolean(hackathon.start_date) && !isPast(hackathon.start_date);

  const rules: { text: React.ReactNode; strong?: boolean }[] = [
    ...(startsLater
      ? [
          {
            strong: true,
            text: (
              <>
                Problem statements are revealed and submissions open when the hackathon starts on{' '}
                <span className="text-white">{formatDateTime(hackathon.start_date)}</span>. Form your team before then.
              </>
            ),
          },
        ]
      : []),
    deadline
      ? {
          strong: true,
          text: closed ? (
            <>Submissions closed on {formatDateTime(deadline)}. Late submissions are not accepted.</>
          ) : (
            <>
              Submissions close on <span className="text-white">{formatDateTime(deadline)}</span> (
              <Countdown targetDate={deadline} label="in" />
              ). Late or emailed submissions are not accepted, so don't leave uploading to the last minute.
            </>
          ),
        }
      : { text: 'No submission deadline has been set yet.' },
    {
      strong: true,
      text: 'Each team submits once per problem statement, and a submission cannot be edited or replaced afterwards. Submit only your final version.',
    },
  ];
  if (hackathon.one_statement_per_team) {
    rules.push({
      strong: true,
      text: 'Your team may submit to only one problem statement. Your first submission fixes your track; the others are then closed for your team.',
    });
  }
  if (hackathon.max_team_members) {
    rules.push({ text: `Teams can have at most ${hackathon.max_team_members} members, and each person can be in only one team.` });
  }
  rules.push(
    {
      text: 'Documents: PDF, DOCX, PPTX, XLSX, TXT or MD, up to 20 MB each. PDFs must have selectable text: scanned pages or slides exported as images cannot be evaluated.',
    },
    {
      text: 'GitHub repositories must stay reachable until judging is complete: public, or shared with the organisers as instructed.',
    },
  );

  return (
    <section
      id="guidelines"
      className={`rounded-xl border border-neon-yellow/30 bg-neon-yellow/[0.04] ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
      aria-labelledby="guidelines-title"
    >
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-neon-yellow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <h2 id="guidelines-title" className="font-pixel text-xs text-neon-yellow">
          SUBMISSION GUIDELINES
        </h2>
      </div>

      <ul className="space-y-2">
        {rules.map((rule, i) => (
          <li key={i} className={`flex gap-2.5 text-sm leading-relaxed ${rule.strong ? 'text-slate-100' : 'text-slate-300'}`}>
            <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${rule.strong ? 'bg-neon-yellow' : 'bg-slate-500'}`} aria-hidden="true" />
            <span>{rule.text}</span>
          </li>
        ))}
      </ul>

      {hackathon.submission_guidelines && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">From the organisers</p>
          <ExpandableText
            text={hackathon.submission_guidelines}
            lines={compact ? 6 : 12}
            className="text-sm text-slate-200 leading-relaxed"
            moreLabel="Read all guidelines"
          />
        </div>
      )}
    </section>
  );
}
