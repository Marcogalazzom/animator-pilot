# Activités — Refonte Ateliers & Activités

## Context

La page Activités actuelle (`src/pages/Activities.tsx`) affiche une liste plate de 149 activités avec un formulaire de 12 champs en modal. L'animatrice ne peut pas distinguer rapidement ce qui est passé/à venir, ne peut pas marquer la présence post-activité sans rouvrir la fiche, et n'a aucun système de modèles pour relancer rapidement les piliers de son agenda hebdomadaire.

Objectif : 3 onglets clairs (À venir / Passées / Bibliothèque) qui couvrent CRUD détaillé, suivi post-activité (présences, statut, notes), et bibliothèque de modèles.

## Objectifs

1. **À venir** : liste groupée par date avec card moyenne et actions inline (Terminer, Dupliquer, Modifier, Supprimer) au survol.
2. **Passées** : section "À confirmer" (passées sans clôture) en évidence, section "Terminées" en lecture, section "Annulées" repliée. Saisie des présences inline.
3. **Bibliothèque** : grille de modèles d'activités avec bouton "Programmer" qui pré-remplit une nouvelle activité ; "Sauvegarder comme modèle" depuis n'importe quelle activité passée.
4. **State URL** : `/activities?tab=upcoming|past|library` (default `upcoming`).

## Architecture

### Onglets

Toolbar haut de page (style cohérent avec `CalendarToolbar`) avec 3 pills : `À venir · Passées · Bibliothèque` + compteurs. Recherche et filtres (type, lieu) persistants. Bouton `+ Nouvelle activité` à droite.

### Onglet À venir (default)

