# EHPAD Pilot — Phase 2 : Conformité & Budget — Spec

## Contexte

La Phase 1 a livré un MVP fonctionnel (Dashboard, KPIs, Projets, Import, Export PDF, Paramètres). La Phase 2 ajoute 3 modules métier essentiels pour une directrice d'EHPAD : la conformité réglementaire, la gestion budgétaire avancée (EPRD/ERRD), et la relation avec les tutelles (ARS, CD). Ces modules utilisent la même stack, le même design system, et les mêmes patterns que la Phase 1.

**Aucune donnée RGPD sensible** — uniquement des données agrégées, des obligations, des montants, et des échanges institutionnels (par fonction, pas par nom).

---

## Module 1 : Conformité réglementaire

**Route :** `/compliance`
**Sidebar :** nouvel item "Conformité" avec icône `ShieldCheck` (Lucide), entre "Import" et "Paramètres"

### Nouvelles tables

```sql
-- compliance_obligations: obligations réglementaires
CREATE TABLE compliance_obligations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,          -- governance, quality, security, hr
  frequency TEXT NOT NULL,          -- annual, biannual, triennial, quinquennial, permanent, periodic
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'to_plan', -- compliant, in_progress, non_compliant, to_plan
  next_due_date TEXT,               -- prochaine échéance YYYY-MM-DD
  last_validated_date TEXT,         -- dernière validation
  document_path TEXT,               -- chemin local vers un fichier
  is_builtin INTEGER NOT NULL DEFAULT 0, -- 1 si pré-rempli
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_obligations_category ON compliance_obligations(category);
CREATE INDEX idx_obligations_status ON compliance_obligations(status);
CREATE INDEX idx_obligations_due ON compliance_obligations(next_due_date);
```

### Référentiel pré-rempli (is_builtin = 1)

**governance** : CPOM (quinquennial), Projet d'établissement (quinquennial), CVS (triennial — 3 réunions/an), Règlement de fonctionnement (quinquennial), Livret d'accueil (annual)

**quality** : Évaluation HAS (quinquennial), Rapport d'activité annuel (annual), Enquête satisfaction (annual), Tableau de bord ANAP (annual)

**security** : Plan Bleu (annual), DUERP (annual), Registre sécurité incendie (periodic), Commission de sécurité (quinquennial), Plan de formation (annual)

**hr** : Bilan social (annual), Entretiens professionnels (biannual), Affichages obligatoires (permanent)

Le seed s'exécute au premier lancement (INSERT OR IGNORE).

### Écrans

**1. Dashboard conformité** (haut de page)
- 4 cartes : % conformité global, obligations conformes, en retard, prochaines 30 jours
- Barre de progression globale

**2. Tableau des obligations** (vue principale)
- Colonnes : Obligation, Catégorie (badge), Fréquence, Prochaine échéance, Statut (badge coloré), Document
- Filtres : catégorie, statut, échéance (30/60/90 jours)
- Tri par colonne
- Clic sur ligne → détail/édition

**3. Vue calendrier** (toggle)
- Timeline horizontale 12 mois
- Barres colorées par catégorie aux dates d'échéance
- Clic sur un item → détail

**4. Détail/édition obligation** (panneau latéral)
- Tous les champs éditables (titre, description, catégorie, fréquence, dates, statut)
- Lier un document (chemin local)
- Historique : quand le statut a changé pour la dernière fois
- Bouton "Marquer conforme" (met à jour statut + last_validated_date)
- Supprimer (seulement si is_builtin = 0)

**5. Ajout d'obligation** (modal)
- Titre, catégorie (dropdown), fréquence, description, échéance

---

## Module 2 : Gestion budgétaire avancée

**Route :** `/budget`
**Sidebar :** nouvel item "Budget" avec icône `Wallet` (Lucide), entre "KPIs" et "Projets"

### Nouvelles tables

