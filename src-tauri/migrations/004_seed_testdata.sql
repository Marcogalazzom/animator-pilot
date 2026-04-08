-- ═══════════════════════════════════════════════════════════════
-- SEED: Données de test réalistes pour un EHPAD de 80 lits
-- ═══════════════════════════════════════════════════════════════

-- ── Budget : Lignes EPRD 2026 pour les 3 sections ────────────

-- HÉBERGEMENT (section_id = 1)
-- Charges
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (1, 1, 'Salaires et traitements', 'charge', 820000, 205000, 2026),
  (1, 1, 'Charges sociales', 'charge', 330000, 82500, 2026),
  (1, 1, 'Personnel intérimaire', 'charge', 45000, 12000, 2026),
  (1, 1, 'Formation', 'charge', 18000, 4500, 2026),
  (1, 3, 'Alimentation', 'charge', 195000, 48750, 2026),
  (1, 3, 'Entretien et réparations', 'charge', 65000, 16250, 2026),
  (1, 3, 'Énergie et fluides', 'charge', 85000, 22000, 2026),
  (1, 3, 'Assurances', 'charge', 28000, 7000, 2026),
  (1, 3, 'Fournitures diverses', 'charge', 22000, 5500, 2026),
  (1, 4, 'Amortissements', 'charge', 120000, 30000, 2026),
  (1, 4, 'Provisions', 'charge', 15000, 0, 2026),
  (1, 4, 'Charges financières', 'charge', 35000, 8750, 2026);
-- Produits
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (1, 1, 'Tarif hébergement résidents', 'produit', 1580000, 395000, 2026),
  (1, 2, 'Recettes annexes hébergement', 'produit', 45000, 11250, 2026),
  (1, 3, 'Produits financiers', 'produit', 8000, 2000, 2026);

-- DÉPENDANCE (section_id = 2)
-- Charges
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (2, 1, 'Salaires et traitements', 'charge', 210000, 52500, 2026),
  (2, 1, 'Charges sociales', 'charge', 85000, 21250, 2026),
  (2, 3, 'Fournitures dépendance', 'charge', 32000, 8000, 2026),
  (2, 4, 'Amortissements', 'charge', 12000, 3000, 2026);
-- Produits
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (2, 1, 'Dotation dépendance (CD)', 'produit', 345000, 86250, 2026),
  (2, 2, 'Participations résidents APA', 'produit', 18000, 4500, 2026);

-- SOINS (section_id = 3)
-- Charges
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (3, 1, 'Salaires et traitements', 'charge', 580000, 145000, 2026),
  (3, 1, 'Charges sociales', 'charge', 235000, 58750, 2026),
  (3, 1, 'Personnel intérimaire', 'charge', 38000, 12000, 2026),
  (3, 2, 'Médicaments', 'charge', 95000, 24000, 2026),
  (3, 2, 'Dispositifs médicaux', 'charge', 62000, 15500, 2026),
  (3, 2, 'Laboratoire', 'charge', 28000, 7000, 2026),
  (3, 4, 'Amortissements matériel médical', 'charge', 45000, 11250, 2026);
-- Produits
INSERT INTO budget_lines (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year) VALUES
  (3, 1, 'Dotation globale soins (ARS)', 'produit', 1090000, 272500, 2026),
  (3, 2, 'Recettes soins complémentaires', 'produit', 12000, 3000, 2026);

-- ── Investissements ──────────────────────────────────────────

INSERT INTO investments (title, description, amount_planned, amount_committed, amount_realized, funding_source, start_date, end_date, status, fiscal_year) VALUES
  ('Rénovation salle de bain aile B', 'Mise aux normes PMR des 12 salles de bain de l''aile B', 180000, 180000, 45000, 'Emprunt + Autofinancement', '2026-02-01', '2026-09-30', 'in_progress', 2026),
  ('Renouvellement lits médicalisés', 'Remplacement de 20 lits vétustes', 60000, 60000, 60000, 'Autofinancement', '2026-01-15', '2026-03-15', 'completed', 2026),
  ('Système d''appel malade', 'Modernisation du système d''appel dans les 3 ailes', 95000, 0, 0, 'Subvention ARS + Autofinancement', '2026-06-01', '2026-12-31', 'planned', 2026);

-- ── ANAP : Valeurs établissement (proches des moyennes) ──────

UPDATE anap_indicators SET value_etablissement = 94.2, value_regional = 92.8 WHERE indicator_key = 'taux_occupation' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 2.6, value_regional = 2.9 WHERE indicator_key = 'duree_moyenne_sejour' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 87.1, value_regional = 85.8 WHERE indicator_key = 'age_moyen_entree' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 0.65, value_regional = 0.60 WHERE indicator_key = 'ratio_soignants' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 9.8, value_regional = 11.0 WHERE indicator_key = 'taux_absenteisme' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 16.2, value_regional = 19.5 WHERE indicator_key = 'turnover' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 71.00, value_regional = 73.20 WHERE indicator_key = 'cout_journalier_hebergement' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 20.50, value_regional = 22.00 WHERE indicator_key = 'cout_journalier_dependance' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 40.20, value_regional = 37.50 WHERE indicator_key = 'cout_journalier_soins' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 3.8, value_regional = 4.5 WHERE indicator_key = 'taux_chutes' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 14.5, value_regional = 16.2 WHERE indicator_key = 'taux_hospitalisation' AND fiscal_year = 2024;
UPDATE anap_indicators SET value_etablissement = 8.1, value_regional = 7.6 WHERE indicator_key = 'satisfaction_globale' AND fiscal_year = 2024;

