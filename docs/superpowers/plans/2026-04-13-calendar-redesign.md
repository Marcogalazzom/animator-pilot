# Calendar & Upcoming Activities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la liste mensuelle du calendrier par 4 vues (Jour/Semaine/Lieux/Liste) + digest Dashboard, et uniformiser `activity_type` avec le pattern `category_colors`.

**Architecture:** Page `/calendar` avec toolbar (sélecteur de vue + nav date + filtres), URL state `?view=X&date=Y`. Un hook `useCalendarEvents` expose des helpers purs (`byDay`, `byWeek`, `byLocation`, `upcoming`) consommés par les 4 vues et par les nouveaux blocs Dashboard.

**Tech Stack:** React 19, TypeScript, vitest + React Testing Library, tauri-plugin-sql (SQLite), React Router v7.

**Spec:** [`docs/superpowers/specs/2026-04-13-calendar-redesign-design.md`](../specs/2026-04-13-calendar-redesign-design.md)

---

## File Structure

### Nouveaux fichiers

- `src-tauri/migrations/010_activity_categories.sql` — seed activity_type colors
- `src/pages/calendar/useCalendarEvents.ts` — hook données + helpers
- `src/pages/calendar/__tests__/useCalendarEvents.test.ts` — tests helpers
- `src/pages/calendar/CalendarToolbar.tsx` — barre d'outils (view + date + filtres)
- `src/pages/calendar/DayView.tsx` — liste chronologique + marqueur "maintenant"
- `src/pages/calendar/WeekView.tsx` — grille 7 jours × matin/après-midi
- `src/pages/calendar/LocationView.tsx` — swimlanes par lieu
- `src/pages/calendar/ListView.tsx` — liste complète avec recherche
- `src/pages/dashboard/TodayTimeline.tsx` — mini-timeline aujourd'hui
- `src/pages/dashboard/UpcomingFeed.tsx` — 5 prochaines activités

### Fichiers modifiés

- `src-tauri/src/lib.rs` — enregistrer migration 010
- `src/db/types.ts` — `ActivityType` → `string`
- `src/services/syncService.ts` — supprimer `ACTIVITY_TYPE_MAP` / `ACTIVITY_TYPE_REVERSE`, stocker type brut
- `src/pages/Activities.tsx` — remplacer `TYPES`/`TYPE_KEYS` constants par `useCategoryColors('activities')`
- `src/pages/Calendar.tsx` — délégation vers les vues selon URL
- `src/pages/Dashboard.tsx` — intégrer `<TodayTimeline />` et `<UpcomingFeed />`

### Supprimé

- `src/pages/calendar/useCalendarData.ts` (remplacé par `useCalendarEvents.ts`)

---

## Phase 1 — Foundation (types + data)

### Task 1: Migration 010 — seed activity categories

**Files:**
- Create: `src-tauri/migrations/010_activity_categories.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Créer la migration**

```sql
-- Seed les types d'activités historiques dans category_colors
-- (pattern unifié avec inventory/suppliers/staff — cf. migration 008).
INSERT OR IGNORE INTO category_colors (module, name, color, bg, label) VALUES
  ('activities', 'atelier_creatif',    '#7C3AED', '#F5F3FF', 'Atelier créatif'),
  ('activities', 'musique',             '#1E40AF', '#EFF6FF', 'Musique'),
  ('activities', 'jeux',                '#059669', '#ECFDF5', 'Jeux'),
  ('activities', 'sortie',              '#D97706', '#FFFBEB', 'Sortie'),
  ('activities', 'sport',               '#0F766E', '#F0FDFA', 'Sport / Motricité'),
  ('activities', 'lecture',             '#8B5CF6', '#F5F3FF', 'Lecture'),
  ('activities', 'cuisine',             '#EA580C', '#FFF7ED', 'Cuisine'),
  ('activities', 'bien_etre',           '#EC4899', '#FDF2F8', 'Bien-être'),
  ('activities', 'intergenerationnel',  '#0EA5E9', '#F0F9FF', 'Intergénérationnel'),
  ('activities', 'fete',                '#DC2626', '#FEF2F2', 'Fête / Événement'),
  ('activities', 'cognitive',           '#10B981', '#ECFDF5', 'Cognitif'),
  ('activities', 'boardgames',          '#059669', '#ECFDF5', 'Jeux de société'),
  ('activities', 'creative',            '#7C3AED', '#F5F3FF', 'Créatif'),
  ('activities', 'music',               '#1E40AF', '#EFF6FF', 'Musique'),
  ('activities', 'food',                '#EA580C', '#FFF7ED', 'Cuisine'),
  ('activities', 'social',              '#0EA5E9', '#F0F9FF', 'Social'),
  ('activities', 'outing',              '#D97706', '#FFFBEB', 'Sortie'),
  ('activities', 'festive',             '#DC2626', '#FEF2F2', 'Fête'),
  ('activities', 'sensory',             '#EC4899', '#FDF2F8', 'Sensoriel'),
  ('activities', 'reading',             '#8B5CF6', '#F5F3FF', 'Lecture'),
  ('activities', 'press',               '#8B5CF6', '#F5F3FF', 'Presse'),
  ('activities', 'volleyball',          '#0F766E', '#F0FDFA', 'Volley'),
  ('activities', 'vr',                  '#6366F1', '#EEF2FF', 'VR / Réalité virtuelle'),
  ('activities', 'animal',              '#92400E', '#FEF3C7', 'Médiation animale'),
  ('activities', 'religious',           '#475569', '#F1F5F9', 'Culte'),
  ('activities', 'cinema',              '#1E293B', '#F1F5F9', 'Cinéma'),
  ('activities', 'other',               '#64748B', '#F1F5F9', 'Autre');
