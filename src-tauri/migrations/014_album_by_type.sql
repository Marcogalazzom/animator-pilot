-- ╔══════════════════════════════════════════════════════════╗
-- ║  Migration 014 — Albums par type d'activité              ║
-- ║  Ex: un album "Loto - Avril 2026" partagé par toutes les ║
-- ║  sessions de loto du mois, au lieu d'un album par        ║
-- ║  instance d'activité.                                     ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE photo_albums ADD COLUMN activity_type TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_albums_type ON photo_albums(activity_type);
