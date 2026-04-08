export type KpiCategory = 'occupation' | 'finance' | 'rh' | 'qualite';
export type KpiSource = 'manual' | 'import';
export type ThresholdDirection = 'above' | 'below';
export type ProjectStatus = 'todo' | 'in_progress' | 'done' | 'overdue';
export type ActionStatus = 'todo' | 'in_progress' | 'done';
export type ImportStatus = 'success' | 'error';

export interface KpiEntry {
  id: number;
  category: KpiCategory;
  indicator: string;
  value: number;
  period: string;
  source: KpiSource;
  created_at: string;
}

export interface KpiThreshold {
  id: number;
  indicator: string;
  warning: number | null;
  critical: number | null;
  direction: ThresholdDirection;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  owner_role: string;
  status: ProjectStatus;
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
  status: ActionStatus;
  created_at: string;
}

export interface ImportRecord {
  id: number;
  filename: string;
  imported_at: string;
  row_count: number;
  status: ImportStatus;
}

// ─── Compliance ───────────────────────────────────────────────
export type ObligationCategory = 'governance' | 'quality' | 'security' | 'hr';
export type ObligationFrequency = 'annual' | 'biannual' | 'triennial' | 'quinquennial' | 'permanent' | 'periodic';
export type ObligationStatus = 'compliant' | 'in_progress' | 'non_compliant' | 'to_plan';

export interface ComplianceObligation {
  id: number;
  title: string;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  description: string;
  status: ObligationStatus;
  next_due_date: string | null;
  last_validated_date: string | null;
  document_path: string | null;
  is_builtin: number;
  created_at: string;
}

// ─── Budget ───────────────────────────────────────────────────
export type BudgetLineType = 'charge' | 'produit';
export type InvestmentStatus = 'planned' | 'in_progress' | 'completed';

export interface BudgetSection {
  id: number;
  name: string;
  label: string;
  created_at: string;
}

export interface BudgetLine {
  id: number;
  section_id: number;
  title_number: number;
  line_label: string;
  line_type: BudgetLineType;
  amount_previsionnel: number;
  amount_realise: number;
  fiscal_year: number;
  period: string | null;
  created_at: string;
}

export interface Investment {
  id: number;
  title: string;
  description: string;
  amount_planned: number;
  amount_committed: number;
  amount_realized: number;
  funding_source: string;
  start_date: string | null;
  end_date: string | null;
  status: InvestmentStatus;
  fiscal_year: number;
  created_at: string;
}

// ─── Tutelles ─────────────────────────────────────────────────
export type EventType = 'cpom' | 'budget_campaign' | 'evaluation' | 'inspection' | 'commission' | 'dialogue' | 'other';
export type AuthorityType = 'ars' | 'cd' | 'has' | 'prefecture' | 'other';
export type EventStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type CorrespondenceDirection = 'sent' | 'received';
export type CorrespondenceType = 'letter' | 'email' | 'meeting' | 'phone';
export type CorrespondenceStatus = 'sent' | 'received' | 'awaiting_reply' | 'archived';

export interface AuthorityEvent {
  id: number;
  title: string;
  event_type: EventType;
  authority: AuthorityType;
  date_start: string | null;
  date_end: string | null;
  status: EventStatus;
  notes: string;
  is_recurring: number;
  recurrence_rule: string | null;
  created_at: string;
}

export interface AuthorityCorrespondence {
  id: number;
  event_id: number | null;
  date: string;
  direction: CorrespondenceDirection;
  type: CorrespondenceType;
  authority: AuthorityType;
  contact_role: string;
  subject: string;
  content: string;
  document_path: string | null;
  status: CorrespondenceStatus;
  created_at: string;
}

export interface PreparationChecklist {
  id: number;
  event_id: number;
  item_text: string;
  is_done: number;
  category: string;
  sort_order: number;
  created_at: string;
}
