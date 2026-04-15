ALTER TABLE activities ADD COLUMN unit TEXT NOT NULL DEFAULT 'main';
CREATE INDEX IF NOT EXISTS idx_activities_unit ON activities(unit);
