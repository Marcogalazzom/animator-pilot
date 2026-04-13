# Calendar & Upcoming Activities — Redesign

## Contexte

L'animatrice gère ~40 activités par semaine réparties sur 5 lieux (UPG Bastille, UPG Saint-Hilaire, Étage 1, Étage 2, PASA, RDC) avec des créneaux denses (parfois 8 activités dans une journée). Le calendrier actuel les affiche en **liste groupée par mois**, ce qui devient illisible au-delà d'une semaine. Par ailleurs :

- `activity_type` utilise encore un map figé (`ACTIVITY_TYPE_MAP`) au lieu du pattern `category_colors` unifié avec inventory/suppliers/staff.
- `time_end` n'est pas peuplé (champ Firestore absent) — aucune vue horaire précise possible.
- La section "Prochaines activités" du Dashboard montre 5 entrées sans contexte temporel (pas de séparation "aujourd'hui" / "plus tard").

Le but est de refaire les vues calendrier et le digest Dashboard pour un usage quotidien réel d'une animatrice : **consulter sa journée, planifier sa semaine, localiser ses activités par lieu**.

## Objectifs

1. Vue **Jour** utilisable au quotidien avec créneau "maintenant" surligné.
2. Vue **Semaine** permettant un aperçu d'ensemble lun-dim × matin/après-midi.
3. Vue **Lieux** pour naviguer par bâtiment/unité.
4. Vue **Liste** chronologique simple pour recherche/filtrage.
5. Dashboard avec digest court-terme (aujourd'hui + prochaines).
6. Uniformiser `activity_type` avec le pattern `category_colors` (module='activities').

## Architecture

### Page Calendrier (onglets)

Route unique `/calendar` avec un toolbar fixe en haut :

- **Sélecteur de vue** : `Jour · Semaine · Lieux · Liste` (toggle buttons)
- **Navigation date** : `◀ [date courante] ▶ · Aujourd'hui`
- **Filtre type** : chip multi-sélection (Bien-être, Jeux, Musique, etc.) — utilise `category_colors` module='activities'
- **Filtre lieu** : dropdown (tous les lieux uniques)

State dans l'URL : `?view=day|week|location|list&date=YYYY-MM-DD`. Permet le partage / retour navigateur.

### Vue Jour

Liste chronologique compacte :

```
┌─ mer. 15 avril — 8 activités ────────────────────────┐
│ 10:30  Jeux sensoriels    [Bien-être] · UPG Bastille  │
│ 10:30  Jeux sensoriels    [Bien-être] · UPG St-Hil.   │
│ 10:30  Revue de presse    [Lecture]   · Étage 2       │
│ ▸ 14:30  Yoga — relaxation  [Bien-être] · Étage 1     │ ← "maintenant"
│ 15:00  Scrabble           [Jeux]      · PASA          │
│ 15:00  Lecture collective [Intergé.]  · Étage 2       │
│ 16:00  Atelier mémoire    [Jeux]      · Étage 1       │
│ 16:00  Atelier mémoire    [Jeux]      · Étage 2       │
└───────────────────────────────────────────────────────┘
```

Chaque ligne : `[time_start] [title strong] [chip activity_type] · [location muted] [animator_name muted]`.

Ligne "en cours" (time_start est le créneau le plus proche de l'heure actuelle, dans la demi-heure courante) : fond jaune clair + flèche.

### Vue Semaine

Grille 7 colonnes (lun→dim) × 2 lignes (Matin avant midi / Après-midi après midi) :

- Header ligne : "Lun 13 · Mar 14 · [Mer 15 highlight] · Jeu 16 · ..."
- Cellule : mini-cartes empilées avec `[hh:mm] [title tronqué]`, couleur fond = category_color bg
- Jour "aujourd'hui" : fond bleu clair sur le header et le corps
- Week-end : fond grisé si pas d'activités
- Cellules denses : si > 3 mini-cartes, affiche "10:30 Jeux sensoriels ×2" (regroupement par heure/titre)

### Vue Lieux

Swimlanes horizontales pour le jour courant :

```
UPG Bastille     | [10:30 Jeux] [14:00 Lecture] [14:30 Volley]
UPG St-Hilaire   | [10:30 Jeux]
Étage 1          | [14:30 Yoga]
Étage 2          | [15:00 Lecture] [16:00 Atelier mém.]
PASA             | [15:00 Scrabble]
RDC              | (vide)
```

Liste des lieux : extraite dynamiquement des `DISTINCT location FROM activities WHERE date = ?`, triée alphabétiquement. Ordre stable (pas de réorganisation au fil de la journée).

Navigation date en haut (jour par jour comme vue Jour). Option future : semaine complète avec lieux × jours.

### Vue Liste

Liste chronologique de toutes les activités futures (et passées en scroll haut), avec recherche textuelle + filtres type/lieu/statut. Remplace la vue mensuelle actuelle. Regroupement par jour avec séparateur sticky.

### Dashboard digest

Deux panneaux côte-à-côte (ou empilés sur mobile) :

1. **Aujourd'hui** : timeline verticale compacte des activités du jour, ligne "maintenant" surlignée (comme Vue Jour mais sans chip catégorie pour compacité).
2. **Prochaines** : 5 prochaines activités après aujourd'hui, format `[Jeu 16 · 15:00]` + titre + lieu.

Remplace l'actuelle liste `upcomingActivities` du Dashboard.

## Changements modèle de données

### Migration 010 — Activities category_colors

- Seed `category_colors` module='activities' avec les types historiques de `Activities.tsx` (`atelier_creatif`, `musique`, `jeux`, etc.).
- Pas de nouvelle colonne sur la table `activities`.
- `activity_type` devient un string libre (comme inventory/suppliers/staff).

### Sync (syncService.ts)

- Supprimer `ACTIVITY_TYPE_MAP` et `ACTIVITY_TYPE_REVERSE`.
- PULL : stocker `data.type` brut dans `activity_type` (avec fallback `'other'` si vide).
- PUSH : envoyer `activity_type` brut (plus de reverse map). Accepter que certaines valeurs ne soient pas reconnues par planning-ehpad — non-bloquant.
- `time_end` reste NULL (pas de champ Firestore, hors scope).

### Types

- `ActivityType` → `string` (suppression du union type).
- Pas de changement `Activity` interface.

## Composants

Fichiers à créer :

- `src/pages/calendar/DayView.tsx`
- `src/pages/calendar/WeekView.tsx`
- `src/pages/calendar/LocationView.tsx`
- `src/pages/calendar/ListView.tsx`
- `src/pages/calendar/CalendarToolbar.tsx`
- `src/pages/calendar/useCalendarEvents.ts` (remplace `useCalendarData.ts`)
- `src/pages/dashboard/TodayTimeline.tsx`
- `src/pages/dashboard/UpcomingFeed.tsx`

Fichiers à modifier :

- `src/pages/Calendar.tsx` : devient un routeur interne qui délègue à la vue active selon URL params.
- `src/pages/Activities.tsx` : remplacer `TYPES` const par un hook `useCategoryColors('activities')`, datalist dans le form.
- `src/pages/Dashboard.tsx` : intégrer `<TodayTimeline />` et `<UpcomingFeed />`.
- `src/db/types.ts` : `ActivityType` → `string`.
- `src/services/syncService.ts` : nettoyage ACTIVITY_TYPE_MAP.
- `src-tauri/migrations/010_activity_categories.sql` (nouveau).
- `src-tauri/src/lib.rs` : enregistrer migration 010.

## Hook useCalendarEvents

```ts
interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time: string | null; // HH:MM
  type: string;       // raw activity_type
  location: string;
  animator: string;
  status: string;
  source: 'activity' | 'project';
  link: string;       // /activities ou /projects
}

useCalendarEvents(): {
  events: CalendarEvent[];
  loading: boolean;
  byDay(date: string): CalendarEvent[];
  byWeek(mondayDate: string): Record<string /*YYYY-MM-DD*/, CalendarEvent[]>;
  byLocation(date: string): Record<string, CalendarEvent[]>;
  upcoming(fromDate: string, limit: number): CalendarEvent[];
}
```

Les helpers sont triés (time ASC puis title).

## Vérification

1. Ouvrir Calendrier → 4 onglets fonctionnent, URL reflète la vue.
2. Vue Jour : naviguer ◀ ▶, voir le créneau "maintenant" surligné (tester avec une heure proche).
3. Vue Semaine : voir 8 activités du mercredi dans la cellule "après-midi" de Mer 15.
4. Vue Lieux : voir "UPG Bastille" avec 3 activités alignées par heure.
5. Vue Liste : recherche "yoga" filtre instantanément.
6. Filtres type/lieu persistent en changeant de vue.
7. Dashboard affiche 2 panneaux (aujourd'hui + prochaines) au lieu d'une liste unique.
8. Synchroniser activités : types arrivent en brut (ex: `cognitive`, `boardgames`) avec couleur auto-générée via `category_colors`.
9. Page Activities affiche chip catégorie coloré pour chaque type (fallback couleur hash pour types inconnus).
10. `npm run build` et `cargo check` passent sans erreur.

## Hors scope

- Édition d'activité depuis la vue calendrier (reste via Activities.tsx).
- Drag-and-drop d'activités.
- Gestion de `time_end` / durée (nécessite changement Firestore côté planning-ehpad).
- Récurrence visuelle (les activités arrivent déjà individuelles depuis la sync).
- Vue mois (remplacée par Liste).
