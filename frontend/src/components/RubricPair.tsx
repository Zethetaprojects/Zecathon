import { Rubric } from '../types';
import { DEFAULT_NON_TECH_RUBRIC, DEFAULT_TECH_RUBRIC, RubricRow, rowsToRubric, rubricToRows } from '../utils/rubric';
import RubricEditor from './RubricEditor';

export interface RubricPairState {
  techCustom: boolean;
  nonTechCustom: boolean;
  techRows: RubricRow[];
  nonTechRows: RubricRow[];
}

/** Editor state for a stored rubric (custom parts become editable rows). */
export function rubricPairFrom(rubric: Rubric | null | undefined, fallback: Rubric | null | undefined): RubricPairState {
  return {
    techCustom: Boolean(rubric?.tech),
    nonTechCustom: Boolean(rubric?.non_tech),
    techRows: rubricToRows(rubric?.tech ?? fallback?.tech ?? DEFAULT_TECH_RUBRIC),
    nonTechRows: rubricToRows(rubric?.non_tech ?? fallback?.non_tech ?? DEFAULT_NON_TECH_RUBRIC),
  };
}

/** Validate the editor state; null rubric means "use the fallback for both types". */
export function rubricPairToRubric(state: RubricPairState): { rubric: Rubric | null; error?: string } {
  const rubric: Rubric = {};
  if (state.techCustom) {
    const { rubric: tech, error } = rowsToRubric(state.techRows, 'Tech');
    if (error) return { rubric: null, error };
    rubric.tech = tech;
  }
  if (state.nonTechCustom) {
    const { rubric: nonTech, error } = rowsToRubric(state.nonTechRows, 'Non-tech');
    if (error) return { rubric: null, error };
    rubric.non_tech = nonTech;
  }
  return { rubric: Object.keys(rubric).length ? rubric : null };
}

/** Tech + non-tech rubric editors side by side, falling back to `fallback` (or the platform defaults). */
export default function RubricPair({
  value,
  onChange,
  fallback,
  fallbackLabel,
  disabled = false,
}: {
  value: RubricPairState;
  onChange: (next: RubricPairState) => void;
  fallback?: Rubric | null;
  fallbackLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RubricEditor
        label="Tech submissions"
        custom={value.techCustom}
        onCustomChange={(techCustom) => onChange({ ...value, techCustom })}
        rows={value.techRows}
        onRowsChange={(techRows) => onChange({ ...value, techRows })}
        defaults={fallback?.tech ?? DEFAULT_TECH_RUBRIC}
        defaultLabel={fallback?.tech ? fallbackLabel : 'Platform default'}
        disabled={disabled}
      />
      <RubricEditor
        label="Non-tech submissions"
        custom={value.nonTechCustom}
        onCustomChange={(nonTechCustom) => onChange({ ...value, nonTechCustom })}
        rows={value.nonTechRows}
        onRowsChange={(nonTechRows) => onChange({ ...value, nonTechRows })}
        defaults={fallback?.non_tech ?? DEFAULT_NON_TECH_RUBRIC}
        defaultLabel={fallback?.non_tech ? fallbackLabel : 'Platform default'}
        disabled={disabled}
      />
    </div>
  );
}
