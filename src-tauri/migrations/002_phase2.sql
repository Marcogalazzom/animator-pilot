-- ═══════════════════════════════════════════════════════════════
-- MODULE: Conformité réglementaire
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE compliance_obligations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'to_plan',
  next_due_date TEXT,
  last_validated_date TEXT,
  document_path TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_obligations_category ON compliance_obligations(category);
CREATE INDEX idx_obligations_status ON compliance_obligations(status);
CREATE INDEX idx_obligations_due ON compliance_obligations(next_due_date);

-- ═══════════════════════════════════════════════════════════════
-- MODULE: Budget avancé
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE budget_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE budget_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES budget_sections(id),
  title_number INTEGER NOT NULL,
  line_label TEXT NOT NULL,
  line_type TEXT NOT NULL,
  amount_previsionnel REAL NOT NULL DEFAULT 0,
  amount_realise REAL NOT NULL DEFAULT 0,
  fiscal_year INTEGER NOT NULL,
  period TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_budget_lines_section ON budget_lines(section_id);
CREATE INDEX idx_budget_lines_year ON budget_lines(fiscal_year);

CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount_planned REAL NOT NULL DEFAULT 0,
  amount_committed REAL NOT NULL DEFAULT 0,
  amount_realized REAL NOT NULL DEFAULT 0,
  funding_source TEXT DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  fiscal_year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- MODULE: Relation tutelles
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE authority_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  authority TEXT NOT NULL,
  date_start TEXT,
  date_end TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT DEFAULT '',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_date ON authority_events(date_start);
CREATE INDEX idx_events_type ON authority_events(event_type);

CREATE TABLE authority_correspondences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES authority_events(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  direction TEXT NOT NULL,
  type TEXT NOT NULL,
  authority TEXT NOT NULL,
  contact_role TEXT DEFAULT '',
  subject TEXT NOT NULL,
  content TEXT DEFAULT '',
  document_path TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_correspondences_date ON authority_correspondences(date);
CREATE INDEX idx_correspondences_authority ON authority_correspondences(authority);

CREATE TABLE preparation_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES authority_events(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_checklists_event ON preparation_checklists(event_id);

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════

-- Budget sections
INSERT OR IGNORE INTO budget_sections (name, label) VALUES ('hebergement', 'Hébergement');
INSERT OR IGNORE INTO budget_sections (name, label) VALUES ('dependance', 'Dépendance');
INSERT OR IGNORE INTO budget_sections (name, label) VALUES ('soins', 'Soins');

-- Compliance obligations (pre-filled reference)
-- Governance
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('CPOM', 'governance', 'quinquennial', 'Contrat Pluriannuel d''Objectifs et de Moyens', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Projet d''établissement', 'governance', 'quinquennial', 'Projet d''établissement définissant les objectifs', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Conseil de la Vie Sociale', 'governance', 'triennial', 'Minimum 3 réunions par an', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Règlement de fonctionnement', 'governance', 'quinquennial', 'Règlement intérieur de l''établissement', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Livret d''accueil', 'governance', 'annual', 'Livret remis à chaque résident', 1);
-- Quality
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Évaluation HAS', 'quality', 'quinquennial', 'Évaluation externe de la qualité', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Rapport d''activité annuel', 'quality', 'annual', 'Rapport d''activité à transmettre aux tutelles', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Enquête satisfaction', 'quality', 'annual', 'Enquête de satisfaction résidents et familles', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Tableau de bord ANAP', 'quality', 'annual', 'Saisie des indicateurs ANAP', 1);
-- Security
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Plan Bleu', 'security', 'annual', 'Plan de gestion de crise et de continuité', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('DUERP', 'security', 'annual', 'Document Unique d''Évaluation des Risques Professionnels', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Registre sécurité incendie', 'security', 'periodic', 'Vérifications périodiques incendie', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Commission de sécurité', 'security', 'quinquennial', 'Visite de la commission de sécurité', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Plan de formation', 'security', 'annual', 'Plan annuel de formation du personnel', 1);
-- HR
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Bilan social', 'hr', 'annual', 'Bilan social annuel', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Entretiens professionnels', 'hr', 'biannual', 'Entretiens professionnels obligatoires', 1);
INSERT INTO compliance_obligations (title, category, frequency, description, is_builtin) VALUES ('Affichages obligatoires', 'hr', 'permanent', 'Affichages réglementaires dans l''établissement', 1);

-- Authority events (pre-filled calendar)
INSERT INTO authority_events (title, event_type, authority, is_recurring, recurrence_rule, notes) VALUES ('Dépôt EPRD', 'budget_campaign', 'ars', 1, 'annual', 'Dépôt de l''État Prévisionnel des Recettes et Dépenses');
INSERT INTO authority_events (title, event_type, authority, is_recurring, recurrence_rule, notes) VALUES ('Dialogue de gestion', 'dialogue', 'ars', 1, 'annual', 'Dialogue de gestion annuel avec l''ARS et le CD');
INSERT INTO authority_events (title, event_type, authority, is_recurring, recurrence_rule, notes) VALUES ('Dépôt ERRD', 'budget_campaign', 'ars', 1, 'annual', 'Dépôt de l''État Réalisé des Recettes et Dépenses');
INSERT INTO authority_events (title, event_type, authority, is_recurring, recurrence_rule, notes) VALUES ('Renouvellement CPOM', 'cpom', 'ars', 1, 'quinquennial', 'Renouvellement du Contrat Pluriannuel d''Objectifs et de Moyens');
INSERT INTO authority_events (title, event_type, authority, is_recurring, recurrence_rule, notes) VALUES ('Évaluation HAS', 'evaluation', 'has', 1, 'quinquennial', 'Évaluation externe par la Haute Autorité de Santé');
