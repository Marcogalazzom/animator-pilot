# Activities — Refonte Ateliers & Activités — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper la page Activities monolithique en 3 onglets (À venir / Passées / Bibliothèque) avec actions inline, suivi post-activité, et système de modèles via un flag `is_template` sur la table `activities`.

**Architecture:** Migration 011 ajoute `is_template`. Page `Activities.tsx` devient un routeur léger délégant à `UpcomingTab/PastTab/LibraryTab`. Hook `useActivitiesData` centralise les requêtes et le bucketing par date. Composant `ActivityCard` réutilisable avec slot d'actions configurables. Templates instanciés via `ScheduleTemplateModal`.

**Tech Stack:** React 19, TypeScript, vitest, tauri-plugin-sql (SQLite), React Router v7, lucide-react.

**Spec:** [`docs/superpowers/specs/2026-04-13-activities-redesign-design.md`](../specs/2026-04-13-activities-redesign-design.md)

---

## File Structure

### Nouveaux fichiers

- `src-tauri/migrations/011_activity_templates.sql` — `ALTER TABLE` + index
- `src/pages/activities/useActivitiesData.ts` — hook + bucketing + helpers purs
- `src/pages/activities/__tests__/useActivitiesData.test.ts` — tests bucketing
- `src/pages/activities/ActivitiesToolbar.tsx` — onglets + filtres + bouton "+"
- `src/pages/activities/ActivityCard.tsx` — card commune avec slot actions
- `src/pages/activities/UpcomingTab.tsx` — sections par bucket date
- `src/pages/activities/PastTab.tsx` — sections À confirmer / Terminées / Annulées
- `src/pages/activities/LibraryTab.tsx` — grille de templates
- `src/pages/activities/ActivityFormModal.tsx` — formulaire extrait + toggle Modèle
- `src/pages/activities/ScheduleTemplateModal.tsx` — picker date/heure pour template

### Fichiers modifiés

- `src-tauri/src/lib.rs` — registre migration 011
- `src/db/types.ts` — `is_template` field sur `Activity`
- `src/db/activities.ts` — `getUpcomingPlanned`, `getPast`, `getTemplates`, `markCompleted`, `markCancelled`, `duplicateActivity`, `saveAsTemplate`, UPDATABLE_FIELDS étendu
- `src/services/syncService.ts` — exclure `is_template=1` du PUSH/PULL (`WHERE is_template = 0`)
- `src/pages/Activities.tsx` — réécrit comme routeur d'onglets

---

## Phase 1 — Foundation (DB + types + queries)

### Task 1: Migration 011 — is_template

**Files:**
- Create: `src-tauri/migrations/011_activity_templates.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Créer la migration**

```sql
ALTER TABLE activities ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_activities_template ON activities(is_template);
```

- [ ] **Step 2: Enregistrer dans lib.rs**

Dans `src-tauri/src/lib.rs`, après le bloc Migration version=10 :

```rust
Migration {
    version: 11,
    description: "add is_template flag to activities",
    sql: include_str!("../migrations/011_activity_templates.sql"),
    kind: MigrationKind::Up,
},
```

- [ ] **Step 3: Cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: `Finished dev profile`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/011_activity_templates.sql src-tauri/src/lib.rs
git commit -m "feat(db): add is_template flag to activities (migration 011)"
```

---

### Task 2: Types — Activity.is_template

**Files:**
- Modify: `src/db/types.ts`

- [ ] **Step 1: Ajouter le champ**

Dans `src/db/types.ts`, dans l'interface `Activity`, ajouter avant `created_at` :

```ts
  is_template: number; // 0 ou 1 — templates non synchronisés
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: erreurs probables car les `createActivity` callers n'envoient pas le champ. Documenter pour fix Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/db/types.ts
git commit -m "refactor(types): Activity.is_template field"
```

---

### Task 3: db/activities.ts — nouvelles queries + helpers

**Files:**
- Modify: `src/db/activities.ts`

- [ ] **Step 1: Étendre UPDATABLE_FIELDS et createActivity**

Remplacer le contenu de `src/db/activities.ts` par :