-- ── Veille réglementaire ─────────────────────────────────────

INSERT INTO regulatory_watch (title, category, source, url, date_published, summary, is_read) VALUES
  ('Loi relative à l''adaptation de la société au vieillissement (ASV)', 'legislation', 'Légifrance', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031700731', '2015-12-28', 'Loi cadre sur la prise en charge des personnes âgées, réforme de l''APA, droits des résidents en EHPAD, création du HCFEA.', 1),
  ('Référentiel d''évaluation de la qualité des ESSMS', 'has_recommendation', 'HAS', 'https://www.has-sante.fr/jcms/p_3336025/fr/evaluation-de-la-qualite-des-essms', '2022-03-01', 'Nouveau référentiel HAS pour l''évaluation externe des ESSMS. 9 thématiques, 42 critères dont 18 impératifs.', 1),
  ('Instruction relative à la campagne budgétaire 2026 des EHPAD', 'ars_circular', 'ARS', '', '2026-02-15', 'Circulaire budgétaire annuelle : taux de reconduction, mesures nouvelles, modalités de dépôt EPRD/ERRD.', 0),
  ('Recommandation : Accompagnement de la fin de vie en EHPAD', 'has_recommendation', 'HAS', 'https://www.has-sante.fr/jcms/p_2073084/fr/accompagner-la-fin-de-vie', '2023-11-15', 'Recommandations pour l''accompagnement de la fin de vie des résidents, organisation des soins palliatifs.', 0),
  ('Décret relatif au ratio minimal de soignants en EHPAD', 'legislation', 'Légifrance', '', '2025-09-01', 'Fixation du ratio minimal de soignants par résident dans les EHPAD publics et privés.', 0),
  ('Guide ANAP : Pilotage médico-économique en EHPAD', 'other', 'ANAP', 'https://www.anap.fr', '2024-06-01', 'Guide pratique pour le pilotage des indicateurs médico-économiques en établissement.', 1);

-- ── Formations ───────────────────────────────────────────────

INSERT INTO training_tracking (title, category, hours_planned, hours_completed, fiscal_year, notes) VALUES
  ('Sécurité incendie et évacuation', 'securite', 14, 14, 2026, 'Formation obligatoire annuelle, tous les agents'),
  ('Bientraitance et prévention de la maltraitance', 'soins', 21, 7, 2026, 'Formation en 3 sessions, 2ème session prévue en mai'),
  ('HACCP et hygiène alimentaire', 'securite', 7, 7, 2026, 'Personnel de cuisine — session réalisée en janvier'),
  ('Gestes et postures — manutention des résidents', 'soins', 14, 0, 2026, 'Prévu au 2ème semestre avec un organisme externe'),
  ('Management d''équipe pour les cadres', 'management', 21, 14, 2026, 'IDEC et cadre de santé, 2 sessions sur 3 réalisées');

-- ── Tutelles : Événements 2026 avec dates ────────────────────

UPDATE authority_events SET date_start = '2026-04-15', date_end = '2026-04-30', status = 'in_progress' WHERE title = 'Dépôt EPRD';
UPDATE authority_events SET date_start = '2026-06-20', date_end = '2026-06-20', status = 'planned' WHERE title = 'Dialogue de gestion';
UPDATE authority_events SET date_start = '2027-04-15', date_end = '2027-04-30', status = 'planned' WHERE title = 'Dépôt ERRD';
UPDATE authority_events SET date_start = '2028-01-01', date_end = '2028-12-31', status = 'planned' WHERE title = 'Renouvellement CPOM';
UPDATE authority_events SET date_start = '2027-09-01', date_end = '2027-12-31', status = 'planned' WHERE title = 'Évaluation HAS';

-- Événements additionnels
INSERT INTO authority_events (title, event_type, authority, date_start, date_end, status, notes, is_recurring, recurrence_rule) VALUES
  ('Inspection inattendue ARS', 'inspection', 'ars', '2026-03-10', '2026-03-10', 'completed', 'Inspection sans préavis. RAS, rapport favorable reçu le 15/04.', 0, NULL),
  ('Commission de sécurité', 'commission', 'prefecture', '2026-11-15', '2026-11-15', 'planned', 'Passage prévu de la commission de sécurité incendie', 0, NULL),
  ('Réunion CPOM intermédiaire', 'cpom', 'ars', '2026-09-25', '2026-09-25', 'planned', 'Bilan à mi-parcours du CPOM avec l''ARS et le CD', 0, NULL);

-- ── Correspondances test ─────────────────────────────────────

INSERT INTO authority_correspondences (event_id, date, direction, type, authority, contact_role, subject, content, status) VALUES
  ((SELECT id FROM authority_events WHERE title = 'Dépôt EPRD'), '2026-04-14', 'sent', 'letter', 'ars', 'Délégué territorial', 'Transmission EPRD 2026', 'Veuillez trouver ci-joint l''État Prévisionnel des Recettes et Dépenses pour l''exercice 2026.', 'sent'),
  ((SELECT id FROM authority_events WHERE title = 'Inspection inattendue ARS'), '2026-04-15', 'received', 'letter', 'ars', 'Inspecteur ARS', 'Rapport d''inspection du 10/03/2026', 'Rapport favorable. Aucune non-conformité relevée. Recommandation : poursuivre le plan d''amélioration qualité.', 'received'),
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), '2026-05-20', 'received', 'email', 'ars', 'Chargé de mission', 'Convocation dialogue de gestion', 'Vous êtes convoqué(e) au dialogue de gestion annuel le 20 juin 2026 à 14h dans les locaux de l''ARS.', 'received'),
  (NULL, '2026-02-10', 'sent', 'letter', 'cd', 'Chef de service PA', 'Demande de moyens complémentaires dépendance', 'Demande motivée de revalorisation de la dotation dépendance suite à l''augmentation du GMP.', 'awaiting_reply');

