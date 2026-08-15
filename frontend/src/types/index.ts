export type UserRole = 'admin' | 'organizer' | 'judge' | 'participant';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Rubric {
  tech: Record<string, number>;
  non_tech: Record<string, number>;
}

export interface Hackathon {
  id: number;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  created_by: number;
  created_at: string;
  problem_statements?: ProblemStatement[];
  teams?: Team[];
  rubric?: Rubric;
  problem_statement_count?: number;
  team_count?: number;
}

export interface ProblemStatement {
  id: number;
  hackathon_id: number;
  title: string;
  description?: string;
  file_path?: string;
  created_at: string;
}

export interface Team {
  id: number;
  hackathon_id: number;
  name: string;
  created_at: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: number;
  user_id: number;
  username: string;
  role: string;
  joined_at: string;
}

export type SubmissionType = 'tech' | 'non_tech';
export type SubmissionStatus = 'pending' | 'evaluated' | 'failed' | 'not_assessable';

export interface Submission {
  id: number;
  team_id: number;
  problem_statement_id: number;
  type: SubmissionType;
  submission_url: string;
  ppt_url?: string;
  github_url?: string;
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
  category_max_points?: Record<string, number>;
  category_explanations?: Record<string, string>;
  review_flags: string[];
  needs_review: boolean;
  evaluated_at: string;
  judge_questions?: string[];
  overall_assessment?: string;
  key_strengths?: string[];
  areas_for_improvement?: string[];
  red_flags?: string[];
  recommendation?: string;
}

export interface LeaderboardEntry {
  team_id: number;
  team_name: string;
  problem_statement_id: number;
  problem_statement_title: string;
  submission_id: number;
  type: SubmissionType;
  total_score: number;
  percentage: number;
  verdict: string;
  needs_review: boolean;
}

export interface TeamReportEntry {
  team_id: number;
  team_name: string;
  problem_statement_id: number;
  problem_statement_title: string;
  submission_id: number;
  type: SubmissionType | string;
  total_score?: number;
  verdict?: string;
  status?: SubmissionStatus | string;
  needs_review?: boolean;
}

export interface SubmissionReport extends Submission {
  team_name: string;
  problem_statement_title: string;
  hackathon_name: string;
}

export interface HackathonReportSummary {
  id: number;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  problem_statement_count: number;
  team_count: number;
  submission_count: number;
  evaluated_count: number;
  average_score?: number;
  top_team_name?: string;
  top_team_score?: number;
  verdict_breakdown: Record<string, number>;
  type_breakdown: Record<string, number>;
}

export interface HackathonReportDetail extends HackathonReportSummary {
  team_entries: TeamReportEntry[];
}
