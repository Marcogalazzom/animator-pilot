-- ═══════════════════════════════════════════════════════════════
-- PHASE 4: Liens inter-modules + Système d'alertes
-- ═══════════════════════════════════════════════════════════════

-- Cross-module linking
ALTER TABLE compliance_obligations ADD COLUMN linked_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE authority_events ADD COLUMN linked_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE budget_lines ADD COLUMN linked_obligation_id INTEGER REFERENCES compliance_obligations(id) ON DELETE SET NULL;

-- Alert rules (configurable)
CREATE TABLE alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  module TEXT NOT NULL,
  target_indicator TEXT,
  condition_operator TEXT NOT NULL,
  condition_value REAL NOT NULL,
  message_template TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Triggered alerts
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_path TEXT,
  link_entity_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_alerts_read ON alerts(is_read);
CREATE INDEX idx_alerts_date ON alerts(triggered_at);

-- Seed default alert rules
INSERT INTO alert_rules (rule_type, module, target_indicator, condition_operator, condition_value, message_template) VALUES
  ('kpi_threshold', 'kpi', 'taux_occupation', 'lt', 85, 'Taux d''occupation critique : {value}% (seuil : 85%)'),
  ('kpi_threshold', 'kpi', 'taux_absenteisme', 'gt', 12, 'Absentéisme élevé : {value}% (seuil : 12%)'),
  ('deadline', 'compliance', NULL, 'days_before', 30, 'Obligation "{title}" échue dans {days} jours'),
  ('deadline', 'compliance', NULL, 'days_before', 0, 'Obligation "{title}" en retard !'),
  ('deadline', 'tutelles', NULL, 'days_before', 30, 'Événement "{title}" dans {days} jours'),
  ('budget_overrun', 'budget', NULL, 'gt', 5, 'Dépassement budget section "{section}" : {value}%'),
  ('deadline', 'projects', NULL, 'days_before', 0, 'Projet "{title}" en retard !');
