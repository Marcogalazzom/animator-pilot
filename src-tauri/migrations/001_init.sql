-- kpi_entries: stores KPI values per period
CREATE TABLE kpi_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,        -- occupation, finance, rh, qualite
  indicator TEXT NOT NULL,       -- e.g. "taux_occupation"
  value REAL NOT NULL,
  period TEXT NOT NULL,          -- e.g. "2026-03" (monthly)
  source TEXT NOT NULL DEFAULT 'manual', -- manual, import
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- kpi_thresholds: alert thresholds per indicator
CREATE TABLE kpi_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator TEXT NOT NULL UNIQUE,
  warning REAL,                  -- orange threshold
  critical REAL,                 -- red threshold
  direction TEXT NOT NULL DEFAULT 'below' -- above or below (alert if value is above/below threshold)
);

-- projects: establishment projects
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_role TEXT DEFAULT '',    -- function, NOT name (e.g. "IDEC", "Directrice")
  status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, done, overdue
  start_date TEXT,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- actions: sub-tasks linked to projects
CREATE TABLE actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, done
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- import_history: tracks file imports
CREATE TABLE import_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' -- success, error
);

-- Indexes
CREATE INDEX idx_kpi_entries_period_category ON kpi_entries(period, category);
CREATE INDEX idx_kpi_entries_indicator ON kpi_entries(indicator);
CREATE INDEX idx_actions_project_id ON actions(project_id);

-- app_settings: key-value settings store
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
