-- Design v2 alignment: extend models so the prototype's UI has fields to bind to.
-- ALTER ... ADD COLUMN is idempotent across runs only if the column doesn't exist;
-- we guard at runtime in src/db/database.ts (ensureXxxSchema) for safety.

-- ─── Residents ───────────────────────────────────────────────
ALTER TABLE residents ADD COLUMN birthday TEXT;
ALTER TABLE residents ADD COLUMN arrival_date TEXT;
ALTER TABLE residents ADD COLUMN mood TEXT NOT NULL DEFAULT 'calm';
ALTER TABLE residents ADD COLUMN family_contacts TEXT NOT NULL DEFAULT '';

-- ─── Activities (semantic categories + difficulty) ───────────
ALTER TABLE activities ADD COLUMN category TEXT NOT NULL DEFAULT 'prep';
ALTER TABLE activities ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'facile';

-- ─── Journal (visibility + resident tagging) ─────────────────
ALTER TABLE journal ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;
ALTER TABLE journal ADD COLUMN linked_resident_ids TEXT NOT NULL DEFAULT '';

-- ─── Projects (free category + next action) ──────────────────
ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN next_action TEXT NOT NULL DEFAULT '';

-- ─── User identity in app_settings ───────────────────────────
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_first_name', 'Marie');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_last_name',  'Coste');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_role',       'Animatrice');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('residence_name',  'Les Glycines');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('residence_kind',  'EHPAD');

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_residents_birthday ON residents(birthday);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_journal_shared ON journal(is_shared);
