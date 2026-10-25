import { RUBRIC_TOTAL, RubricRow, rowsTotal, rubricToRows } from '../utils/rubric';

interface RubricEditorProps {
  label: string;
  /** Whether this hackathon overrides the platform default for this submission type. */
  custom: boolean;
  onCustomChange: (custom: boolean) => void;
  rows: RubricRow[];
  onRowsChange: (rows: RubricRow[]) => void;
  defaults: Record<string, number>;
  /** What the non-custom rubric is, e.g. "Platform default" or "Hackathon rubric". */
  defaultLabel?: string;
  disabled?: boolean;
}

/** Table editor for one rubric (tech or non-tech), with a live total that must reach 1000. */
export default function RubricEditor({
  label,
  custom,
  onCustomChange,
  rows,
  onRowsChange,
  defaults,
  defaultLabel = 'Platform default',
  disabled = false,
}: RubricEditorProps) {
  const total = rowsTotal(rows);
  const diff = RUBRIC_TOTAL - total;

  const update = (index: number, patch: Partial<RubricRow>) =>
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const enableCustom = (value: boolean) => {
    if (value && rows.length === 0) onRowsChange(rubricToRows(defaults));
    onCustomChange(value);
  };

  return (
    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="font-pixel text-[10px] text-white uppercase tracking-widest">{label}</p>
        <label className={`inline-flex items-center gap-2 text-xs ${disabled ? 'text-slate-500' : 'text-slate-300 cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={custom}
            disabled={disabled}
            onChange={(e) => enableCustom(e.target.checked)}
            className="accent-[#05d9e8]"
          />
          Custom rubric
        </label>
      </div>

      {!custom ? (
        <ul className="space-y-1.5">
          {Object.entries(defaults).map(([name, points]) => (
            <li key={name} className="flex justify-between gap-3 text-xs text-slate-400">
              <span>{name}</span>
              <span className="font-mono text-slate-300">{points}</span>
            </li>
          ))}
          <li className="pt-2 text-[11px] text-slate-500">{defaultLabel} · {RUBRIC_TOTAL} points</li>
        </ul>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={row.name}
                  disabled={disabled}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Category name"
                  aria-label={`${label} category ${i + 1} name`}
                  className="flex-1 min-w-0 rounded px-3 py-2 neon-input text-xs"
                />
                <input
                  value={row.points}
                  disabled={disabled}
                  onChange={(e) => update(i, { points: e.target.value.replace(/[^0-9]/g, '') })}
                  inputMode="numeric"
                  placeholder="pts"
                  aria-label={`${label} category ${i + 1} points`}
                  className="w-20 rounded px-3 py-2 neon-input text-xs font-mono text-right"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRowsChange(rows.filter((_, j) => j !== i))}
                  aria-label={`Remove ${row.name || 'category'}`}
                  className="px-2 rounded text-slate-500 hover:text-neon-pink border border-white/10 hover:border-neon-pink/40 transition disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRowsChange([...rows, { name: '', points: '' }])}
                className="px-2.5 py-1 rounded text-[11px] border border-white/15 text-slate-300 hover:text-neon-cyan hover:border-neon-cyan/50 transition disabled:opacity-40"
              >
                + Add category
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRowsChange(rubricToRows(defaults))}
                className="px-2.5 py-1 rounded text-[11px] border border-white/15 text-slate-400 hover:text-white transition disabled:opacity-40"
              >
                Start from defaults
              </button>
            </div>
            <span
              className={`text-xs font-mono ${diff === 0 ? 'text-neon-cyan' : 'text-neon-yellow'}`}
              aria-live="polite"
            >
              {total} / {RUBRIC_TOTAL}
              {diff > 0 && ` · ${diff} to go`}
              {diff < 0 && ` · ${-diff} over`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
