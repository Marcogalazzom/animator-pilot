-- ╔══════════════════════════════════════════════════════════╗
-- ║  Migration 006 — Pilot Animateur tables                ║
-- ║  Activities, Inventory, Staff, Residents, Photos, Sync ║
-- ╚══════════════════════════════════════════════════════════╝

-- ─── Activities / Ateliers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  activity_type   TEXT    NOT NULL DEFAULT 'other',
  description     TEXT    NOT NULL DEFAULT '',
  date            TEXT    NOT NULL,
  time_start      TEXT,
  time_end        TEXT,
  location        TEXT    NOT NULL DEFAULT '',
  max_participants INTEGER NOT NULL DEFAULT 0,
  actual_participants INTEGER NOT NULL DEFAULT 0,
  animator_name   TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'planned',
  materials_needed TEXT   NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',
  linked_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  synced_from     TEXT    NOT NULL DEFAULT '',
  last_sync_at    TEXT,
  external_id     TEXT,
  is_shared       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_external ON activities(external_id);

-- ─── Inventory ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'other',
  quantity        INTEGER NOT NULL DEFAULT 1,
  condition       TEXT    NOT NULL DEFAULT 'bon',
  location        TEXT    NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',
  inventory_type  TEXT    NOT NULL DEFAULT 'consumable',
  synced_from     TEXT    NOT NULL DEFAULT '',
  last_sync_at    TEXT,
  external_id     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_external ON inventory(external_id);

-- ─── Staff ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name      TEXT    NOT NULL,
  last_name       TEXT    NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'other',
  phone           TEXT    NOT NULL DEFAULT '',
  email           TEXT    NOT NULL DEFAULT '',
  service         TEXT    NOT NULL DEFAULT '',
  is_available    INTEGER NOT NULL DEFAULT 1,
  notes           TEXT    NOT NULL DEFAULT '',
  synced_from     TEXT    NOT NULL DEFAULT '',
  last_sync_at    TEXT,
  external_id     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_external ON staff(external_id);

-- ─── Residents (animation only — no medical/RGPD data) ──────
CREATE TABLE IF NOT EXISTS residents (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name        TEXT    NOT NULL,
  room_number         TEXT    NOT NULL DEFAULT '',
  interests           TEXT    NOT NULL DEFAULT '',
  animation_notes     TEXT    NOT NULL DEFAULT '',
  participation_level TEXT    NOT NULL DEFAULT 'moderate',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Photo Albums ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photo_albums (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  activity_date   TEXT    NOT NULL,
  cover_path      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Photos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id        INTEGER NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
  file_path       TEXT    NOT NULL,
  caption         TEXT    NOT NULL DEFAULT '',
  taken_at        TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id);

-- ─── Sync Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  module          TEXT    NOT NULL,
  direction       TEXT    NOT NULL DEFAULT 'pull',
  items_synced    INTEGER NOT NULL DEFAULT 0,
  items_failed    INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  status          TEXT    NOT NULL DEFAULT 'syncing',
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_module ON sync_log(module);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);

-- ─── Animation Budget ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS animation_budget (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year     INTEGER NOT NULL UNIQUE,
  total_allocated REAL    NOT NULL DEFAULT 0,
  synced_from     TEXT    NOT NULL DEFAULT '',
  last_sync_at    TEXT,
  external_id     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Expenses (dépenses animation) ──────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year             INTEGER NOT NULL,
  title                   TEXT    NOT NULL,
  category                TEXT    NOT NULL DEFAULT 'other',
  amount                  REAL    NOT NULL DEFAULT 0,
  date                    TEXT    NOT NULL,
  description             TEXT    NOT NULL DEFAULT '',
  supplier                TEXT    NOT NULL DEFAULT '',
  invoice_path            TEXT,
  linked_intervenant_id   TEXT,
  synced_from             TEXT    NOT NULL DEFAULT '',
  last_sync_at            TEXT,
  external_id             TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_external ON expenses(external_id);

-- ─── Sync settings defaults ─────────────────────────────────
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sync_email', '');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sync_auto_enabled', 'true');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sync_interval_minutes', '15');
