export type UserRole = 'superadmin' | 'admin' | 'organizer' | 'judge' | 'participant';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Feature toggles a superadmin can switch per role (mirrors backend FEATURES).
export type Feature =
  | 'create_hackathon'
  | 'edit_hackathon'
  | 'delete_hackathon'
  | 'manage_problem_statements'
  | 'create_team'
  | 'join_team'
  | 'manage_team_members'
  | 'delete_team'
  | 'submit_project'
  | 'evaluate_submission'
  | 'view_reports'
  | 'view_leaderboard'
  | 'manage_users'
  | 'view_admin_panel'
  | 'view_api_docs'
  | 'participate';

export type Permissions = Partial<Record<Feature, boolean>>;

export interface Rubric {
  tech?: Record<string, number>;
  non_tech?: Record<string, number>;
}

export interface Hackathon {
  id: number;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  duration_hours?: number;
  banner_path?: string;
  max_participants?: number;
  max_team_members?: number;
  /** ISO time (UTC) after which participants can no longer submit; null = no deadline. */
  submission_deadline?: string | null;
  /** Organiser-written rules shown on the hackathon and submit pages. */
  submission_guidelines?: string | null;
  /** When true each team may submit to only one problem statement. */
  one_statement_per_team?: boolean | null;
  /** Optional partner (e.g. a college); partner hackathons live at /hackathons/{partner_slug}/{partner_number}. */
  partner_name?: string | null;
  partner_slug?: string | null;
  partner_number?: number | null;
  partner_logo_path?: string | null;
  partner_website?: string | null;
  created_by: number;
  created_at: string;
  problem_statements?: ProblemStatement[];
  teams?: Team[];
  rubric?: Rubric;
  problem_statement_count?: number;
  team_count?: number;
  /** Statements exist but are withheld from this viewer until the hackathon starts. */
  problem_statements_hidden?: boolean;
}

export interface ProblemStatement {
  id: number;
  hackathon_id: number;
  title: string;
  description?: string;
  file_path?: string;
  created_at: string;
  /** Teams that have submitted; edits and deletion are locked once this is above 0. */
  submission_count?: number;
  /** Optional rubric for this statement only; falls back to the hackathon rubric. */
  rubric?: Rubric | null;
}

export interface Team {
  id: number;
  hackathon_id: number;
  name: string;
  join_code?: string;
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
  llm_source?: LlmSource | null;
  overall_assessment?: string;
  key_strengths?: string[];
  areas_for_improvement?: string[];
  red_flags?: string[];
  recommendation?: string;
}

// Which scorer produced an evaluation. 'mock' and 'suspected_mock' are not real AI scores.
export type LlmSource = 'gemini' | 'generic' | 'mock' | 'suspected_mock' | 'gate';

export const isFallbackScore = (source?: LlmSource | string | null) =>
  source === 'mock' || source === 'suspected_mock';

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
  llm_source?: LlmSource | null;
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

export interface PublicStats {
  total_hackathons: number;
  total_teams: number;
  total_submissions: number;
  total_evaluations: number;
}
