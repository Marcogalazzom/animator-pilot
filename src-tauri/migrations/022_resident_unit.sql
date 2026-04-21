-- Rattachement d'un résident à une unité / étage personnalisable.
-- La liste des unités est stockée en JSON dans app_settings (clé residence_units).
ALTER TABLE residents ADD COLUMN unit TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_residents_unit ON residents(unit);

-- Seed des unités par défaut (Étage 1 / Étage 2 / UPG Bastille / UPG Saint-Hilaire)
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('residence_units', '["Étage 1","Étage 2","UPG Bastille","UPG Saint-Hilaire"]');
