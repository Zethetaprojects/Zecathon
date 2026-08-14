export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
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