```

- [ ] **Step 2: Enregistrer la migration dans lib.rs**

Dans `src-tauri/src/lib.rs`, après le bloc migration 9 :

```rust
Migration {
    version: 10,
    description: "seed activity category colors",
    sql: include_str!("../migrations/010_activity_categories.sql"),
    kind: MigrationKind::Up,
},
```

- [ ] **Step 3: Vérifier cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: `Finished dev profile` sans erreur.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/010_activity_categories.sql src-tauri/src/lib.rs
git commit -m "feat(db): seed activity category colors (migration 010)"
```

---

### Task 2: Types — ActivityType → string

**Files:**
- Modify: `src/db/types.ts`

- [ ] **Step 1: Relâcher le type union**

Dans `src/db/types.ts`, trouver :

```ts
export type ActivityType = 'atelier_creatif' | 'musique' | 'jeux' | 'sortie' | 'sport' | 'lecture' | 'cuisine' | 'bien_etre' | 'intergenerationnel' | 'fete' | 'other';
```

Remplacer par :

```ts
export type ActivityType = string;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur. Les endroits qui utilisent `ActivityType` (Activities.tsx, Calendar.tsx) continuent de compiler car `string` est plus permissif.

- [ ] **Step 3: Commit**

```bash
git add src/db/types.ts
git commit -m "refactor(types): ActivityType becomes string (category_colors pattern)"
```

---

### Task 3: syncService — supprimer ACTIVITY_TYPE_MAP / REVERSE

**Files:**
- Modify: `src/services/syncService.ts`

- [ ] **Step 1: Supprimer les deux constantes + leurs usages**

Dans `src/services/syncService.ts` :

Supprimer les blocs :

```ts
const ACTIVITY_TYPE_MAP: Record<string, string> = { ... };
const ACTIVITY_TYPE_REVERSE: Record<string, string> = { ... };
```

Remplacer dans le PULL (chercher `ACTIVITY_TYPE_MAP[data.type]`) :

```ts
const activityType = ACTIVITY_TYPE_MAP[data.type] ?? 'other';
```

par :

```ts
const activityType = typeof data.type === 'string' && data.type ? data.type : 'other';
```

Remplacer dans le PUSH (chercher `ACTIVITY_TYPE_REVERSE[a.activity_type]`) :

```ts
const firestoreType = ACTIVITY_TYPE_REVERSE[a.activity_type] ?? 'cognitive';
```

par :

```ts
const firestoreType = a.activity_type || 'other';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/services/syncService.ts
git commit -m "refactor(sync): store raw activity type (no more ACTIVITY_TYPE_MAP)"
```

---

### Task 4: Activities.tsx — utiliser category_colors

**Files:**
- Modify: `src/pages/Activities.tsx`

- [ ] **Step 1: Ajouter les imports + state catégories**

En haut de `src/pages/Activities.tsx`, après les imports existants :

```ts
import {
  ensureCategoryColors, autoColor, categoryLabel,
  type CategoryColor,
} from '@/db/categoryColors';
```

Supprimer le bloc `const TYPES: Record<ActivityType, ...> = { ... };` et `const TYPE_KEYS = Object.keys(TYPES) ...`.

- [ ] **Step 2: Remplacer dans le composant**

Dans le composant `Activities`, ajouter state + load :

```ts
const [types, setTypes] = useState<CategoryColor[]>([]);
// ... dans useEffect existant, après setActivities(rows) :
const cats = await ensureCategoryColors('activities', rows.map((r) => r.activity_type));
setTypes(cats);
```

(Modifier `useEffect` pour utiliser un IIFE async comme dans Inventory.tsx.)

Ajouter juste avant le return :

```ts
const typeMap = new Map(types.map((c) => [c.name, c]));
function typeFor(name: string): CategoryColor {
  const existing = typeMap.get(name);
  if (existing) return existing;
  const { color, bg } = autoColor(name);
  return { module: 'activities', name, color, bg, label: null };
}
```

- [ ] **Step 3: Remplacer chaque usage de TYPES**

Rechercher dans Activities.tsx chaque `TYPES[a.activity_type]` et remplacer par `typeFor(a.activity_type)`. Remplacer chaque `.label` résultant par `categoryLabel(typeFor(...))` OU garder `.label` (car CategoryColor.label peut être null, utiliser `categoryLabel()` pour sécurité).

Remplacer le dropdown filtre (chercher `{TYPE_KEYS.map(...)}`) par :

```tsx
{types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
```

Remplacer le select du formulaire par un `<input list>` + `<datalist>` (pattern Inventory.tsx) :

```tsx
<input
  name="activity_type"
  list="activity-types"
  defaultValue={editActivity?.activity_type ?? 'jeux'}
  placeholder="Tapez ou choisissez..."
  style={{ /* ... styles similaires */ }}
/>
<datalist id="activity-types">
  {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
</datalist>
```

Dans `handleSubmit`, après `create/update`, ajouter :

```ts
const cats = await ensureCategoryColors('activities', [data.activity_type]);
setTypes(cats);
```

- [ ] **Step 4: Typecheck + manual**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Activities.tsx
git commit -m "refactor(activities): use category_colors for type chips"
```

---

### Task 5: Hook useCalendarEvents + tests

**Files:**
- Create: `src/pages/calendar/useCalendarEvents.ts`
- Create: `src/pages/calendar/__tests__/useCalendarEvents.test.ts`
- Delete: `src/pages/calendar/useCalendarData.ts`

- [ ] **Step 1: Écrire les tests des helpers purs**

Créer `src/pages/calendar/__tests__/useCalendarEvents.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  buildEventsFromDb,
  byDay, byWeek, byLocation, upcoming,
  type CalendarEvent,
} from '../useCalendarEvents';
import type { Activity, Project } from '@/db/types';

function evt(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'a-1',
    title: 'Test',
    date: '2026-04-15',
    time: '14:00',
    type: 'jeux',
    location: 'Étage 1',
    animator: '',
    status: 'planned',
    source: 'activity',
    link: '/activities',
    ...overrides,
  };
}

describe('byDay', () => {
  it('filtre et trie par time ASC', () => {
    const events = [
      evt({ id: '1', time: '15:00' }),
      evt({ id: '2', time: '10:30' }),
      evt({ id: '3', date: '2026-04-16', time: '09:00' }),
      evt({ id: '4', time: null }),
    ];
    const result = byDay(events, '2026-04-15');
    expect(result.map((e) => e.id)).toEqual(['4', '2', '1']);
  });
});

describe('byWeek', () => {
  it('groupe par date (YYYY-MM-DD) pour 7 jours à partir du lundi', () => {
    const events = [
      evt({ date: '2026-04-13' }),
      evt({ date: '2026-04-15' }),
      evt({ date: '2026-04-15' }),
      evt({ date: '2026-04-20' }),
    ];
    const result = byWeek(events, '2026-04-13');
    expect(Object.keys(result)).toEqual([
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16',
      '2026-04-17', '2026-04-18', '2026-04-19',
    ]);
    expect(result['2026-04-15']).toHaveLength(2);
    expect(result['2026-04-20']).toBeUndefined();
  });
});

describe('byLocation', () => {
  it('groupe par location pour un jour donné, trié par time', () => {
    const events = [
      evt({ id: '1', location: 'PASA',    time: '15:00' }),
      evt({ id: '2', location: 'Étage 1', time: '14:30' }),
      evt({ id: '3', location: 'PASA',    time: '10:30' }),
    ];
    const result = byLocation(events, '2026-04-15');
    expect(Object.keys(result).sort()).toEqual(['PASA', 'Étage 1'].sort());
    expect(result['PASA'].map((e) => e.id)).toEqual(['3', '1']);
  });
});

describe('upcoming', () => {
  it('limite et filtre les dates >= fromDate, trie chronologique', () => {
    const events = [
      evt({ id: '1', date: '2026-04-14' }),
      evt({ id: '2', date: '2026-04-15', time: '14:00' }),
      evt({ id: '3', date: '2026-04-15', time: '10:30' }),
      evt({ id: '4', date: '2026-04-16' }),
      evt({ id: '5', date: '2026-04-17' }),
    ];
    const result = upcoming(events, '2026-04-15', 3);
    expect(result.map((e) => e.id)).toEqual(['3', '2', '4']);
  });
});

describe('buildEventsFromDb', () => {
  it('fusionne activities et projects en événements triés', () => {
    const activities: Activity[] = [{
      id: 1, title: 'Yoga', activity_type: 'bien_etre', description: '',
      date: '2026-04-15', time_start: '14:30', time_end: null, location: 'Étage 1',
      max_participants: 0, actual_participants: 0, animator_name: 'Nom',
      status: 'planned', materials_needed: '', notes: '',
      linked_project_id: null, synced_from: '', last_sync_at: null,
      external_id: null, is_shared: 1, created_at: '2026-04-15',
    }];
    const projects: Project[] = [{
      id: 2, title: 'Bilan', status: 'in_progress', description: '',
      due_date: '2026-04-20', priority: 'high', category: '',
      progress: 0, assigned_to: '', created_at: '2026-04-01',
    } as Project];
    const events = buildEventsFromDb(activities, projects);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Yoga');
    expect(events[0].source).toBe('activity');
    expect(events[1].source).toBe('project');
  });
});
```

- [ ] **Step 2: Run les tests — ils doivent échouer**

Run: `npx vitest run src/pages/calendar/__tests__/useCalendarEvents.test.ts`
Expected: FAIL (imports not found).

- [ ] **Step 3: Écrire useCalendarEvents.ts**

Créer `src/pages/calendar/useCalendarEvents.ts` :

```ts
import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getActivities } from '@/db/activities';
import type { Activity, Project } from '@/db/types';

export type CalendarSource = 'activity' | 'project';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  time: string | null;     // HH:MM (null pour les projects)
  type: string;            // activity_type ou 'project'
  location: string;
  animator: string;
  status: string;
  source: CalendarSource;
  link: string;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function buildEventsFromDb(
  activities: Activity[],
  projects: Project[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const a of activities) {
    if (a.status === 'cancelled') continue;
    const d = parseDate(a.date);
    if (!d) continue;
    events.push({
      id: `a-${a.id}`,
      title: a.title,
      date: toIso(d),
      time: a.time_start || null,
      type: a.activity_type,
      location: a.location ?? '',
      animator: a.animator_name ?? '',
      status: a.status,
      source: 'activity',
      link: '/activities',
    });
  }

  for (const p of projects) {
    if (p.status === 'done') continue;
    const d = parseDate(p.due_date);
    if (!d) continue;
    events.push({
      id: `p-${p.id}`,
      title: p.title,
      date: toIso(d),
      time: null,
      type: 'project',
      location: '',
      animator: '',
      status: p.status,
      source: 'project',
      link: '/projects',
    });
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const at = a.time ?? '';
    const bt = b.time ?? '';
    return at.localeCompare(bt);
  });
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at !== bt) return at.localeCompare(bt);
  return a.title.localeCompare(b.title);
}

export function byDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date === date).sort(compareEvents);
}

export function byWeek(
  events: CalendarEvent[],
  mondayDate: string,
): Record<string, CalendarEvent[]> {
  const monday = new Date(mondayDate + 'T00:00:00');
  const result: Record<string, CalendarEvent[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[toIso(d)] = [];
  }
  for (const e of events) {
    if (e.date in result) result[e.date].push(e);
  }
  for (const k of Object.keys(result)) result[k].sort(compareEvents);
  return result;
}

export function byLocation(
  events: CalendarEvent[],
  date: string,
): Record<string, CalendarEvent[]> {
  const result: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (e.date !== date) continue;
    const loc = e.location || '(sans lieu)';
    if (!result[loc]) result[loc] = [];
    result[loc].push(e);
  }
  for (const k of Object.keys(result)) result[k].sort(compareEvents);
  return result;
}

export function upcoming(
  events: CalendarEvent[],
  fromDate: string,
  limit: number,
): CalendarEvent[] {
  return events.filter((e) => e.date >= fromDate).sort(compareEvents).slice(0, limit);
}

export interface CalendarData {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

export function useCalendarEvents(): CalendarData {
  const [events, setEvents]   = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [activities, projects] = await Promise.all([
          getActivities().catch(() => [] as Activity[]),
          getProjects().catch(() => [] as Project[]),
        ]);
        if (cancelled) return;
        setEvents(buildEventsFromDb(activities, projects));
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { events, loading, error };
}
```

- [ ] **Step 4: Run les tests — ils doivent passer**

Run: `npx vitest run src/pages/calendar/__tests__/useCalendarEvents.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Supprimer l'ancien hook**

```bash
rm src/pages/calendar/useCalendarData.ts
```

Vérifier qu'aucun fichier ne l'importe (Calendar.tsx sera refait en Task 11) :

Run: `grep -rn "useCalendarData" src/` (exclure le hook supprimé)
Expected : une seule référence dans `Calendar.tsx`, que le Task 11 corrige.

- [ ] **Step 6: Commit**

```bash
git add src/pages/calendar/useCalendarEvents.ts src/pages/calendar/__tests__/useCalendarEvents.test.ts
git rm src/pages/calendar/useCalendarData.ts
git commit -m "feat(calendar): useCalendarEvents hook with byDay/byWeek/byLocation/upcoming helpers"
```

---

## Phase 2 — Calendar views

### Task 6: CalendarToolbar component

**Files:**
- Create: `src/pages/calendar/CalendarToolbar.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

export type CalendarView = 'day' | 'week' | 'location' | 'list';

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Jour', week: 'Semaine', location: 'Lieux', list: 'Liste',
};

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  date: string;                // YYYY-MM-DD
  onDateChange: (d: string) => void;
  dateLabel: string;           // ex: "mer. 15 avril" ou "Semaine du 13 avril"
  types: CategoryColor[];
  typeFilter: string;          // '' ou nom de type
  onTypeFilterChange: (v: string) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  onToday: () => void;
}

