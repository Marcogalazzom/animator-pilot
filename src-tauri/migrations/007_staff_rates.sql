-- Suppliers: tarifs horaire et par séance pour les intervenants
ALTER TABLE suppliers ADD COLUMN hourly_rate REAL;
ALTER TABLE suppliers ADD COLUMN session_rate REAL;
