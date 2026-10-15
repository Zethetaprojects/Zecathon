// Platform default rubrics (mirror backend app/services/scoring/constants.py).
export const DEFAULT_TECH_RUBRIC: Record<string, number> = {
  'Problem Understanding': 150,
  'Implementation Completeness': 200,
  'Code Quality & Architecture': 150,
  'Innovation & Creativity': 150,
  'Technical Feasibility': 100,
  Documentation: 100,
  'Commit Authenticity / Effort': 100,
  'Presentation / Demo': 50,
};

export const DEFAULT_NON_TECH_RUBRIC: Record<string, number> = {
  'Problem-Specific Grounding': 150,
  'Solution Effectiveness': 200,
  'Research & Evidence': 150,
  'Feasibility & Practicality': 150,
  'Communication & Clarity': 100,
  'Innovation & Creativity': 150,
  'Presentation Quality': 100,
};

/** Scores are out of 1000, so a custom rubric must add up to exactly this. */
export const RUBRIC_TOTAL = 1000;

export interface RubricRow {
  name: string;
  points: string;
}

export function rubricToRows(rubric: Record<string, number>): RubricRow[] {
  return Object.entries(rubric).map(([name, points]) => ({ name, points: String(points) }));
}

export function rowsTotal(rows: RubricRow[]): number {
  return rows.reduce((sum, r) => sum + (Number.parseInt(r.points, 10) || 0), 0);
}

/** Validate editor rows; returns the rubric map or a human-readable error. */
export function rowsToRubric(rows: RubricRow[], label: string): { rubric?: Record<string, number>; error?: string } {
  if (rows.length === 0) return { error: `${label} rubric needs at least one category.` };
  const rubric: Record<string, number> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) return { error: `${label} rubric has a category without a name.` };
    if (name in rubric) return { error: `${label} rubric has "${name}" twice.` };
    const points = Number(row.points);
    if (!Number.isInteger(points) || points < 1) {
      return { error: `${label} rubric: "${name}" needs a whole number of points (at least 1).` };
    }
    rubric[name] = points;
  }
  const total = rowsTotal(rows);
  if (total !== RUBRIC_TOTAL) {
    return { error: `${label} rubric must total exactly ${RUBRIC_TOTAL} points (currently ${total}).` };
  }
  return { rubric };
}
