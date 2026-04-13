-- Ajoute les tarifs horaires/séance aux intervenants (staff),
-- synchronisés depuis planning-ehpad (champs `tarif` et `tarifSeance`).

ALTER TABLE staff ADD COLUMN hourly_rate  REAL;
ALTER TABLE staff ADD COLUMN session_rate REAL;

-- Seed les rôles existants dans category_colors (module='staff')
-- pour que les chips aient des couleurs cohérentes. Les rôles bruts
-- de planning-ehpad (liberal/salarie/benevole) sont inclus.
INSERT OR IGNORE INTO category_colors (module, name, color, bg, label) VALUES
  ('staff', 'animateur',        '#1E40AF', '#EFF6FF', 'Animateur/trice'),
  ('staff', 'aide_soignant',    '#059669', '#ECFDF5', 'Aide-soignant(e)'),
  ('staff', 'infirmier',        '#7C3AED', '#F5F3FF', 'Infirmier/ère'),
  ('staff', 'medecin',          '#DC2626', '#FEF2F2', 'Médecin'),
  ('staff', 'psychologue',      '#D97706', '#FFFBEB', 'Psychologue'),
  ('staff', 'kinesitherapeute', '#0F766E', '#F0FDFA', 'Kinésithérapeute'),
  ('staff', 'ergotherapeute',   '#0EA5E9', '#F0F9FF', 'Ergothérapeute'),
  ('staff', 'ash',              '#8B5CF6', '#F5F3FF', 'ASH'),
  ('staff', 'cuisine',          '#EA580C', '#FFF7ED', 'Cuisine'),
  ('staff', 'direction',        '#1E293B', '#F1F5F9', 'Direction'),
  ('staff', 'administratif',    '#64748B', '#F8FAFC', 'Administratif'),
  ('staff', 'benevole',         '#EC4899', '#FDF2F8', 'Bénévole'),
  ('staff', 'liberal',          '#0891B2', '#ECFEFF', 'Libéral'),
  ('staff', 'salarie',          '#7C3AED', '#F5F3FF', 'Salarié'),
  ('staff', 'other',            '#64748B', '#F1F5F9', 'Autre');
