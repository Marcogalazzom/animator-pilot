-- Journal v2 fields (prototype alignment): per-entry title, time (HH:MM),
-- author (animator's display name) and category (chip color).
ALTER TABLE journal ADD COLUMN title    TEXT NOT NULL DEFAULT '';
ALTER TABLE journal ADD COLUMN time     TEXT NOT NULL DEFAULT '';
ALTER TABLE journal ADD COLUMN author   TEXT NOT NULL DEFAULT '';
ALTER TABLE journal ADD COLUMN category TEXT NOT NULL DEFAULT 'prep';
CREATE INDEX IF NOT EXISTS idx_journal_category ON journal(category);