export default function CalendarToolbar(p: Props) {
  const shift = (days: number) => {
    const d = new Date(p.date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    p.onDateChange(d.toISOString().slice(0, 10));
  };
  const step = p.view === 'week' ? 7 : 1;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
      <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => p.onViewChange(v)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: p.view === v ? 'var(--color-primary)' : 'var(--color-surface)',
              color: p.view === v ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {p.view !== 'list' && (
        <>
          <button onClick={() => shift(-step)} style={btnIcon}><ChevronLeft size={14} /></button>
          <span style={{ minWidth: '160px', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>{p.dateLabel}</span>
          <button onClick={() => shift(step)} style={btnIcon}><ChevronRight size={14} /></button>
          <button onClick={p.onToday} style={btnMini}>Aujourd'hui</button>
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <select value={p.typeFilter} onChange={(e) => p.onTypeFilterChange(e.target.value)} style={selectStyle}>
          <option value="">Tous types</option>
          {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
        </select>
        <select value={p.locationFilter} onChange={(e) => p.onLocationFilterChange(e.target.value)} style={selectStyle}>
          <option value="">Tous lieux</option>
          {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

const btnIcon: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', borderRadius: '6px', cursor: 'pointer',
};
const btnMini: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', borderRadius: '6px', cursor: 'pointer',
  fontSize: '12px', fontFamily: 'var(--font-sans)',
};
const selectStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid var(--color-border)',
  borderRadius: '6px', fontSize: '12px', background: 'var(--color-surface)',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/calendar/CalendarToolbar.tsx
git commit -m "feat(calendar): CalendarToolbar component"
```

---

### Task 7: DayView component

**Files:**
- Create: `src/pages/calendar/DayView.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useNavigate } from 'react-router-dom';
import { byDay, type CalendarEvent } from './useCalendarEvents';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  date: string;                       // YYYY-MM-DD
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DayView({ events, date, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  function typeFor(name: string): CategoryColor {
    return typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };
  }

  const dayEvents = byDay(events, date).filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const isToday = date === todayIso();
  const now = nowTimeString();

  // L'activité "en cours" : la dernière dont time <= now (si aujourd'hui).
  const currentId = (() => {
    if (!isToday) return null;
    let pick: string | null = null;
    for (const e of dayEvents) {
      if (e.time && e.time <= now) pick = e.id;
    }
    return pick;
  })();

  if (dayEvents.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucune activité ce jour.</p>;
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {dayEvents.map((e) => {
        const t = typeFor(e.type);
        const isCurrent = e.id === currentId;
        return (
          <div
            key={e.id}
            onClick={() => navigate(e.link)}
            style={{
              display: 'flex', gap: '12px', padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: isCurrent ? '#FEF9EE' : 'transparent',
              cursor: 'pointer',
              alignItems: 'center',
            }}
          >
            <div style={{ width: '60px', fontWeight: 600, fontSize: '13px', color: isCurrent ? '#D97706' : 'var(--color-text-primary)' }}>
              {isCurrent && '▸ '}{e.time ?? '—'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '13px' }}>
                {e.title}
                {' '}
                <span style={{
                  fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                  color: t.color, backgroundColor: t.bg, marginLeft: '4px',
                }}>{categoryLabel(t)}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {e.location || '(sans lieu)'}
                {e.animator && ` · ${e.animator}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/calendar/DayView.tsx
git commit -m "feat(calendar): DayView chronological list with now marker"
```

---

### Task 8: WeekView component

**Files:**
- Create: `src/pages/calendar/WeekView.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useNavigate } from 'react-router-dom';
import { byWeek, type CalendarEvent } from './useCalendarEvents';
import { autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  mondayDate: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}`;
}

export default function WeekView({ events, mondayDate, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = events.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const grouped = byWeek(filtered, mondayDate);
  const days = Object.keys(grouped);
  const today = todayIso();

  function splitMorningAfternoon(list: CalendarEvent[]) {
    const morning: CalendarEvent[] = [];
    const afternoon: CalendarEvent[] = [];
    for (const e of list) {
      const t = e.time ?? '';
      if (t && t < '12:00') morning.push(e);
      else afternoon.push(e);
    }
    return { morning, afternoon };
  }

  function renderCell(e: CalendarEvent) {
    const c = colorFor(e.type);
    return (
      <div
        key={e.id}
        onClick={() => navigate(e.link)}
        style={{
          fontSize: '10px', padding: '3px 5px', marginBottom: '2px',
          background: c.bg, color: c.color, borderRadius: '3px',
          cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        title={`${e.time ?? ''} ${e.title} · ${e.location}`}
      >
        <strong>{e.time ?? ''}</strong> {e.title}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
        <div />
        {days.map((d, i) => {
          const isToday = d === today;
          const isWeekend = i >= 5;
          return (
            <div
              key={d}
              style={{
                padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 600,
                background: isToday ? '#EFF6FF' : 'transparent',
                color: isWeekend ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                borderLeft: '1px solid var(--color-border)',
              }}
            >
              {DAY_LABELS[i]} {shortDate(d)}
            </div>
          );
        })}
      </div>

      {(['morning', 'afternoon'] as const).map((slot) => (
        <div key={slot} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)', minHeight: '90px' }}>
          <div style={{ padding: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', borderRight: '1px solid var(--color-border)' }}>
            {slot === 'morning' ? 'Matin' : 'Après-midi'}
          </div>
          {days.map((d) => {
            const list = grouped[d];
            const { morning, afternoon } = splitMorningAfternoon(list);
            const cellList = slot === 'morning' ? morning : afternoon;
            const isToday = d === today;
            return (
              <div
                key={d}
                style={{
                  padding: '6px', borderLeft: '1px solid var(--color-border)',
                  background: isToday ? '#F8FAFF' : 'transparent',
                }}
              >
                {cellList.map(renderCell)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/calendar/WeekView.tsx
git commit -m "feat(calendar): WeekView 7-days × morning/afternoon grid"
```

---

### Task 9: LocationView component

**Files:**
- Create: `src/pages/calendar/LocationView.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useNavigate } from 'react-router-dom';
import { byLocation, type CalendarEvent } from './useCalendarEvents';
import { autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  date: string;
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

export default function LocationView({ events, date, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = events.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (locationFilter && e.location !== locationFilter) return false;
    return true;
  });

  const grouped = byLocation(filtered, date);
  const locations = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'fr'));

  if (locations.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucune activité ce jour.</p>;
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {locations.map((loc) => (
        <div key={loc} style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ width: '140px', padding: '12px', fontWeight: 600, fontSize: '12px', borderRight: '1px solid var(--color-border)' }}>
            {loc}
          </div>
          <div style={{ flex: 1, padding: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {grouped[loc].map((e) => {
              const c = colorFor(e.type);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  style={{
                    fontSize: '11px', padding: '4px 8px', borderRadius: '4px',
                    background: c.bg, color: c.color, cursor: 'pointer',
                  }}
                  title={`${e.time ?? ''} ${e.title}${e.animator ? ' · ' + e.animator : ''}`}
                >
                  <strong>{e.time ?? '—'}</strong> {e.title}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/calendar/LocationView.tsx
git commit -m "feat(calendar): LocationView swimlanes per location"
```

---

### Task 10: ListView component

**Files:**
- Create: `src/pages/calendar/ListView.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { CalendarEvent } from './useCalendarEvents';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';

interface Props {
  events: CalendarEvent[];
  types: CategoryColor[];
  typeFilter: string;
  locationFilter: string;
}

const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

export default function ListView({ events, types, typeFilter, locationFilter }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const colorFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (locationFilter && e.location !== locationFilter) return false;
      if (search && !(`${e.title} ${e.location} ${e.animator}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [events, typeFilter, locationFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '400px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
        <input
          type="text" placeholder="Rechercher une activité, un lieu, un intervenant..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
        />
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {grouped.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
            Aucune activité.
          </p>
        )}
        {grouped.map(([date, list]) => (
          <div key={date}>
            <div style={{
              padding: '8px 16px', background: 'var(--color-background)',
              fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
              color: 'var(--color-text-secondary)', letterSpacing: '0.05em',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              {formatDay(date)}
            </div>
            {list.map((e) => {
              const c = colorFor(e.type);
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(e.link)}
                  style={{ display: 'flex', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', alignItems: 'center' }}
                >
                  <div style={{ width: '50px', fontSize: '12px', fontWeight: 600 }}>{e.time ?? '—'}</div>
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    {e.title}
                    {' '}
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', color: c.color, backgroundColor: c.bg }}>
                      {categoryLabel(c)}
                    </span>
                    {(e.location || e.animator) && (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginLeft: '6px' }}>
                        · {[e.location, e.animator].filter(Boolean).join(' — ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/calendar/ListView.tsx
git commit -m "feat(calendar): ListView with search and sticky day headers"
```

---

### Task 11: Calendar.tsx — router interne avec URL state

**Files:**
- Modify: `src/pages/Calendar.tsx` (remplacement complet)

- [ ] **Step 1: Réécrire Calendar.tsx**

Contenu complet de `src/pages/Calendar.tsx` :

```tsx
import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCalendarEvents } from './calendar/useCalendarEvents';
import CalendarToolbar, { type CalendarView } from './calendar/CalendarToolbar';
import DayView from './calendar/DayView';
import WeekView from './calendar/WeekView';
import LocationView from './calendar/LocationView';
import ListView from './calendar/ListView';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';

const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()}`;
}

function weekLabel(iso: string): string {
  const mon = mondayOf(iso);
  const d = new Date(mon + 'T00:00:00');
  return `Semaine du ${d.getDate()} ${MONTH_FR[d.getMonth()].toLowerCase()}`;
}

export default function Calendar() {
  const { events, loading } = useCalendarEvents();
  const [params, setParams] = useSearchParams();
  const [types, setTypes] = useState<CategoryColor[]>([]);

  const view = (params.get('view') as CalendarView) || 'day';
  const date = params.get('date') || todayIso();
  const typeFilter = params.get('type') || '';
  const locationFilter = params.get('location') || '';

  function update(p: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  // Charger + assurer les couleurs pour tous les types rencontrés
  useEffect(() => {
    if (loading) return;
    const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));
    ensureCategoryColors('activities', uniqueTypes).then(setTypes).catch(() => {});
  }, [loading, events]);

  const locations = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.location).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [events]);

  const label = view === 'week' ? weekLabel(date) : dayLabel(date);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '220px', height: '28px', borderRadius: '6px', background: 'var(--color-border)' }} className="shimmer" />
        <div style={{ width: '100%', height: '400px', borderRadius: '10px', background: 'var(--color-surface)' }} className="shimmer" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1300px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
        Calendrier
      </h1>

      <CalendarToolbar
        view={view}
        onViewChange={(v) => update({ view: v })}
        date={date}
        onDateChange={(d) => update({ date: d })}
        dateLabel={label}
        types={types}
        typeFilter={typeFilter}
        onTypeFilterChange={(v) => update({ type: v || null })}
        locations={locations}
        locationFilter={locationFilter}
        onLocationFilterChange={(v) => update({ location: v || null })}
        onToday={() => update({ date: todayIso() })}
      />

      {view === 'day' && (
        <DayView events={events} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'week' && (
        <WeekView events={events} mondayDate={mondayOf(date)} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'location' && (
        <LocationView events={events} date={date} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
      {view === 'list' && (
        <ListView events={events} types={types} typeFilter={typeFilter} locationFilter={locationFilter} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Calendar.tsx
git commit -m "feat(calendar): route to Day/Week/Location/List views via URL state"
```

---

## Phase 3 — Dashboard digest

### Task 12: TodayTimeline component

**Files:**
- Create: `src/pages/dashboard/TodayTimeline.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { byDay, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayTimeline({ events }: Props) {
  const today = todayIso();
  const dayEvents = byDay(events, today);
  const now = nowTimeString();

  let currentId: string | null = null;
  for (const e of dayEvents) {
    if (e.time && e.time <= now) currentId = e.id;
  }

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarDays size={14} /> Aujourd'hui
        </h3>
        <Link to="/calendar" style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Tout voir →</Link>
      </div>

      {dayEvents.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Pas d'activité aujourd'hui.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dayEvents.map((e) => {
            const isCurrent = e.id === currentId;
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex', gap: '10px', padding: '6px 8px',
                  background: isCurrent ? '#FEF9EE' : 'transparent',
                  borderRadius: '4px', fontSize: '12px', alignItems: 'center',
                }}
              >
                <strong style={{ width: '40px', color: isCurrent ? '#D97706' : 'var(--color-text-primary)' }}>
                  {isCurrent && '▸ '}{e.time ?? '—'}
                </strong>
                <span style={{ flex: 1 }}>
                  <strong>{e.title}</strong>
                  {e.location && <span style={{ color: 'var(--color-text-secondary)' }}> · {e.location}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard/TodayTimeline.tsx
git commit -m "feat(dashboard): TodayTimeline component"
```

---

### Task 13: UpcomingFeed component

**Files:**
- Create: `src/pages/dashboard/UpcomingFeed.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { upcoming, type CalendarEvent } from '@/pages/calendar/useCalendarEvents';

interface Props {
  events: CalendarEvent[];
}

const DAY_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTH_FR_SHORT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${DAY_FR[d.getDay()]} ${d.getDate()} ${MONTH_FR_SHORT[d.getMonth()]}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function UpcomingFeed({ events }: Props) {
  const next = upcoming(events, tomorrowIso(), 5);

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} /> Prochaines activités
        </h3>
        <Link to="/calendar?view=list" style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Tout voir →</Link>
      </div>

      {next.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Aucune activité planifiée à venir.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {next.map((e) => (
            <div key={e.id} style={{ fontSize: '12px' }}>
              <strong>{shortDate(e.date)}{e.time && ` · ${e.time}`}</strong>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                {e.title}{e.location && ` · ${e.location}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard/UpcomingFeed.tsx
git commit -m "feat(dashboard): UpcomingFeed component"
```

---

### Task 14: Dashboard.tsx — intégrer les nouveaux blocs

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Identifier la section "upcoming activities" existante**

Run: `grep -n "upcomingActivities\|UpcomingActivities" src/pages/Dashboard.tsx`
Expected: des lignes ciblant le bloc à remplacer.

- [ ] **Step 2: Remplacer par les nouveaux composants**

Dans `src/pages/Dashboard.tsx` :

a) Ajouter en haut :

```tsx
import { useCalendarEvents } from './calendar/useCalendarEvents';
import TodayTimeline from './dashboard/TodayTimeline';
import UpcomingFeed from './dashboard/UpcomingFeed';
```

b) Dans le composant Dashboard, ajouter avant le return :

```tsx
const { events: calendarEvents } = useCalendarEvents();
```

c) Supprimer l'ancien bloc "upcomingActivities" (la liste) et le remplacer par :

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
  <TodayTimeline events={calendarEvents} />
  <UpcomingFeed events={calendarEvents} />
</div>
```

d) Retirer l'usage de `upcomingActivities` / `getUpcomingActivities` si plus utilisé nulle part ailleurs dans le fichier.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): replace upcoming list with TodayTimeline + UpcomingFeed"
```

---

## Phase 4 — Finalisation

### Task 15: Build + vérification end-to-end

- [ ] **Step 1: Test complet**

Run: `npx vitest run`
Expected: tous les tests passent (existants + nouveau `useCalendarEvents.test.ts`).

- [ ] **Step 2: Build TS/Vite**

Run: `npm run build`
Expected: exit 0, `dist/` généré.

- [ ] **Step 3: Cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: `Finished dev profile`.

- [ ] **Step 4: Release build**

Run: `npm run tauri build`
Expected: `Finished release profile` + binaire `src-tauri/target/release/pilot-animateur.exe` mis à jour.

- [ ] **Step 5: Vérification manuelle**

Lancer via le raccourci bureau `Animator Pilot` :

1. Calendrier : cliquer chaque onglet (Jour/Semaine/Lieux/Liste). URL doit refléter (`?view=week`).
2. Jour : naviguer ◀ ▶ jusqu'au 15 avril, vérifier 8 activités listées par heure, activité "en cours" surlignée si heure compatible.
3. Semaine : Mer 15 colonne surlignée, après-midi cell contient mini-cartes colorées, clic ouvre la page activities.
4. Lieux : 15 avril, voir rows "UPG Bastille", "UPG Saint-Hilaire", "Étage 1", "Étage 2", "PASA" avec mini-cartes par heure.
5. Liste : rechercher "yoga" → 1 résultat. Retirer → liste complète sticky "mer. 15 avril 2026".
6. Filtres type + lieu persistent en changeant de vue (URL).
7. Dashboard : 2 panneaux ("Aujourd'hui" + "Prochaines activités") au lieu de liste unique.
8. Activités : chip coloré pour chaque type, filtre dropdown inclut tous les types historiques + types synchronisés bruts (ex: `cognitive`).
9. Sync activités → types stockés en brut, Calendar affiche couleur auto-générée pour types inconnus, catégorie "other" fallback.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore: release build — calendar redesign"
```

---

## Notes d'exécution

- **Commits** : le plan propose 14 commits. L'utilisateur peut les regrouper (`git reset --soft HEAD~N && git commit`) si préférable avant push.
- **Worktree** : ce plan tourne sur `main` (pas de worktree dédié — confirmé par le flow actuel du projet).
- **Ordre TDD** : seul le hook `useCalendarEvents` a des tests (helpers purs). Les composants UI sont vérifiés par typecheck + lancement manuel en release.
- **Raccourci bureau** : pointe vers `target/release/pilot-animateur.exe` — mis à jour par `npm run tauri build`.
