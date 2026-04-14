import { getDb } from './database';
import type { Appointment, AppointmentStatus } from './types';

const UPDATABLE_FIELDS = new Set([
  'title', 'appointment_type', 'date', 'time_start', 'time_end',
  'location', 'participants', 'description', 'status',
]);

export async function getAppointments(status?: AppointmentStatus): Promise<Appointment[]> {
  const db = await getDb();
  if (status) {
    return db.select<Appointment[]>(
      'SELECT * FROM appointments WHERE status = ? ORDER BY date DESC, time_start DESC',
      [status]
    );
  }
  return db.select<Appointment[]>(
    'SELECT * FROM appointments ORDER BY date DESC, time_start DESC',
    []
  );
}

export async function getUpcomingPlanned(): Promise<Appointment[]> {
  const db = await getDb();
  return db.select<Appointment[]>(
    "SELECT * FROM appointments WHERE status = 'planned' AND date >= date('now') ORDER BY date ASC, time_start ASC",
    []
  );
}

export async function getPast(): Promise<Appointment[]> {
  const db = await getDb();
  return db.select<Appointment[]>(
    "SELECT * FROM appointments WHERE date < date('now') OR status IN ('completed', 'cancelled') ORDER BY date DESC, time_start DESC",
    []
  );
}

export async function getAppointment(id: number): Promise<Appointment | null> {
  const db = await getDb();
  const rows = await db.select<Appointment[]>('SELECT * FROM appointments WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createAppointment(a: Omit<Appointment, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO appointments (title, appointment_type, date, time_start, time_end,
     location, participants, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.title, a.appointment_type, a.date, a.time_start, a.time_end,
      a.location, a.participants, a.description, a.status,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateAppointment(id: number, updates: Partial<Appointment>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE appointments SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteAppointment(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM appointments WHERE id = ?', [id]);
}

// ─── Action helpers ───────────────────────────────────────────

export async function markCompleted(id: number): Promise<void> {
  await updateAppointment(id, { status: 'completed' });
}

export async function markCancelled(id: number): Promise<void> {
  await updateAppointment(id, { status: 'cancelled' });
}

export async function reopen(id: number): Promise<void> {
  await updateAppointment(id, { status: 'planned' });
}

export async function getAppointmentStats(): Promise<{
  thisWeek: number;
  upcoming: number;
  completedThisMonth: number;
}> {
  const db = await getDb();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Lundi de la semaine courante (en local)
  const day = now.getDay(); // 0=dim … 6=sam
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEnd = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;

  const weekRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM appointments WHERE date BETWEEN ? AND ? AND status != 'cancelled'",
    [weekStart, weekEnd]
  ).catch(() => [{ cnt: 0 }]);

  const upcomingRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM appointments WHERE date >= date('now') AND status = 'planned'",
    []
  ).catch(() => [{ cnt: 0 }]);

  const completedRows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM appointments WHERE date >= ? AND status = 'completed'",
    [monthStart]
  ).catch(() => [{ cnt: 0 }]);

  return {
    thisWeek: weekRows[0]?.cnt ?? 0,
    upcoming: upcomingRows[0]?.cnt ?? 0,
    completedThisMonth: completedRows[0]?.cnt ?? 0,
  };
}
