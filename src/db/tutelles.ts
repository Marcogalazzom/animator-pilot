import { getDb } from './database';
import type {
  AuthorityEvent,
  AuthorityCorrespondence,
  PreparationChecklist,
  AuthorityType,
  EventType,
  EventStatus,
} from './types';

const UPDATABLE_EVENT_FIELDS = new Set([
  'title',
  'event_type',
  'authority',
  'date_start',
  'date_end',
  'status',
  'notes',
  'is_recurring',
  'recurrence_rule',
  'linked_project_id',
]);

const UPDATABLE_CORRESPONDENCE_FIELDS = new Set([
  'event_id',
  'date',
  'direction',
  'type',
  'authority',
  'contact_role',
  'subject',
  'content',
  'document_path',
  'status',
]);

const UPDATABLE_CHECKLIST_FIELDS = new Set([
  'item_text',
  'is_done',
  'category',
  'sort_order',
]);

// ─── Authority events ─────────────────────────────────────────

export async function getEvents(
  authority?: AuthorityType,
  eventType?: EventType,
  status?: EventStatus
): Promise<AuthorityEvent[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (authority) {
    conditions.push('authority = ?');
    params.push(authority);
  }
  if (eventType) {
    conditions.push('event_type = ?');
    params.push(eventType);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<AuthorityEvent[]>(
    `SELECT * FROM authority_events ${where} ORDER BY date_start ASC`,
    params
  );
}

export async function getEvent(id: number): Promise<AuthorityEvent | null> {
  const db = await getDb();
  const rows = await db.select<AuthorityEvent[]>(
    'SELECT * FROM authority_events WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}

export async function createEvent(
  event: Omit<AuthorityEvent, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO authority_events
      (title, event_type, authority, date_start, date_end, status, notes, is_recurring, recurrence_rule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.title,
      event.event_type,
      event.authority,
      event.date_start,
      event.date_end,
      event.status,
      event.notes,
      event.is_recurring,
      event.recurrence_rule,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateEvent(
  id: number,
  updates: Partial<AuthorityEvent>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_EVENT_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE authority_events SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM authority_events WHERE id = ?', [id]);
}

// ─── Correspondences ──────────────────────────────────────────

export async function getCorrespondences(
  authority?: AuthorityType,
  eventId?: number
): Promise<AuthorityCorrespondence[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (authority) {
    conditions.push('authority = ?');
    params.push(authority);
  }
  if (eventId !== undefined) {
    conditions.push('event_id = ?');
    params.push(eventId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<AuthorityCorrespondence[]>(
    `SELECT * FROM authority_correspondences ${where} ORDER BY date DESC`,
    params
  );
}

export async function createCorrespondence(
  corr: Omit<AuthorityCorrespondence, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO authority_correspondences
      (event_id, date, direction, type, authority, contact_role, subject, content, document_path, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      corr.event_id,
      corr.date,
      corr.direction,
      corr.type,
      corr.authority,
      corr.contact_role,
      corr.subject,
      corr.content,
      corr.document_path,
      corr.status,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateCorrespondence(
  id: number,
  updates: Partial<AuthorityCorrespondence>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_CORRESPONDENCE_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE authority_correspondences SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteCorrespondence(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM authority_correspondences WHERE id = ?', [id]);
}

// ─── Preparation checklists ───────────────────────────────────

export async function getChecklists(eventId: number): Promise<PreparationChecklist[]> {
  const db = await getDb();
  return db.select<PreparationChecklist[]>(
    'SELECT * FROM preparation_checklists WHERE event_id = ? ORDER BY sort_order ASC',
    [eventId]
  );
}

export async function createChecklistItem(
  item: Omit<PreparationChecklist, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO preparation_checklists
      (event_id, item_text, is_done, category, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [item.event_id, item.item_text, item.is_done, item.category, item.sort_order]
  );
  return result.lastInsertId ?? 0;
}

export async function updateChecklistItem(
  id: number,
  updates: Partial<PreparationChecklist>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_CHECKLIST_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE preparation_checklists SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteChecklistItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM preparation_checklists WHERE id = ?', [id]);
}