```sql
-- budget_sections: les 3 sections tarifaires + total
CREATE TABLE budget_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,               -- hebergement, dependance, soins
  label TEXT NOT NULL,              -- "Hébergement", "Dépendance", "Soins"
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- budget_lines: lignes budgétaires (charges et produits)
CREATE TABLE budget_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES budget_sections(id),
  title_number INTEGER NOT NULL,    -- Titre 1, 2, 3, 4 (EPRD)
  line_label TEXT NOT NULL,         -- ex: "Charges de personnel"
  line_type TEXT NOT NULL,          -- charge, produit
  amount_previsionnel REAL NOT NULL DEFAULT 0,
  amount_realise REAL NOT NULL DEFAULT 0,
  fiscal_year INTEGER NOT NULL,     -- ex: 2026
  period TEXT,                      -- YYYY-MM pour suivi mensuel, NULL pour annuel
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_budget_lines_section ON budget_lines(section_id);
CREATE INDEX idx_budget_lines_year ON budget_lines(fiscal_year);

-- investments: suivi des investissements
CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount_planned REAL NOT NULL DEFAULT 0,
  amount_committed REAL NOT NULL DEFAULT 0,
  amount_realized REAL NOT NULL DEFAULT 0,
  funding_source TEXT DEFAULT '',    -- autofinancement, emprunt, subvention
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, in_progress, completed
  fiscal_year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Seed des sections tarifaires

3 sections créées au premier lancement : Hébergement, Dépendance, Soins.

### Structure EPRD/ERRD

**Charges (par section) :**
- Titre 1 : Charges de personnel (salaires, charges sociales, formation, intérim...)
- Titre 2 : Charges à caractère médical (médicaments, dispositifs médicaux, labo...)
- Titre 3 : Charges à caractère hôtelier et général (alimentation, entretien, énergie, assurances...)
- Titre 4 : Amortissements, provisions, charges financières

**Produits (par section) :**
- Titre 1 : Produits de la tarification (dotation ARS, dotation CD, tarifs hébergement)
- Titre 2 : Autres produits relatifs à l'exploitation
- Titre 3 : Produits financiers et produits non encaissables

**Résultat = Produits - Charges** par section et total.

**CAF = Résultat + Amortissements + Provisions (dotation nette)**

### Écrans

**1. Dashboard Budget** (page d'accueil du module)
- Sélecteur d'exercice fiscal (année)
- 3 cartes résumé par section : total charges, total produits, résultat
- Carte CAF prévisionnelle
- Graphique : Charges vs Produits par section (BarChart Recharts)
- Graphique : Évolution mensuelle du réalisé (LineChart)
- Alerte si dépassement budget

**2. EPRD** (tableau de saisie prévisionnel)
- Tableau EPRD complet par section
- Pour chaque titre : lignes de détail avec montant prévisionnel
- Sous-totaux par titre, total par section, total général
- Saisie directe dans le tableau (inline edit)
- Calcul automatique des résultats et CAF

**3. ERRD** (tableau réalisé)
- Même structure que EPRD
- Colonnes supplémentaires : Prévu, Réalisé, Écart (€), Écart (%)
- Possibilité de saisie mensuelle (ventilation par mois)
- Alertes visuelles sur les écarts significatifs (>5%, >10%)

**4. Détail par section** (sous-page)
- Sélection section (Hébergement/Dépendance/Soins)
- Tableau mensuel détaillé : Jan-Déc avec prévu/réalisé
- Graphique de suivi mensuel

**5. Investissements** (sous-page)
- Liste des investissements avec barre de progression
- Formulaire ajout/édition
- Total par source de financement

**6. Export EPRD/ERRD en PDF**

---

## Module 3 : Relation tutelles

**Route :** `/tutelles`
**Sidebar :** nouvel item "Tutelles" avec icône `Landmark` (Lucide), entre "Conformité" et "Paramètres"

### Nouvelles tables

```sql
-- authority_events: échéances et événements institutionnels
CREATE TABLE authority_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- cpom, budget_campaign, evaluation, inspection, commission, dialogue, other
  authority TEXT NOT NULL,            -- ars, cd, has, prefecture, other
  date_start TEXT,
  date_end TEXT,
  status TEXT NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  notes TEXT DEFAULT '',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,              -- annual, quinquennial, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_date ON authority_events(date_start);
CREATE INDEX idx_events_type ON authority_events(event_type);