-- ── Checklists de préparation ────────────────────────────────

INSERT INTO preparation_checklists (event_id, item_text, is_done, category, sort_order) VALUES
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), 'Finaliser l''ERRD 2025', 0, 'documents', 1),
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), 'Compiler les indicateurs d''activité 2025', 0, 'indicators', 2),
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), 'Préparer le bilan CPOM intermédiaire', 0, 'documents', 3),
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), 'Identifier les points de négociation', 0, 'attention', 4),
  ((SELECT id FROM authority_events WHERE title = 'Dialogue de gestion'), 'Prévenir l''IDEC et le médecin coordonnateur', 1, 'persons', 5),
  ((SELECT id FROM authority_events WHERE title = 'Commission de sécurité'), 'Vérifier le registre de sécurité incendie', 0, 'documents', 1),
  ((SELECT id FROM authority_events WHERE title = 'Commission de sécurité'), 'Contrôler les extincteurs et issues de secours', 0, 'attention', 2),
  ((SELECT id FROM authority_events WHERE title = 'Commission de sécurité'), 'S''assurer que le Plan Bleu est à jour', 0, 'documents', 3),
  ((SELECT id FROM authority_events WHERE title = 'Commission de sécurité'), 'Préparer le rapport de la dernière exercice incendie', 0, 'documents', 4);

-- ── Mise à jour conformité avec des dates réalistes ──────────

UPDATE compliance_obligations SET next_due_date = '2026-12-31', status = 'compliant', last_validated_date = '2025-12-15' WHERE title = 'Plan Bleu';
UPDATE compliance_obligations SET next_due_date = '2026-06-30', status = 'in_progress', last_validated_date = '2025-06-30' WHERE title = 'DUERP';
UPDATE compliance_obligations SET next_due_date = '2026-04-30', status = 'compliant', last_validated_date = '2026-03-15' WHERE title = 'Conseil de la Vie Sociale';
UPDATE compliance_obligations SET next_due_date = '2026-09-30', status = 'to_plan' WHERE title = 'Enquête satisfaction';
UPDATE compliance_obligations SET next_due_date = '2026-12-31', status = 'compliant', last_validated_date = '2025-12-20' WHERE title = 'Rapport d''activité annuel';
UPDATE compliance_obligations SET next_due_date = '2026-12-31', status = 'in_progress' WHERE title = 'Plan de formation';
UPDATE compliance_obligations SET next_due_date = '2026-03-31', status = 'compliant', last_validated_date = '2026-03-10' WHERE title = 'Registre sécurité incendie';
UPDATE compliance_obligations SET next_due_date = '2026-12-31', status = 'compliant', last_validated_date = '2025-11-01' WHERE title = 'Bilan social';
UPDATE compliance_obligations SET next_due_date = '2026-06-30', status = 'compliant', last_validated_date = '2025-12-01' WHERE title = 'Livret d''accueil';
UPDATE compliance_obligations SET next_due_date = '2027-12-31', status = 'compliant', last_validated_date = '2023-06-15' WHERE title = 'Évaluation HAS';
UPDATE compliance_obligations SET next_due_date = '2026-12-31', status = 'to_plan' WHERE title = 'Tableau de bord ANAP';
UPDATE compliance_obligations SET next_due_date = '2029-12-31', status = 'compliant', last_validated_date = '2024-09-01' WHERE title = 'CPOM';
UPDATE compliance_obligations SET next_due_date = '2030-12-31', status = 'in_progress' WHERE title = 'Projet d''établissement';
