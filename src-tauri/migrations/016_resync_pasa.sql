-- Force a full re-pull of activities on next sync so that PASA
-- activities previously excluded by the old `where('unit','==','main')`
-- filter (and skipped by the createdAt > lastSync guard on every
-- subsequent sync) finally get backfilled.
DELETE FROM sync_log WHERE module = 'activities';