```ts
import { getDb } from './database';
import type { Activity, ActivityStatus } from './types';

const UPDATABLE_FIELDS = new Set([
  'title', 'activity_type', 'description', 'date', 'time_start', 'time_end',
  'location', 'max_participants', 'actual_participants', 'animator_name',
  'status', 'materials_needed', 'notes', 'linked_project_id',
  'synced_from', 'last_sync_at', 'external_id', 'is_shared', 'is_template',
]);

export async function getActivities(status?: ActivityStatus): Promise<Activity[]> {
  const db = await getDb();
  if (status) {
    return db.select<Activity[]>(
      "SELECT * FROM activities WHERE status = ? AND is_template = 0 ORDER BY date DESC",
      [status]
    );
  }
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE is_template = 0 ORDER BY date DESC",
    []
  );
}

export async function getUpcomingActivities(limit = 10): Promise<Activity[]> {
  const db = await getDb();
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE date >= date('now') AND status != 'cancelled' AND is_template = 0 ORDER BY date ASC LIMIT ?",
    [limit]
  );
}

export async function getUpcomingPlanned(): Promise<Activity[]> {
  const db = await getDb();
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE is_template = 0 AND status IN ('planned', 'in_progress') AND date >= date('now') ORDER BY date ASC, time_start ASC",
    []
  );
}

export async function getPast(): Promise<Activity[]> {
  const db = await getDb();
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE is_template = 0 AND (date < date('now') OR status IN ('completed', 'cancelled')) ORDER BY date DESC, time_start DESC",
    []
  );
}

export async function getTemplates(): Promise<Activity[]> {
  const db = await getDb();
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE is_template = 1 ORDER BY title ASC",
    []
  );
}

export async function getActivity(id: number): Promise<Activity | null> {
  const db = await getDb();
  const rows = await db.select<Activity[]>('SELECT * FROM activities WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createActivity(activity: Omit<Activity, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO activities (title, activity_type, description, date, time_start, time_end,
     location, max_participants, actual_participants, animator_name, status, materials_needed,
     notes, linked_project_id, is_shared, is_template)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.title, activity.activity_type, activity.description, activity.date,
      activity.time_start, activity.time_end, activity.location, activity.max_participants,
      activity.actual_participants, activity.animator_name, activity.status,
      activity.materials_needed, activity.notes, activity.linked_project_id,
      activity.is_shared ?? 1, activity.is_template ?? 0,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateActivity(id: number, updates: Partial<Activity>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE activities SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteActivity(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM activities WHERE id = ?', [id]);
}

// ─── Action helpers ───────────────────────────────────────────

export async function markCompleted(id: number, actualParticipants: number, notes?: string): Promise<void> {
  const updates: Partial<Activity> = { status: 'completed', actual_participants: actualParticipants };
  if (typeof notes === 'string') updates.notes = notes;
  await updateActivity(id, updates);
}

export async function markCancelled(id: number): Promise<void> {
  await updateActivity(id, { status: 'cancelled' });
}

export async function duplicateActivity(id: number, newDate: string): Promise<number> {
  const original = await getActivity(id);
  if (!original) throw new Error('Activity not found');
  const { id: _id, created_at: _ca, external_id: _ext, last_sync_at: _last, synced_from: _sf, ...rest } = original;
  return createActivity({
    ...rest,
    date: newDate,
    status: 'planned',
    actual_participants: 0,
    synced_from: '',
    last_sync_at: null,
    external_id: null,
  });
}

export async function saveAsTemplate(id: number): Promise<number> {
  const original = await getActivity(id);
  if (!original) throw new Error('Activity not found');
  const { id: _id, created_at: _ca, external_id: _ext, last_sync_at: _last, synced_from: _sf,
    date: _d, time_start: _ts, time_end: _te, status: _s, actual_participants: _ap, ...rest } = original;
  return createActivity({
    ...rest,
    date: '',
    time_start: null,
    time_end: null,
    status: 'planned',
    actual_participants: 0,
    is_template: 1,
    synced_from: '',
    last_sync_at: null,
    external_id: null,
  });
}

export async function getActivityStats(): Promise<{
  thisMonth: number;
  totalParticipants: number;
  upcoming: number;
  completedThisYear: number;
}> {
  const db = await getDb();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;

  const monthRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= ? AND status != 'cancelled' AND is_template = 0",
    [monthStart]
  ).catch(() => [{ cnt: 0 }]);

  const partRows = await db.select<{ total: number }[]>(
    "SELECT COALESCE(SUM(actual_participants), 0) as total FROM activities WHERE date >= ? AND status = 'completed' AND is_template = 0",
    [yearStart]
  ).catch(() => [{ total: 0 }]);

  const upcomingRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= date('now') AND status IN ('planned', 'in_progress') AND is_template = 0",
    []
  ).catch(() => [{ cnt: 0 }]);

  const completedRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= ? AND status = 'completed' AND is_template = 0",
    [yearStart]
  ).catch(() => [{ cnt: 0 }]);

  return {
    thisMonth: monthRows[0]?.cnt ?? 0,
    totalParticipants: partRows[0]?.total ?? 0,
    upcoming: upcomingRows[0]?.cnt ?? 0,
    completedThisYear: completedRows[0]?.cnt ?? 0,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreurs. (Si erreurs viennent de Activities.tsx, ignorer — Task 13 le réécrit.)

- [ ] **Step 3: Commit**

```bash
git add src/db/activities.ts
git commit -m "feat(db): activities helpers (getPast/getTemplates/markCompleted/duplicateActivity/saveAsTemplate)"
```

---

### Task 4: syncService — exclure templates

**Files:**
- Modify: `src/services/syncService.ts`

- [ ] **Step 1: Filtrer le PUSH local-only**

Dans `src/services/syncService.ts`, trouver la query du PUSH activities (chercher `WHERE (synced_from = '' OR synced_from IS NULL) AND is_shared = 1`) et ajouter `AND is_template = 0` :

```ts
const localOnly = await db.select<Activity[]>(
  `SELECT * FROM activities WHERE (synced_from = '' OR synced_from IS NULL) AND is_shared = 1 AND is_template = 0`,
  []
);
```

- [ ] **Step 2: Le PULL ne touche pas aux templates par construction**

Le PULL crée des activités à partir de Firestore avec `is_template` non spécifié → defaultera à 0 via la migration. Aucun changement nécessaire côté PULL.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreurs (sauf Activities.tsx — fix Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/services/syncService.ts
git commit -m "fix(sync): exclude templates from PUSH (is_template = 0)"
```

---

## Phase 2 — Hook + composants partagés

### Task 5: useActivitiesData hook + tests