- Liste des activités avec `status IN ('planned', 'in_progress')` ET `date >= aujourd'hui`, triées par date ASC puis time_start ASC.
- Groupement par buckets : `Aujourd'hui` · `Demain` · `Cette semaine` (jusqu'à dimanche) · `La semaine prochaine` · `Plus tard`. Headers section style `ListView` du calendrier (sticky, accent gauche bleu).
- **ActivityCard medium** par activité :
  - Ligne 1 : titre (14px gras) + chip catégorie + chip statut.
  - Ligne 2 (meta) : 📅 date · 🕐 heures · 📍 lieu · 👥 actual/max · 👤 animateur (icônes Lucide).
  - Bandeau actions au hover (`opacity 0 → 1`, transition 140ms) : `✓ Terminer` (vert) · `📋 Dupliquer` · `✏️ Modifier` · `🗑 Supprimer` (rouge).
  - Bordure gauche 3px en couleur catégorie.

### Onglet Passées

- **Section "À confirmer"** (fond `--color-now-bg`, accent orange) : `status='planned'` ET `date < aujourd'hui`. C'est la section prioritaire — l'animatrice doit clôturer ces activités.
  - Card avec input "Présents : __ / max" inline + boutons `✓ Clôturer` (vert) et `Annuler` (rouge léger).
- **Section "Terminées"** (accent vert) : `status='completed'`, triées par date DESC. Card affiche `X/Y ✓` et notes en italique.
- **Section "Annulées"** (accent gris, repliée par défaut) : `status='cancelled'`.
- Action menu kebab (3 dots) sur chaque card : `Sauvegarder comme modèle` (crée une nouvelle ligne `is_template=1` en copiant les champs réutilisables, l'activité originale reste intacte) · `Modifier` · `Supprimer`.

### Onglet Bibliothèque

- Grille 2-3 colonnes (responsive `repeat(auto-fill, minmax(280px, 1fr))`).
- Card par template : titre + chip type + ligne `📍 lieu · 🕐 durée · 👥 max` + ligne matériel + bouton `+ Programmer` pleine largeur (bleu).
- Card finale "+ Nouveau modèle" en bordure pointillés → ouvre formulaire en mode template.
- Modal "Programmer" : date + heures pré-cochées défaut (date = lundi prochain à l'heure du template), tous autres champs hérités du template, status='planned'.

### Modal formulaire

- Toggle haut "📋 Modèle" (vs activité programmée). Si modèle :
  - Cache les champs `date`, `time_start`, `time_end`, `status`, `actual_participants`.
  - Garde : titre, type, lieu, animator, max_participants, description, materials, notes.
- Sinon : formulaire actuel inchangé.

## Modèle de données

### Migration 011 — `is_template`

```sql
ALTER TABLE activities ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_activities_template ON activities(is_template);
```

Les templates sont des lignes `is_template=1` avec `date=NULL`, `time_start=NULL`, `time_end=NULL`. Tous les autres champs réutilisés.

### Types

```ts
// src/db/types.ts
export interface Activity {
  // ... champs existants
  is_template: number;  // 0 ou 1
}
```

### Requêtes ajoutées (`src/db/activities.ts`)

```ts
getUpcomingActivities(): Activity[]   // is_template=0 AND status IN ('planned','in_progress') AND date >= today
getPastActivities(): Activity[]       // is_template=0 AND (date < today OR status IN ('completed','cancelled'))
getTemplates(): Activity[]            // is_template=1
```

### Sync

`syncService.ts` ne push/pull que `is_template=0`. Templates restent locaux.

## Fichiers

### Nouveaux

- `src-tauri/migrations/011_activity_templates.sql`
- `src/pages/activities/useActivitiesData.ts` — hook qui retourne `{ upcoming, past, templates, types }` + helpers de groupement par bucket.
- `src/pages/activities/ActivitiesToolbar.tsx` — onglets + filtres.
- `src/pages/activities/UpcomingTab.tsx` — sections par bucket date.
- `src/pages/activities/PastTab.tsx` — sections À confirmer / Terminées / Annulées.
- `src/pages/activities/LibraryTab.tsx` — grille de templates.
- `src/pages/activities/ActivityCard.tsx` — card commune avec slot d'actions configurable.
- `src/pages/activities/ActivityFormModal.tsx` — formulaire (extrait du modal actuel + toggle Modèle).
- `src/pages/activities/ScheduleTemplateModal.tsx` — picker date/heure pour instancier un template.

### Modifiés

- `src/pages/Activities.tsx` → routeur léger (URL state, délègue à UpcomingTab/PastTab/LibraryTab).
- `src-tauri/src/lib.rs` → registre migration 011.
- `src/db/types.ts` → `is_template` field.
- `src/db/activities.ts` → 3 nouvelles queries + UPDATABLE_FIELDS étendu.
- `src/services/syncService.ts` → exclure `is_template=1` du PUSH/PULL.

## Vérification

1. Ouvrir Ateliers & Activités → 3 onglets affichés avec compteurs (140 / 9 / 0 au démarrage).
2. À venir : 8 cards d'aujourd'hui, hover → 4 boutons d'action visibles. Clic `Terminer` → status passe à completed, l'activité disparaît de À venir et apparaît dans Passées section "Terminées".
3. Clic `Dupliquer` → ouvre modal pré-remplie avec date d'aujourd'hui, sauvegarde crée une nouvelle entrée.
4. Passées : activités passées non-clôturées en "À confirmer" jaune. Saisir 5 puis clic `Clôturer` → passe en "Terminées" verte avec `5/12 ✓`.
5. Menu kebab d'une activité Terminée → `Sauvegarder comme modèle` → apparaît dans Bibliothèque.
6. Bibliothèque : clic `+ Programmer` sur un template → modal date/heure → submit → nouvelle entrée dans À venir.
7. URL `/activities?tab=library` ouvre direct le bon onglet.
8. `npm run build`, `npx tsc --noEmit`, `npx vitest run` passent.

## Hors scope

- Activités récurrentes (création automatique d'occurrences) — autre spec.
- Sélection multiple / actions groupées (clôturer 5 activités d'un coup).
- Photos ou pièces jointes par activité.
- Statistiques de participation, graphes.
- Refonte structurelle du formulaire (les champs et leur ordre restent comme aujourd'hui, on ajoute juste le toggle Modèle).