-- authority_correspondences: courriers et échanges
CREATE TABLE authority_correspondences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES authority_events(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  direction TEXT NOT NULL,           -- sent, received
  type TEXT NOT NULL,                -- letter, email, meeting, phone
  authority TEXT NOT NULL,           -- ars, cd, has, prefecture, other
  contact_role TEXT DEFAULT '',      -- fonction de l'interlocuteur
  subject TEXT NOT NULL,
  content TEXT DEFAULT '',           -- notes/résumé
  document_path TEXT,                -- chemin local
  status TEXT NOT NULL DEFAULT 'sent', -- sent, received, awaiting_reply, archived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_correspondences_date ON authority_correspondences(date);
CREATE INDEX idx_correspondences_authority ON authority_correspondences(authority);

-- preparation_checklists: checklists de préparation
CREATE TABLE preparation_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES authority_events(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT '',          -- documents, indicators, persons, attention
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checklists_event ON preparation_checklists(event_id);
```

### Calendrier pré-rempli

Événements récurrents créés au seed :
- Dépôt EPRD (avril, annuel, ARS)
- Dialogue de gestion (juin, annuel, ARS+CD)
- Dépôt ERRD (avril N+1, annuel, ARS)
- Renouvellement CPOM (quinquennal, ARS+CD)
- Évaluation HAS (quinquennal, HAS)

### Modèles de checklists

Pour chaque type d'événement, checklist type pré-remplie :

**Inspection ARS** : Registre de sécurité à jour, DUERP à jour, Protocoles de soins accessibles, Effectifs présents le jour J, Affichages obligatoires vérifiés...

**Évaluation HAS** : Auto-évaluation réalisée, Projet d'établissement à jour, Indicateurs qualité compilés, Enquête satisfaction récente, PAP à jour...

**Dialogue de gestion** : ERRD finalisé, Indicateurs activité compilés, Points de négociation préparés, Bilan CPOM intermédiaire...

### Écrans

**1. Calendrier** (vue principale)
- Timeline 12 mois (horizontal, scrollable)
- Événements en barres colorées par autorité (ARS=bleu, CD=vert, HAS=orange, Préfecture=rouge)
- Mois en cours mis en évidence
- Clic → détail événement

**2. Liste des événements** (vue alternative)
- Tableau : Événement, Autorité (badge), Type, Date, Statut
- Filtres par autorité, type, statut
- Bouton "Nouvel événement"

**3. Détail événement** (panneau latéral)
- Infos éditables : titre, type, autorité, dates, statut, notes
- **Checklist de préparation** : items cochables, ajout/suppression
- **Courriers liés** : liste des correspondances liées à cet événement
- Bouton "Ajouter un courrier"

**4. Courriers** (sous-page)
- Tableau : Date, Type (badge), Direction (envoyé/reçu), Autorité, Objet, Statut
- Filtres par autorité, direction, statut
- Détail/édition en panneau latéral
- Modèles de courrier (texte pré-rempli)

---

## Modifications transversales

### Navigation

Mise à jour de la sidebar et du routing pour 8 pages :
1. `/` — Tableau de bord
2. `/kpis` — KPIs
3. `/budget` — Budget (NOUVEAU)
4. `/projects` — Projets
5. `/compliance` — Conformité (NOUVEAU)
6. `/tutelles` — Tutelles (NOUVEAU)
7. `/import` — Import
8. `/settings` — Paramètres

### Migration DB

Nouvelle migration `002_phase2.sql` avec toutes les nouvelles tables + seed du référentiel conformité + seed des sections budgétaires + seed du calendrier institutionnel.

### Couche d'accès DB

Nouveaux fichiers :
- `src/db/compliance.ts` — CRUD obligations
- `src/db/budget.ts` — CRUD sections, lignes budgétaires, investissements
- `src/db/tutelles.ts` — CRUD événements, correspondances, checklists
- Mise à jour de `src/db/types.ts` et `src/db/index.ts`

---

## Vérification

1. `npm run tauri dev` — les 3 nouveaux modules sont accessibles via la sidebar
2. Le référentiel conformité est pré-rempli au premier lancement
3. Les sections budgétaires (Hébergement, Dépendance, Soins) sont créées
4. Le calendrier institutionnel a les événements récurrents
5. CRUD complet sur chaque module
6. Export PDF du tableau EPRD/ERRD
7. `npm run test` — les nouveaux tests passent
8. `npm run build` — build de production OK
