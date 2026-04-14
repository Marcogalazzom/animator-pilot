-- ╔══════════════════════════════════════════════════════════╗
-- ║  Migration 013 — Photos & Famileo                        ║
-- ║  Lien album ↔ activité + miniatures                      ║
-- ╚══════════════════════════════════════════════════════════╝

-- Lien album ↔ activité (optionnel)
ALTER TABLE photo_albums ADD COLUMN activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_albums_activity ON photo_albums(activity_id);

-- Miniature pour affichage rapide de la grille
ALTER TABLE photos ADD COLUMN thumbnail_path TEXT;
