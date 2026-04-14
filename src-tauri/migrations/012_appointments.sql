-- ╔══════════════════════════════════════════════════════════╗
-- ║  Migration 012 — Rendez-vous pro de l'animateur         ║
-- ║  (Réunions, fournisseurs, formations, entretiens, etc.)  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS appointments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  appointment_type  TEXT    NOT NULL DEFAULT 'other',
  date              TEXT    NOT NULL,
  time_start        TEXT,
  time_end          TEXT,
  location          TEXT    NOT NULL DEFAULT '',
  participants      TEXT    NOT NULL DEFAULT '',
  description       TEXT    NOT NULL DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'planned',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type);
