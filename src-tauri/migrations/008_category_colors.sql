-- Stocke les couleurs associées aux catégories (inventaire, fournisseurs, ...).
-- Les lignes manquantes sont créées automatiquement à la volée depuis le front
-- avec une couleur générée par hash du nom (stable).

CREATE TABLE IF NOT EXISTS category_colors (
  module TEXT NOT NULL,
  name   TEXT NOT NULL,
  color  TEXT NOT NULL,
  bg     TEXT NOT NULL,
  label  TEXT,
  PRIMARY KEY (module, name)
);

-- Seed catégories inventaire historiques
INSERT OR IGNORE INTO category_colors (module, name, color, bg, label) VALUES
  ('inventory', 'materiel_animation', '#1E40AF', '#EFF6FF', 'Matériel animation'),
  ('inventory', 'jeux',               '#7C3AED', '#F5F3FF', 'Jeux'),
  ('inventory', 'fournitures',        '#059669', '#ECFDF5', 'Fournitures'),
  ('inventory', 'decoration',         '#D97706', '#FFFBEB', 'Décoration'),
  ('inventory', 'musique',            '#DC2626', '#FEF2F2', 'Musique'),
  ('inventory', 'sport',              '#0F766E', '#F0FDFA', 'Sport / Motricité'),
  ('inventory', 'therapeutique',      '#BE185D', '#FDF2F8', 'Thérapeutique'),
  ('inventory', 'other',              '#64748B', '#F1F5F9', 'Autre');

-- Seed catégories fournisseurs historiques
INSERT OR IGNORE INTO category_colors (module, name, color, bg, label) VALUES
  ('suppliers', 'alimentation',       '#EA580C', '#FFF7ED', 'Alimentation'),
  ('suppliers', 'materiel',           '#1E40AF', '#EFF6FF', 'Matériel / Loisirs'),
  ('suppliers', 'transport',          '#059669', '#ECFDF5', 'Transport'),
  ('suppliers', 'spectacle',          '#7C3AED', '#F5F3FF', 'Spectacle / Artiste'),
  ('suppliers', 'formation',          '#D97706', '#FFFBEB', 'Formation'),
  ('suppliers', 'location',           '#0F766E', '#F0FDFA', 'Location matériel'),
  ('suppliers', 'other',              '#64748B', '#F1F5F9', 'Autre');
