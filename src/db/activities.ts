import { getDb } from './database';
import type { Activity, ActivityType, ActivityStatus } from './types';

const UPDATABLE_FIELDS = new Set([
  'title', 'activity_type', 'description', 'date', 'time_start', 'time_end',
  'location', 'max_participants', 'actual_participants', 'animator_name',
  'status', 'materials_needed', 'notes', 'linked_project_id',
  'synced_from', 'last_sync_at', 'external_id',
]);

export async function getActivities(status?: ActivityStatus): Promise<Activity[]> {
  const db = await getDb();
  if (status) {
    return db.select<Activity[]>(
      'SELECT * FROM activities WHERE status = ? ORDER BY date DESC',
      [status]
    );
  }
  return db.select<Activity[]>('SELECT * FROM activities ORDER BY date DESC', []);
}

export async function getUpcomingActivities(limit = 10): Promise<Activity[]> {
  const db = await getDb();
  return db.select<Activity[]>(
    "SELECT * FROM activities WHERE date >= date('now') AND status != 'cancelled' ORDER BY date ASC LIMIT ?",
    [limit]
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
     location, max_participants, actual_participants, animator_name, status, materials_needed, notes, linked_project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.title, activity.activity_type, activity.description, activity.date,
      activity.time_start, activity.time_end, activity.location, activity.max_participants,
      activity.actual_participants, activity.animator_name, activity.status,
      activity.materials_needed, activity.notes, activity.linked_project_id,
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

  const [monthRow] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= ? AND status != 'cancelled'",
    [monthStart]
  ).catch(() => [[{ cnt: 0 }]]);

  const [partRow] = await db.select<[{ total: number }]>(
    "SELECT COALESCE(SUM(actual_participants), 0) as total FROM activities WHERE date >= ? AND status = 'completed'",
    [yearStart]
  ).catch(() => [[{ total: 0 }]]);

  const [upcomingRow] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= date('now') AND status IN ('planned', 'in_progress')",
    []
  ).catch(() => [[{ cnt: 0 }]]);

  const [completedRow] = await db.select<[{ cnt: number }]>(
    "SELECT COUNT(*) as cnt FROM activities WHERE date >= ? AND status = 'completed'",
    [yearStart]
  ).catch(() => [[{ cnt: 0 }]]);

  return {
    thisMonth: monthRow.cnt,
    totalParticipants: partRow.total,
    upcoming: upcomingRow.cnt,
    completedThisYear: completedRow.cnt,
  };
}
