-- Per-category spending limits on animation_budget
-- Default 3000 € per category.
ALTER TABLE animation_budget ADD COLUMN limit_intervenants REAL NOT NULL DEFAULT 3000;
ALTER TABLE animation_budget ADD COLUMN limit_materiel     REAL NOT NULL DEFAULT 3000;
ALTER TABLE animation_budget ADD COLUMN limit_sorties      REAL NOT NULL DEFAULT 3000;
ALTER TABLE animation_budget ADD COLUMN limit_fetes        REAL NOT NULL DEFAULT 3000;
ALTER TABLE animation_budget ADD COLUMN limit_other        REAL NOT NULL DEFAULT 3000;
