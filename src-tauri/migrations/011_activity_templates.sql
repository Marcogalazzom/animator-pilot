ALTER TABLE activities ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_activities_template ON activities(is_template);
