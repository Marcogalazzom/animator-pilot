export type ProjectStatus = 'todo' | 'in_progress' | 'done' | 'overdue';
export type ActionStatus = 'todo' | 'in_progress' | 'done';
export type ImportStatus = 'success' | 'error';

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

// ─── Documents (Notes / Comptes rendus) ─────────────────────
export type DocType = 'note_service' | 'cr_animation' | 'cr_equipe' | 'cr_reunion' | 'cr_projet' | 'other';

export interface Document {
  id: number;
  title: string;
  doc_type: DocType;
  content: string;
  author_role: string;
  date: string;
  tags: string;
  is_template: number;
  created_at: string;
}

// ─── Inventaire (synced from planning-ehpad) ─────────────────
export type InventoryCategory = 'materiel_animation' | 'jeux' | 'fournitures' | 'decoration' | 'musique' | 'sport' | 'other';
export type InventoryCondition = 'neuf' | 'bon' | 'usage' | 'a_remplacer';

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  quantity: number;
  condition: InventoryCondition;
  location: string;
  notes: string;
  inventory_type: 'consumable' | 'durable';
  synced_from: string;
  last_sync_at: string | null;
  external_id: string | null;
  created_at: string;
}

// ─── Annuaire Personnel (synced with planning-ehpad) ─────────
export type StaffRole = 'animateur' | 'aide_soignant' | 'infirmier' | 'medecin' | 'psychologue' | 'kinesitherapeute' | 'ergotherapeute' | 'ash' | 'cuisine' | 'direction' | 'administratif' | 'benevole' | 'other';

export interface StaffMember {
  id: number;
  first_name: string;
  last_name: string;
  role: StaffRole;
  phone: string;
  email: string;
  service: string;
  is_available: number;
  notes: string;
  synced_from: string;
  last_sync_at: string | null;
  external_id: string | null;
  created_at: string;
}

// ─── Photos & Albums ─────────────────────────────────────────

export interface PhotoAlbum {
  id: number;
  title: string;
  description: string;
  activity_date: string;
  cover_path: string | null;
  created_at: string;
}

export interface Photo {
  id: number;
  album_id: number;
  file_path: string;
  caption: string;
  taken_at: string | null;
  created_at: string;
}

// ─── Résidents (suivi animation — sans données médicales/RGPD) ─
export interface Resident {
  id: number;
  display_name: string;
  room_number: string;
  interests: string;
  animation_notes: string;
  participation_level: 'active' | 'moderate' | 'occasional' | 'observer';
  created_at: string;
}

// ─── Ateliers / Activités ────────────────────────────────────
export type ActivityType = 'atelier_creatif' | 'musique' | 'jeux' | 'sortie' | 'sport' | 'lecture' | 'cuisine' | 'bien_etre' | 'intergenerationnel' | 'fete' | 'other';
export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Activity {
  id: number;
  title: string;
  activity_type: ActivityType;
  description: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  location: string;
  max_participants: number;
  actual_participants: number;
  animator_name: string;
  status: ActivityStatus;
  materials_needed: string;
  notes: string;
  linked_project_id: number | null;
  synced_from: string;
  last_sync_at: string | null;
  external_id: string | null;
  is_shared: number;
  created_at: string;
}

// ─── Sync ────────────────────────────────────────────────────
export type SyncModule = 'activities' | 'inventory' | 'staff';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncLog {
  id: number;
  module: SyncModule;
  direction: 'pull' | 'push';
  items_synced: number;
  items_failed: number;
  started_at: string;
  finished_at: string | null;
  status: SyncStatus;
  error_message: string | null;
}

// ─── Alertes ─────────────────────────────────────────────────
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertRuleType = 'deadline' | 'budget_overrun' | 'low_participation';
export type AlertModule = 'budget' | 'projects' | 'activities' | 'inventory';

export interface AlertRule {
  id: number;
  rule_type: AlertRuleType;
  module: AlertModule;
  target_indicator: string | null;
  condition_operator: string;
  condition_value: number;
  message_template: string;
  is_active: number;
  created_at: string;
}

export interface Alert {
  id: number;
  rule_id: number | null;
  module: AlertModule;
  severity: AlertSeverity;
  title: string;
  message: string;
  link_path: string | null;
  link_entity_id: number | null;
  is_read: number;
  triggered_at: string;
}
