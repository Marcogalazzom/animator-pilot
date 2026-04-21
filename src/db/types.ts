// ─── KPIs ───────────────────────────────────────────────────
export type KpiCategory = 'occupation' | 'finance' | 'rh' | 'qualite';
export type KpiSource = 'manual' | 'import';
export type ThresholdDirection = 'above' | 'below';

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

// ─── Veille réglementaire & Formation ───────────────────────
export type WatchCategory = 'legislation' | 'has_recommendation' | 'ars_circular' | 'formation' | 'other';

export interface RegulatoryWatch {
  id: number;
  title: string;
  category: WatchCategory;
  source: string;
  url: string;
  date_published: string;
  summary: string;
  is_read: number;
  created_at: string;
}

export interface TrainingTracking {
  id: number;
  title: string;
  category: string;
  hours_planned: number;
  hours_completed: number;
  fiscal_year: number;
  notes: string;
  created_at: string;
}

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
  category: string;
  next_action: string;
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

// ─── Budget Animation ────────────────────────────────────────
export type ExpenseCategory = 'intervenants' | 'materiel' | 'sorties' | 'fetes' | 'other';

export interface AnimationBudget {
  id: number;
  fiscal_year: number;
  total_allocated: number;
  limit_intervenants: number;
  limit_materiel: number;
  limit_sorties: number;
  limit_fetes: number;
  limit_other: number;
  synced_from: string;
  last_sync_at: string | null;
  external_id: string | null;
  created_at: string;
}

export type UpcomingFrequency = 'weekly' | 'monthly' | 'yearly' | '';

export interface UpcomingExpense {
  id: number;
  title: string;
  amount: number;
  due_date: string;      // YYYY-MM-DD
  recurring: number;     // 0 | 1
  frequency: UpcomingFrequency;
  note: string;
  created_at: string;
}

export interface Expense {
  id: number;
  fiscal_year: number;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  supplier: string;
  invoice_path: string | null;
  linked_intervenant_id: string | null;
  synced_from: string;
  last_sync_at: string | null;
  external_id: string | null;
  created_at: string;
}

// ─── Carnet de bord (journal privé) ──────────────────────────

export type JournalMood = 'great' | 'good' | 'neutral' | 'difficult' | 'bad';

export interface JournalEntry {
  id: number;
  date: string;
  content: string;
  mood: JournalMood;
  tags: string;
  is_shared: number;
  linked_resident_ids: string;
  created_at: string;
}

// ─── Contacts fournisseurs ───────────────────────────────────

export type SupplierCategory = string;

export interface Supplier {
  id: number;
  name: string;
  category: SupplierCategory;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  notes: string;
  hourly_rate: number | null;
  session_rate: number | null;
  is_favorite: number;
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
export type InventoryCategory = string;
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
export type StaffRole = string;

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
  hourly_rate: number | null;
  session_rate: number | null;
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
  activity_date: string;          // 1er jour du mois couvert (YYYY-MM-01) — filtre Famileo
  cover_path: string | null;
  activity_id: number | null;     // legacy, conservé pour rétro-compatibilité
  activity_type: string;          // catégorie d'activité (ex: 'loto', 'gym') — clef de regroupement
  created_at: string;
}

export interface Photo {
  id: number;
  album_id: number;
  file_path: string;
  thumbnail_path: string | null;
  caption: string;
  taken_at: string | null;
  created_at: string;
}

// ─── Résidents (suivi animation — sans données médicales/RGPD) ─
export type ResidentMood = 'happy' | 'calm' | 'sleep' | 'quiet';

export interface Resident {
  id: number;
  display_name: string;
  room_number: string;
  interests: string;
  animation_notes: string;
  participation_level: 'active' | 'moderate' | 'occasional' | 'observer';
  birthday: string | null;
  arrival_date: string | null;
  mood: ResidentMood;
  family_contacts: string;
  created_at: string;
}

// ─── Ateliers / Activités ────────────────────────────────────
export type ActivityType = string;
export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ActivityCategory = 'memory' | 'creative' | 'body' | 'outing' | 'rdv' | 'prep';
export type ActivityDifficulty = 'facile' | 'moyen' | 'difficile';

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
  is_template: number; // 0 ou 1 — templates non synchronisés
  unit: ActivityUnit;
  is_recurring: number; // 0 ou 1 — activités hebdomadaires issues de planning-ehpad
  category: ActivityCategory;
  difficulty: ActivityDifficulty;
  created_at: string;
}

export type ActivityUnit = 'main' | 'pasa';

// ─── Rendez-vous pro (animateur) ─────────────────────────────
export type AppointmentType = 'meeting' | 'supplier' | 'training' | 'interview' | 'other' | string;
export type AppointmentStatus = 'planned' | 'completed' | 'cancelled';

export interface Appointment {
  id: number;
  title: string;
  appointment_type: AppointmentType;
  date: string;
  time_start: string | null;
  time_end: string | null;
  location: string;
  participants: string;
  description: string;
  status: AppointmentStatus;
  created_at: string;
}

// ─── Sync ────────────────────────────────────────────────────
export type SyncModule = 'activities' | 'inventory' | 'staff' | 'budget';
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

// ─── ANAP Benchmarking ──────────────────────────────────────
export type AnapCategory = 'rh' | 'finance' | 'activite' | 'qualite' | 'immobilier' | 'other';

export interface AnapIndicator {
  id: number;
  indicator_key: string;
  label: string;
  value_etablissement: number | null;
  value_national: number | null;
  value_regional: number | null;
  unit: string;
  fiscal_year: number;
  category: AnapCategory;
  created_at: string;
}

// ─── Conformité réglementaire ───────────────────────────────
export type ObligationCategory = 'governance' | 'quality' | 'security' | 'hr' | 'securite' | 'hygiene' | 'soins' | 'droits_usagers' | 'administratif' | 'other';
export type ObligationStatus = 'compliant' | 'non_compliant' | 'in_progress' | 'not_applicable' | 'to_plan';
export type ObligationFrequency = 'annual' | 'biannual' | 'triennial' | 'quinquennial' | 'permanent' | 'periodic' | 'quarterly' | 'monthly' | 'one_time' | 'continuous';


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
  linked_project_id: number | null;
  is_builtin: number;
  created_at: string;
}

// ─── Tutelles / Autorités ───────────────────────────────────
export type AuthorityType = 'ars' | 'cd' | 'has' | 'prefecture' | 'other';
export type EventType = 'cpom' | 'budget_campaign' | 'evaluation' | 'inspection' | 'commission' | 'dialogue' | 'other';
export type EventStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface AuthorityEvent {
  id: number;
  title: string;
  event_type: EventType;
  authority: AuthorityType;
  date_start: string;
  date_end: string | null;
  status: EventStatus;
  notes: string;
  is_recurring: number;
  recurrence_rule: string | null;
  linked_project_id: number | null;
  created_at: string;
}

export interface AuthorityCorrespondence {
  id: number;
  event_id: number | null;
  date: string;
  direction: 'sent' | 'received';
  type: 'letter' | 'email' | 'meeting' | 'phone';
  authority: AuthorityType;
  contact_role: string;
  subject: string;
  content: string;
  document_path: string | null;
  status: 'sent' | 'received' | 'awaiting_reply' | 'archived';
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
