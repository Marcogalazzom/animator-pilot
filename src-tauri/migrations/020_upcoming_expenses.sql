-- Upcoming / scheduled expenses shown in Budget → Solde rapide → À l'arrivée
-- Supports both one-time (recurring=0) and recurring (recurring=1, frequency set).
CREATE TABLE IF NOT EXISTS upcoming_expenses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  amount     REAL    NOT NULL DEFAULT 0,
  due_date   TEXT    NOT NULL,
  recurring  INTEGER NOT NULL DEFAULT 0,
  frequency  TEXT    NOT NULL DEFAULT '',
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_upcoming_due ON upcoming_expenses(due_date);
