-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Communication & Veille
-- ═══════════════════════════════════════════════════════════════

-- MODULE: Notes de service & CR réunions
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  content TEXT DEFAULT '',
  author_role TEXT DEFAULT '',
  date TEXT NOT NULL,
  tags TEXT DEFAULT '',
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents_type ON documents(doc_type);
CREATE INDEX idx_documents_date ON documents(date);

-- MODULE: Veille réglementaire
CREATE TABLE regulatory_watch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT DEFAULT '',
  url TEXT DEFAULT '',
  date_published TEXT,
  summary TEXT DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_watch_category ON regulatory_watch(category);

CREATE TABLE training_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  hours_planned REAL NOT NULL DEFAULT 0,
  hours_completed REAL NOT NULL DEFAULT 0,
  fiscal_year INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_training_year ON training_tracking(fiscal_year);

-- MODULE: Indicateurs ANAP / Benchmarking
CREATE TABLE anap_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_etablissement REAL,
  value_national REAL,
  value_regional REAL,
  unit TEXT DEFAULT '%',
  fiscal_year INTEGER NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_anap_year ON anap_indicators(fiscal_year);
CREATE INDEX idx_anap_category ON anap_indicators(category);

-- ═══════════════════════════════════════════════════════════════
-- SEED: Document templates
-- ═══════════════════════════════════════════════════════════════
INSERT INTO documents (title, doc_type, content, author_role, date, is_template) VALUES
  ('Modèle — Note de service', 'note_service', '<h2>Note de service n°</h2><p><strong>Objet :</strong> </p><p><strong>Date d''effet :</strong> </p><hr><p>Le directeur/la directrice de l''établissement informe l''ensemble du personnel que...</p><p></p><p><em>La Direction</em></p>', 'Directrice', '2026-01-01', 1),
  ('Modèle — CR Conseil de la Vie Sociale', 'cr_cvs', '<h2>Compte-rendu du Conseil de la Vie Sociale</h2><p><strong>Date :</strong> </p><p><strong>Présents :</strong> </p><p><strong>Excusés :</strong> </p><hr><h3>1. Approbation du précédent CR</h3><p></p><h3>2. Points à l''ordre du jour</h3><p></p><h3>3. Questions diverses</h3><p></p><h3>4. Date de la prochaine réunion</h3><p></p>', 'Directrice', '2026-01-01', 1),
  ('Modèle — CR Réunion d''équipe', 'cr_equipe', '<h2>Compte-rendu de réunion d''équipe</h2><p><strong>Date :</strong> </p><p><strong>Service :</strong> </p><p><strong>Présents :</strong> </p><hr><h3>Points abordés</h3><p></p><h3>Décisions prises</h3><p></p><h3>Actions à mener</h3><ul><li></li></ul>', 'IDEC', '2026-01-01', 1),
  ('Modèle — CR Réunion de direction', 'cr_direction', '<h2>Compte-rendu de réunion de direction</h2><p><strong>Date :</strong> </p><p><strong>Participants :</strong> </p><hr><h3>1. Suivi des indicateurs</h3><p></p><h3>2. Points RH</h3><p></p><h3>3. Budget</h3><p></p><h3>4. Projets en cours</h3><p></p><h3>5. Divers</h3><p></p>', 'Directrice', '2026-01-01', 1);

-- ═══════════════════════════════════════════════════════════════
-- SEED: ANAP indicators (moyennes nationales 2024)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO anap_indicators (indicator_key, label, value_national, unit, fiscal_year, category) VALUES
  ('taux_occupation', 'Taux d''occupation', 93.5, '%', 2024, 'activite'),
  ('duree_moyenne_sejour', 'Durée moyenne de séjour', 2.8, 'ans', 2024, 'activite'),
  ('age_moyen_entree', 'Âge moyen à l''entrée', 86.2, 'ans', 2024, 'activite'),
  ('ratio_soignants', 'Ratio soignants / résidents', 0.62, '', 2024, 'rh'),
  ('taux_absenteisme', 'Taux d''absentéisme', 10.2, '%', 2024, 'rh'),
  ('turnover', 'Taux de rotation du personnel', 18.5, '%', 2024, 'rh'),
  ('cout_journalier_hebergement', 'Coût journalier hébergement', 72.50, '€', 2024, 'finance'),
  ('cout_journalier_dependance', 'Coût journalier dépendance', 21.30, '€', 2024, 'finance'),
  ('cout_journalier_soins', 'Coût journalier soins', 38.80, '€', 2024, 'finance'),
  ('taux_chutes', 'Taux de chutes pour 1000 journées', 4.2, '‰', 2024, 'qualite'),
  ('taux_hospitalisation', 'Taux d''hospitalisations non programmées', 15.8, '%', 2024, 'qualite'),
  ('satisfaction_globale', 'Score satisfaction globale', 7.8, '/10', 2024, 'qualite');
