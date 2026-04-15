import { getDb } from './database';
import type { Activity, ActivityStatus } from './types';

const UPDATABLE_FIELDS = new Set([
  'title', 'activity_type', 'description', 'date', 'time_start', 'time_end',
  'location', 'max_participants', 'actual_participants', 'animator_name',
  'status', 'materials_needed', 'notes', 'linked_project_id',
  'synced_from', 'last_sync_at', 'external_id', 'is_shared', 'is_template', 'unit',
  'is_recurring',
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

export async function getActivityTemplates(): Promise<Activity[]> {
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
     notes, linked_project_id, is_shared, is_template, unit, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.title, activity.activity_type, activity.description, activity.date,
      activity.time_start, activity.time_end, activity.location, activity.max_participants,
      activity.actual_participants, activity.animator_name, activity.status,
      activity.materials_needed, activity.notes, activity.linked_project_id,
      activity.is_shared ?? 1, activity.is_template ?? 0,
      activity.unit === 'pasa' ? 'pasa' : 'main',
      activity.is_recurring ?? 0,
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
    is_template: 0, // duplicate = always a scheduled instance, not another template
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
