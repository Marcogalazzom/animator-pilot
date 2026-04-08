export interface KpiEntry {
  id: number;
  category: string;
  indicator: string;
  value: number;
  period: string;
  source: string;
  created_at: string;
}

export interface KpiThreshold {
  id: number;
  indicator: string;
  warning: number | null;
  critical: number | null;
  direction: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  owner_role: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
}

export interface Action {
  id: number;
  project_id: number;
  title: string;
  progress: number;
  due_date: string | null;
  status: string;
  created_at: string;
}

export interface ImportRecord {
  id: number;
  filename: string;
  imported_at: string;
  row_count: number;
  status: string;
}