**Files:**
- Create: `src/pages/activities/useActivitiesData.ts`
- Create: `src/pages/activities/__tests__/useActivitiesData.test.ts`

- [ ] **Step 1: Écrire les tests des helpers purs**

Créer `src/pages/activities/__tests__/useActivitiesData.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { bucketize, splitPast, type Activity } from '../useActivitiesData';

function act(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1, title: 'X', activity_type: 'jeux', description: '',
    date: '2026-04-15', time_start: '14:00', time_end: null, location: 'A',
    max_participants: 10, actual_participants: 0, animator_name: '',
    status: 'planned', materials_needed: '', notes: '',
    linked_project_id: null, is_shared: 1, is_template: 0,
    synced_from: '', last_sync_at: null, external_id: null, created_at: '',
    ...overrides,
  };
}

describe('bucketize', () => {
  it('regroupe les activités à venir par bucket', () => {
    const today = '2026-04-15';
    const items = [
      act({ id: 1, date: '2026-04-15' }),                         // today
      act({ id: 2, date: '2026-04-16' }),                         // tomorrow
      act({ id: 3, date: '2026-04-17' }),                         // this week (Friday)
      act({ id: 4, date: '2026-04-22' }),                         // next week
      act({ id: 5, date: '2026-05-15' }),                         // later
    ];
    const result = bucketize(items, today);
    expect(result['Aujourd\'hui'].map((a) => a.id)).toEqual([1]);
    expect(result['Demain'].map((a) => a.id)).toEqual([2]);
    expect(result['Cette semaine'].map((a) => a.id)).toEqual([3]);
    expect(result['La semaine prochaine'].map((a) => a.id)).toEqual([4]);
    expect(result['Plus tard'].map((a) => a.id)).toEqual([5]);
  });
});

describe('splitPast', () => {
  it('range les passées en À confirmer / Terminées / Annulées', () => {
    const today = '2026-04-15';
    const items = [
      act({ id: 1, date: '2026-04-10', status: 'planned' }),    // À confirmer
      act({ id: 2, date: '2026-04-11', status: 'completed' }),  // Terminée
      act({ id: 3, date: '2026-04-12', status: 'cancelled' }),  // Annulée
      act({ id: 4, date: '2026-04-14', status: 'planned' }),    // À confirmer
    ];
    const { toConfirm, completed, cancelled } = splitPast(items, today);
    expect(toConfirm.map((a) => a.id)).toEqual([4, 1]);
    expect(completed.map((a) => a.id)).toEqual([2]);
    expect(cancelled.map((a) => a.id)).toEqual([3]);
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `npx vitest run src/pages/activities/__tests__/useActivitiesData.test.ts`
Expected: FAIL (imports missing).

- [ ] **Step 3: Implémenter le hook + helpers**

Créer `src/pages/activities/useActivitiesData.ts` :

```ts
import { useState, useEffect, useCallback } from 'react';
import { getUpcomingPlanned, getPast, getTemplates } from '@/db/activities';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { todayIso, mondayOf, addDays } from '@/utils/dateUtils';
import type { Activity } from '@/db/types';

export type { Activity };

export type UpcomingBucket = "Aujourd'hui" | 'Demain' | 'Cette semaine' | 'La semaine prochaine' | 'Plus tard';
const BUCKET_ORDER: UpcomingBucket[] = ["Aujourd'hui", 'Demain', 'Cette semaine', 'La semaine prochaine', 'Plus tard'];

export function bucketize(items: Activity[], today: string): Record<UpcomingBucket, Activity[]> {
  const result: Record<UpcomingBucket, Activity[]> = {
    "Aujourd'hui": [], 'Demain': [], 'Cette semaine': [], 'La semaine prochaine': [], 'Plus tard': [],
  };
  const tomorrow = addDays(today, 1);
  const sundayThisWeek = addDays(mondayOf(today), 6);
  const sundayNextWeek = addDays(sundayThisWeek, 7);
  for (const a of items) {
    if (a.date === today) result["Aujourd'hui"].push(a);
    else if (a.date === tomorrow) result['Demain'].push(a);
    else if (a.date <= sundayThisWeek) result['Cette semaine'].push(a);
    else if (a.date <= sundayNextWeek) result['La semaine prochaine'].push(a);
    else result['Plus tard'].push(a);
  }
  return result;
}

export interface PastSections {
  toConfirm: Activity[];
  completed: Activity[];
  cancelled: Activity[];
}

export function splitPast(items: Activity[], today: string): PastSections {
  const toConfirm: Activity[] = [];
  const completed: Activity[] = [];
  const cancelled: Activity[] = [];
  for (const a of items) {
    if (a.status === 'cancelled') cancelled.push(a);
    else if (a.status === 'completed') completed.push(a);
    else if (a.date < today) toConfirm.push(a);
  }
  toConfirm.sort((a, b) => b.date.localeCompare(a.date));
  return { toConfirm, completed, cancelled };
}

export const BUCKETS = BUCKET_ORDER;

