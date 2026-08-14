export type SubmissionType = 'tech' | 'non_tech';
export type SubmissionStatus = 'pending' | 'evaluated' | 'failed' | 'not_assessable';

export interface Submission {
  id: number;
  team_id: number;
  problem_statement_id: number;
  type: SubmissionType;
  submission_url: string;
  ppt_url?: string;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
  evaluation?: Evaluation;
}

export interface Evaluation {
  id: number;
  submission_id: number;
  total_score: number;
  percentage: number;
  verdict: string;
  raw_score: number;
  multiplier: number;
  authenticity_band: string;
  category_scores: Record<string, number>;
  review_flags: string[];
  needs_review: boolean;
  evaluated_at: string;
}
