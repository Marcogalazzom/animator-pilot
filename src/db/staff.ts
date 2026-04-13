import { getDb } from './database';
import type { StaffMember, StaffRole } from './types';

const UPDATABLE_FIELDS = new Set(['first_name', 'last_name', 'role', 'phone', 'email', 'service', 'is_available', 'notes', 'hourly_rate', 'session_rate', 'synced_from', 'last_sync_at']);

export async function getStaffMembers(role?: StaffRole): Promise<StaffMember[]> {
  const db = await getDb();
  if (role) {
    return db.select<StaffMember[]>(
      'SELECT * FROM staff WHERE role = ? ORDER BY last_name ASC, first_name ASC',
      [role]
    );
  }
  return db.select<StaffMember[]>('SELECT * FROM staff ORDER BY last_name ASC, first_name ASC', []);
}

export async function getStaffMember(id: number): Promise<StaffMember | null> {
  const db = await getDb();
  const rows = await db.select<StaffMember[]>('SELECT * FROM staff WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createStaffMember(member: Omit<StaffMember, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO staff (first_name, last_name, role, phone, email, service, is_available, notes, hourly_rate, session_rate, synced_from, last_sync_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [member.first_name, member.last_name, member.role, member.phone, member.email, member.service, member.is_available, member.notes, member.hourly_rate, member.session_rate, member.synced_from, member.last_sync_at]
  );
  return result.lastInsertId ?? 0;
}

export async function updateStaffMember(id: number, updates: Partial<StaffMember>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE staff SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteStaffMember(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM staff WHERE id = ?', [id]);
}

export async function getStaffStats(): Promise<{ total: number; available: number; roles: number }> {
  const db = await getDb();
  const totalRows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM staff', []).catch(() => [{ cnt: 0 }]);
  const availRows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM staff WHERE is_available = 1', []).catch(() => [{ cnt: 0 }]);
  const roleRows = await db.select<{ cnt: number }[]>('SELECT COUNT(DISTINCT role) as cnt FROM staff', []).catch(() => [{ cnt: 0 }]);
  return { total: totalRows[0]?.cnt ?? 0, available: availRows[0]?.cnt ?? 0, roles: roleRows[0]?.cnt ?? 0 };
}