export interface ActivitiesData {
  upcoming: Activity[];
  past: Activity[];
  templates: Activity[];
  types: CategoryColor[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useActivitiesData(): ActivitiesData {
  const [upcoming, setUpcoming] = useState<Activity[]>([]);
  const [past, setPast] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<Activity[]>([]);
  const [types, setTypes] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, t] = await Promise.all([getUpcomingPlanned(), getPast(), getTemplates()]);
      setUpcoming(u); setPast(p); setTemplates(t);
      const allTypes = [...u, ...p, ...t].map((a) => a.activity_type);
      const cats = await ensureCategoryColors('activities', allTypes);
      setTypes(cats);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { upcoming, past, templates, types, loading, refresh };
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `npx vitest run src/pages/activities/__tests__/useActivitiesData.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/activities/useActivitiesData.ts src/pages/activities/__tests__/
git commit -m "feat(activities): useActivitiesData hook with bucketize/splitPast helpers"
```

---

### Task 6: ActivityCard component

**Files:**
- Create: `src/pages/activities/ActivityCard.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useState } from 'react';
import { Calendar, Clock, MapPin, Users, User } from 'lucide-react';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import type { Activity } from '@/db/types';

interface Props {
  activity: Activity;
  type: CategoryColor;
  showDate?: boolean;          // default true
  actions?: React.ReactNode;   // bandeau d'actions au hover
  inlineRow?: React.ReactNode; // ligne supplémentaire (ex: input présence)
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  planned:     { label: 'Planifié',    color: '#1E40AF' },
  in_progress: { label: 'En cours',    color: '#D97706' },
  completed:   { label: 'Terminé',     color: '#059669' },
  cancelled:   { label: 'Annulé',      color: '#DC2626' },
};

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function ActivityCard({ activity, type, showDate = true, actions, inlineRow }: Props) {
  const [hover, setHover] = useState(false);
  const status = STATUS_META[activity.status] ?? STATUS_META.planned;
  const t = type ?? { module: 'activities', name: activity.activity_type, ...autoColor(activity.activity_type), label: null };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: '14px 16px',
        borderLeft: `3px solid ${t.color}`,
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{activity.title}</strong>
        <span style={{
          fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
          color: t.color, backgroundColor: t.bg,
          border: `1px solid ${t.color}33`,
          fontWeight: 500,
        }}>
          {categoryLabel(t)}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: status.color }}>{status.label}</span>
      </div>
      <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
        {showDate && activity.date && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={11} /> {formatDate(activity.date)}
          </span>
        )}
        {activity.time_start && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> {activity.time_start}{activity.time_end ? ` — ${activity.time_end}` : ''}
          </span>
        )}
        {activity.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} /> {activity.location}
          </span>
        )}
        {activity.max_participants > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Users size={11} /> {activity.actual_participants}/{activity.max_participants}
          </span>
        )}
        {activity.animator_name && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <User size={11} /> {activity.animator_name}
          </span>
        )}
      </div>
      {inlineRow}
      {actions && (
        <div
          style={{
            display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px',
            borderTop: '1px dashed var(--color-border)', justifyContent: 'flex-end',
            opacity: hover ? 1 : 0,
            transition: 'var(--transition-fast)',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreurs (Activities.tsx encore broken — fix Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/pages/activities/ActivityCard.tsx
git commit -m "feat(activities): ActivityCard with hover actions and inline slot"
```

---

### Task 7: ActivitiesToolbar component

**Files:**
- Create: `src/pages/activities/ActivitiesToolbar.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { Plus, Search, MapPin, Filter } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

export type ActivitiesTab = 'upcoming' | 'past' | 'library';

interface TabMeta { label: string; }
const TABS: Record<ActivitiesTab, TabMeta> = {
  upcoming: { label: 'À venir' },
  past:     { label: 'Passées' },
  library:  { label: 'Bibliothèque' },
};

interface Props {
  tab: ActivitiesTab;
  onTabChange: (t: ActivitiesTab) => void;
  counts: Record<ActivitiesTab, number>;
  search: string;
  onSearchChange: (v: string) => void;
  types: CategoryColor[];
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  onCreate: () => void;
}

export default function ActivitiesToolbar(p: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', borderRadius: '10px',
          border: '1px solid var(--color-border)', overflow: 'hidden',
          background: 'var(--color-surface)',
        }}>
          {(Object.keys(TABS) as ActivitiesTab[]).map((t) => {
            const active = p.tab === t;
            return (
              <button
                key={t}
                onClick={() => p.onTabChange(t)}
                style={{
                  padding: '8px 16px', border: 'none',
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-primary)',
                  fontSize: '13px', fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                {TABS[t].label} <span style={{ opacity: 0.7, marginLeft: '4px' }}>· {p.counts[t]}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={p.onCreate}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '8px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nouvelle activité
        </button>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher un titre…" value={p.search}
            onChange={(e) => p.onSearchChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: '8px',
              fontSize: '13px', fontFamily: 'var(--font-sans)', background: 'var(--color-surface)',
            }}
          />
        </div>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Filter size={12} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
          <select value={p.typeFilter} onChange={(e) => p.onTypeFilterChange(e.target.value)}
            style={{ padding: '7px 10px 7px 30px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', background: 'var(--color-surface)', cursor: 'pointer' }}>
            <option value="">Tous types</option>
            {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
          </select>
        </div>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <MapPin size={12} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
          <select value={p.locationFilter} onChange={(e) => p.onLocationFilterChange(e.target.value)}
            style={{ padding: '7px 10px 7px 30px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', background: 'var(--color-surface)', cursor: 'pointer' }}>
            <option value="">Tous lieux</option>
            {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/ActivitiesToolbar.tsx
git commit -m "feat(activities): ActivitiesToolbar with tabs, search, filters"
```

---

### Task 8: ActivityFormModal — extraction du formulaire + toggle Modèle

**Files:**
- Create: `src/pages/activities/ActivityFormModal.tsx`

- [ ] **Step 1: Créer le composant**

Le formulaire reprend exactement la structure de l'actuel `Activities.tsx` modal (lignes 281-388 environ), avec ajout du toggle "📋 Modèle" qui masque date/heures/status/présents.

```tsx
import { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { Activity, ActivityStatus } from '@/db/types';

const STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planifié' }, in_progress: { label: 'En cours' },
  completed: { label: 'Terminé' }, cancelled: { label: 'Annulé' },
};

interface Props {
  initial: Activity | null;
  defaultMode?: 'scheduled' | 'template';  // default 'scheduled' if no initial
  types: CategoryColor[];
  onSubmit: (data: Omit<Activity, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

export default function ActivityFormModal({ initial, defaultMode = 'scheduled', types, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isTemplate, setIsTemplate] = useState((initial?.is_template === 1) || defaultMode === 'template');

  useEffect(() => {
    setIsTemplate((initial?.is_template === 1) || defaultMode === 'template');
  }, [initial, defaultMode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current; if (!form) return;
    const fd = new FormData(form);
    const data = {
      title: fd.get('title') as string,
      activity_type: (fd.get('activity_type') as string) || 'jeux',
      description: (fd.get('description') as string) || '',
      date: isTemplate ? '' : (fd.get('date') as string),
      time_start: isTemplate ? null : ((fd.get('time_start') as string) || null),
      time_end: isTemplate ? null : ((fd.get('time_end') as string) || null),
      location: (fd.get('location') as string) || '',
      max_participants: parseInt(fd.get('max_participants') as string) || 0,
      actual_participants: isTemplate ? 0 : (parseInt(fd.get('actual_participants') as string) || 0),
      animator_name: (fd.get('animator_name') as string) || '',
      status: isTemplate ? ('planned' as ActivityStatus) : ((fd.get('status') as ActivityStatus) || 'planned'),
      materials_needed: (fd.get('materials_needed') as string) || '',
      notes: (fd.get('notes') as string) || '',
      linked_project_id: null,
      is_shared: fd.get('is_shared') === 'on' ? 1 : 0,
      is_template: isTemplate ? 1 : 0,
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    } satisfies Omit<Activity, 'id' | 'created_at'>;
    await onSubmit(data);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            {initial ? (isTemplate ? 'Modifier le modèle' : "Modifier l'activité") : (isTemplate ? 'Nouveau modèle' : 'Nouvelle activité')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-soft)', marginBottom: '14px', fontSize: '13px', cursor: 'pointer' }}>
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
          📋 Modèle <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>(activité réutilisable, sans date ni heure)</span>
        </label>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Titre
            <input name="title" defaultValue={initial?.title ?? ''} required style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Type
              <input name="activity_type" list="activity-types" defaultValue={initial?.activity_type ?? 'jeux'} placeholder="Tapez ou choisissez…" style={inputStyle} />
              <datalist id="activity-types">
                {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
              </datalist>
            </label>
            {!isTemplate && (
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Statut
                <select name="status" defaultValue={initial?.status ?? 'planned'} style={inputStyle}>
                  {(Object.keys(STATUS_META) as ActivityStatus[]).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
                </select>
              </label>
            )}
          </div>
          {!isTemplate && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Date
                <input name="date" type="date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} required style={inputStyle} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Début
                <input name="time_start" type="time" defaultValue={initial?.time_start ?? ''} style={inputStyle} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Fin
                <input name="time_end" type="time" defaultValue={initial?.time_end ?? ''} style={inputStyle} />
              </label>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isTemplate ? '2fr 1fr' : '2fr 1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Lieu
              <input name="location" defaultValue={initial?.location ?? ''} style={inputStyle} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Max. part.
              <input name="max_participants" type="number" min="0" defaultValue={initial?.max_participants ?? 15} style={inputStyle} />
            </label>
            {!isTemplate && (
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                Présents
                <input name="actual_participants" type="number" min="0" defaultValue={initial?.actual_participants ?? 0} style={inputStyle} />
              </label>
            )}
          </div>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Animateur/trice
            <input name="animator_name" defaultValue={initial?.animator_name ?? ''} style={inputStyle} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Description
            <textarea name="description" rows={2} defaultValue={initial?.description ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Matériel nécessaire
            <input name="materials_needed" defaultValue={initial?.materials_needed ?? ''} placeholder="Pinceaux, papier, enceinte…" style={inputStyle} />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Notes
            <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          {!isTemplate && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', fontSize: '13px', fontWeight: 500 }}>
              <input name="is_shared" type="checkbox" defaultChecked={initial ? initial.is_shared === 1 : true} />
              <span>Activité partagée <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>— visible sur planning-ehpad. Décochez pour les RDV perso.</span></span>
            </label>
          )}
          <button type="submit" style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {initial ? 'Mettre à jour' : (isTemplate ? 'Créer le modèle' : "Créer l'activité")}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', marginTop: '4px',
  border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/ActivityFormModal.tsx
git commit -m "feat(activities): ActivityFormModal with template toggle"
```

---

### Task 9: ScheduleTemplateModal

**Files:**
- Create: `src/pages/activities/ScheduleTemplateModal.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { todayIso } from '@/utils/dateUtils';
import type { Activity } from '@/db/types';

interface Props {
  template: Activity;
  onSchedule: (date: string, timeStart: string | null, timeEnd: string | null) => Promise<void>;
  onClose: () => void;
}

export default function ScheduleTemplateModal({ template, onSchedule, onClose }: Props) {
  const [date, setDate] = useState(todayIso());
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSchedule(date, timeStart || null, timeEnd || null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
            Programmer "{template.title}"
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Début
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Fin
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button type="submit" disabled={busy} style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', marginTop: '4px' }}>
            {busy ? 'Création…' : 'Programmer'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', marginTop: '4px',
  border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/ScheduleTemplateModal.tsx
git commit -m "feat(activities): ScheduleTemplateModal date/time picker"
```

---

## Phase 3 — Tabs

### Task 10: UpcomingTab

**Files:**
- Create: `src/pages/activities/UpcomingTab.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useToastStore } from '@/stores/toastStore';
import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import ActivityCard from './ActivityCard';
import { bucketize, BUCKETS, type Activity } from './useActivitiesData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, deleteActivity, duplicateActivity } from '@/db/activities';

interface Props {
  items: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onEdit: (a: Activity) => void;
  onRefresh: () => Promise<void>;
}

export default function UpcomingTab({ items, types, search, typeFilter, locationFilter, onEdit, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = items.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (locationFilter && a.location !== locationFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = bucketize(filtered, today);

  async function complete(a: Activity) {
    await markCompleted(a.id, a.actual_participants).catch(() => {});
    addToast('Activité clôturée', 'success');
    await onRefresh();
  }
  async function duplicate(a: Activity) {
    await duplicateActivity(a.id, today).catch(() => {});
    addToast('Activité dupliquée', 'success');
    await onRefresh();
  }
  async function remove(a: Activity) {
    await deleteActivity(a.id).catch(() => {});
    addToast('Supprimée', 'success');
    await onRefresh();
  }

  if (filtered.length === 0) {
    return <div style={emptyStyle}><p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucune activité à venir.</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {BUCKETS.map((b) => {
        const list = grouped[b];
        if (list.length === 0) return null;
        return (
          <div key={b}>
            <div style={sectionHeader}>{b} <span style={{ opacity: 0.6 }}>· {list.length}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {list.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  type={typeFor(a.activity_type)}
                  actions={
                    <>
                      <button onClick={() => complete(a)} style={{ ...actionBtn, background: '#ECFDF5', color: '#059669' }}><Check size={12} /> Terminer</button>
                      <button onClick={() => duplicate(a)} style={actionBtn}><Copy size={12} /> Dupliquer</button>
                      <button onClick={() => onEdit(a)} style={actionBtn}><Pencil size={12} /> Modifier</button>
                      <button onClick={() => remove(a)} style={{ ...actionBtn, color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                    </>
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
};
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '5px 10px', fontSize: '11px', fontWeight: 500,
  background: 'var(--color-bg-soft)', color: 'var(--color-text-primary)',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
};
const emptyStyle: React.CSSProperties = {
  background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/UpcomingTab.tsx
git commit -m "feat(activities): UpcomingTab with date buckets and inline actions"
```

---

### Task 11: PastTab

**Files:**
- Create: `src/pages/activities/PastTab.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ActivityCard from './ActivityCard';
import { splitPast, type Activity } from './useActivitiesData';
import { todayIso } from '@/utils/dateUtils';
import { autoColor, type CategoryColor } from '@/db/categoryColors';
import { markCompleted, markCancelled, saveAsTemplate } from '@/db/activities';

interface Props {
  items: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  locationFilter: string;
  onRefresh: () => Promise<void>;
}

export default function PastTab({ items, types, search, typeFilter, locationFilter, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [showCancelled, setShowCancelled] = useState(false);
  const [presents, setPresents] = useState<Record<number, string>>({});
  const today = todayIso();
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = items.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (locationFilter && a.location !== locationFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const { toConfirm, completed, cancelled } = splitPast(filtered, today);

  async function close(a: Activity) {
    const n = parseInt(presents[a.id] ?? String(a.actual_participants)) || 0;
    await markCompleted(a.id, n).catch(() => {});
    addToast('Clôturée', 'success');
    await onRefresh();
  }
  async function cancel(a: Activity) {
    await markCancelled(a.id).catch(() => {});
    addToast('Annulée', 'success');
    await onRefresh();
  }
  async function template(a: Activity) {
    await saveAsTemplate(a.id).catch(() => {});
    addToast('Modèle enregistré', 'success');
    await onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* À CONFIRMER */}
      {toConfirm.length > 0 && (
        <div>
          <div style={{ ...sectionHeader, color: 'var(--color-now)' }}>
            ⚠ À confirmer <span style={{ opacity: 0.7 }}>· {toConfirm.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {toConfirm.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                type={typeFor(a.activity_type)}
                inlineRow={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '10px', background: 'var(--color-now-bg)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Présents :</span>
                    <input
                      type="number" min="0" max={a.max_participants}
                      value={presents[a.id] ?? ''}
                      placeholder={String(a.actual_participants || 0)}
                      onChange={(e) => setPresents((p) => ({ ...p, [a.id]: e.target.value }))}
                      style={{ width: '60px', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>/ {a.max_participants}</span>
                    <button onClick={() => close(a)} style={{ marginLeft: 'auto', padding: '5px 12px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✓ Clôturer</button>
                    <button onClick={() => cancel(a)} style={{ padding: '5px 12px', background: '#FEF2F2', color: 'var(--color-danger)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Annuler</button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* TERMINÉES */}
      {completed.length > 0 && (
        <div>
          <div style={{ ...sectionHeader, color: 'var(--color-success)' }}>
            ✓ Terminées <span style={{ opacity: 0.7 }}>· {completed.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completed.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                type={typeFor(a.activity_type)}
                inlineRow={a.notes ? (
                  <p style={{ margin: '8px 0 0', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>"{a.notes}"</p>
                ) : null}
                actions={<button onClick={() => template(a)} style={actionBtn}>+ Modèle</button>}
              />
            ))}
          </div>
        </div>
      )}

      {/* ANNULÉES */}
      {cancelled.length > 0 && (
        <div>
          <button onClick={() => setShowCancelled((v) => !v)} style={{ ...sectionHeader, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {showCancelled ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Annulées <span style={{ opacity: 0.7 }}>· {cancelled.length}</span>
          </button>
          {showCancelled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {cancelled.map((a) => (
                <ActivityCard key={a.id} activity={a} type={typeFor(a.activity_type)} />
              ))}
            </div>
          )}
        </div>
      )}

      {toConfirm.length === 0 && completed.length === 0 && cancelled.length === 0 && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '40px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Aucune activité passée.</p>
        </div>
      )}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '8px',
};
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '5px 10px', fontSize: '11px', fontWeight: 500,
  background: 'var(--color-bg-soft)', color: 'var(--color-text-primary)',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/PastTab.tsx
git commit -m "feat(activities): PastTab with À confirmer/Terminées/Annulées sections"
```

---

### Task 12: LibraryTab

**Files:**
- Create: `src/pages/activities/LibraryTab.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
import { useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import { Plus, MapPin, Users, Pencil, Trash2 } from 'lucide-react';
import ScheduleTemplateModal from './ScheduleTemplateModal';
import { categoryLabel, autoColor, type CategoryColor } from '@/db/categoryColors';
import { duplicateActivity, deleteActivity, updateActivity } from '@/db/activities';
import type { Activity } from '@/db/types';

interface Props {
  templates: Activity[];
  types: CategoryColor[];
  search: string;
  typeFilter: string;
  onCreateTemplate: () => void;
  onEditTemplate: (t: Activity) => void;
  onRefresh: () => Promise<void>;
}

export default function LibraryTab({ templates, types, search, typeFilter, onCreateTemplate, onEditTemplate, onRefresh }: Props) {
  const addToast = useToastStore((s) => s.add);
  const [scheduling, setScheduling] = useState<Activity | null>(null);
  const typeMap = new Map(types.map((c) => [c.name, c]));
  const typeFor = (name: string): CategoryColor =>
    typeMap.get(name) ?? { module: 'activities', name, ...autoColor(name), label: null };

  const filtered = templates.filter((t) => {
    if (typeFilter && t.activity_type !== typeFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function schedule(date: string, timeStart: string | null, timeEnd: string | null) {
    if (!scheduling) return;
    const newId = await duplicateActivity(scheduling.id, date);
    // Le duplicate hérite is_template=1 du template source, on le repasse à 0
    // et on applique les heures choisies dans le modal.
    await updateActivity(newId, {
      time_start: timeStart, time_end: timeEnd, is_template: 0,
    } as Partial<Activity>);
    addToast('Activité programmée', 'success');
    await onRefresh();
  }

  async function remove(t: Activity) {
    await deleteActivity(t.id).catch(() => {});
    addToast('Modèle supprimé', 'success');
    await onRefresh();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {filtered.map((t) => {
        const c = typeFor(t.activity_type);
        return (
          <div key={t.id} style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)', padding: '14px',
            borderLeft: `3px solid ${c.color}`, display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '14px' }}>{t.title}</strong>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', color: c.color, background: c.bg, border: `1px solid ${c.color}33`, fontWeight: 500 }}>
                {categoryLabel(c)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              {t.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} /> {t.location}</span>}
              {t.max_participants > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={11} /> {t.max_participants} max</span>}
            </div>
            {t.materials_needed && (
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>📦 {t.materials_needed}</p>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <button onClick={() => setScheduling(t)} style={{ flex: 1, padding: '7px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Programmer</button>
              <button onClick={() => onEditTemplate(t)} style={iconBtn} title="Modifier"><Pencil size={13} /></button>
              <button onClick={() => remove(t)} style={{ ...iconBtn, color: 'var(--color-danger)' }} title="Supprimer"><Trash2 size={13} /></button>
            </div>
          </div>
        );
      })}
      <button onClick={onCreateTemplate} style={{
        background: 'transparent', border: '2px dashed var(--color-border)',
        borderRadius: 'var(--radius-card)', padding: '32px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500,
      }}>
        <Plus size={14} /> Nouveau modèle
      </button>

      {scheduling && (
        <ScheduleTemplateModal
          template={scheduling}
          onSchedule={schedule}
          onClose={() => setScheduling(null)}
        />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--color-bg-soft)', border: 'none', borderRadius: '6px', cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/activities/LibraryTab.tsx
git commit -m "feat(activities): LibraryTab grid with templates and Programmer flow"
```

---

## Phase 4 — Page principale

### Task 13: Activities.tsx — routeur d'onglets

**Files:**
- Modify (full rewrite): `src/pages/Activities.tsx`

- [ ] **Step 1: Réécrire Activities.tsx**

```tsx
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import ActivitiesToolbar, { type ActivitiesTab } from './activities/ActivitiesToolbar';
import UpcomingTab from './activities/UpcomingTab';
import PastTab from './activities/PastTab';
import LibraryTab from './activities/LibraryTab';
import ActivityFormModal from './activities/ActivityFormModal';
import { useActivitiesData } from './activities/useActivitiesData';
import { createActivity, updateActivity } from '@/db/activities';
import type { Activity } from '@/db/types';

export default function Activities() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as ActivitiesTab) || 'upcoming';
  const setTab = (t: ActivitiesTab) => {
    const next = new URLSearchParams(params); next.set('tab', t); setParams(next, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'scheduled' | 'template'>('scheduled');
  const addToast = useToastStore((s) => s.add);
  const syncStatus = useSyncStore((s) => s.modules.activities.status);

  const data = useActivitiesData();
  // refresh after sync changes
  useMemo(() => { if (syncStatus === 'idle') data.refresh().catch(() => {}); }, [syncStatus, data]);

  const counts = {
    upcoming: data.upcoming.length,
    past: data.past.length,
    library: data.templates.length,
  };

  const locations = useMemo(() => {
    const set = new Set<string>();
    [...data.upcoming, ...data.past, ...data.templates].forEach((a) => { if (a.location) set.add(a.location); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [data.upcoming, data.past, data.templates]);

  function openCreate(mode: 'scheduled' | 'template' = 'scheduled') {
    setEditing(null); setFormMode(mode); setShowForm(true);
  }
  function openEdit(a: Activity) {
    setEditing(a); setFormMode(a.is_template === 1 ? 'template' : 'scheduled'); setShowForm(true);
  }

  async function handleSubmit(values: Omit<Activity, 'id' | 'created_at'>) {
    try {
      if (editing) {
        await updateActivity(editing.id, values);
        addToast(values.is_template ? 'Modèle mis à jour' : 'Activité mise à jour', 'success');
      } else {
        await createActivity(values);
        addToast(values.is_template ? 'Modèle créé' : 'Activité créée', 'success');
      }
      setShowForm(false); setEditing(null);
      await data.refresh();
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
            Ateliers & Activités
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
            Planification, suivi et bibliothèque de modèles
          </p>
          <SyncStatus module="activities" />
        </div>
        <SyncButton module="activities" />
      </div>

      <ActivitiesToolbar
        tab={tab}
        onTabChange={setTab}
        counts={counts}
        search={search}
        onSearchChange={setSearch}
        types={data.types}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        locations={locations}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        onCreate={() => openCreate(tab === 'library' ? 'template' : 'scheduled')}
      />

      {data.loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement…</p>
      ) : tab === 'upcoming' ? (
        <UpcomingTab items={data.upcoming} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onEdit={openEdit} onRefresh={data.refresh} />
      ) : tab === 'past' ? (
        <PastTab items={data.past} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onRefresh={data.refresh} />
      ) : (
        <LibraryTab templates={data.templates} types={data.types} search={search} typeFilter={typeFilter} onCreateTemplate={() => openCreate('template')} onEditTemplate={openEdit} onRefresh={data.refresh} />
      )}

      {showForm && (
        <ActivityFormModal
          initial={editing}
          defaultMode={formMode}
          types={data.types}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erreurs.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Activities.tsx
git commit -m "feat(activities): page becomes tab router (upcoming/past/library)"
```

---

## Phase 5 — Finalisation

### Task 14: Tests + build + release

- [ ] **Step 1: Run tests**

Run: `npx vitest run`
Expected: PASS 66 (64 anciens + 2 nouveaux `useActivitiesData`).

- [ ] **Step 2: TS+Vite build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: `Finished dev profile`.

- [ ] **Step 4: Release build**

Run: `npm run tauri build`
Expected: `Finished release profile`, binaire à `src-tauri/target/release/pilot-animateur.exe` mis à jour.

- [ ] **Step 5: Vérification manuelle**

Lancer le raccourci `Animator Pilot` :

1. Ateliers & Activités → 3 onglets visibles avec compteurs (≈140 / ≈9 / 0).
2. À venir : sections "Aujourd'hui · Demain · Cette semaine · …" peuplées. Hover card → 4 boutons. Clic Terminer → activité disparaît, va dans Passées Terminées.
3. Clic Dupliquer → modal pré-remplie aujourd'hui → submit → nouvelle entrée dans À venir.
4. Passées : section "À confirmer" jaune avec input présents. Saisir 5 → Clôturer → passe en Terminées vert avec 5/X ✓.
5. Sauvegarder une activité passée comme modèle (bouton "+ Modèle" sur Terminée) → apparaît dans Bibliothèque.
6. Bibliothèque : clic + Programmer sur un template → modal date/heure → submit → nouvelle entrée À venir.
7. URL `/activities?tab=library` ouvre direct le bon onglet.
8. Nouvelle activité (toggle Modèle décoché) → form complet, submit → À venir.
9. Nouvelle activité (toggle Modèle coché) → date/heures masquées → submit → Bibliothèque.
10. Sync activités : aucune erreur, templates locaux non envoyés à Firestore.
