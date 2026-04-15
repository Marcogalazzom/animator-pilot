-- Recurring activities from planning-ehpad are stored as a single doc
-- that appears in every week via `isRecurring`. Previously the sync
-- stored one local row anchored to the doc's original weekId (often
-- months old), making PASA activities invisible in upcoming views.
--
-- v0.5.3 materialises recurring docs into N weekly instances. Nuke any
-- planning-ehpad-synced rows + sync_log so the next sync rebuilds the
-- entire local dataset with the new expansion logic.
ALTER TABLE activities ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_activities_recurring ON activities(is_recurring);

DELETE FROM activities WHERE synced_from = 'planning-ehpad';
DELETE FROM sync_log WHERE module = 'activities';
