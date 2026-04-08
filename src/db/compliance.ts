import { getDb } from './database';
import type { ComplianceObligation, ObligationCategory, ObligationStatus } from './types';

const UPDATABLE_OBLIGATION_FIELDS = new Set([
  'title',
  'category',
  'frequency',
  'description',
  'status',
  'next_due_date',
  'last_validated_date',
  'document_path',
  'linked_project_id',
]);

export async function getObligations(
  category?: ObligationCategory,
  status?: ObligationStatus
): Promise<ComplianceObligation[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<ComplianceObligation[]>(
    `SELECT * FROM compliance_obligations ${where} ORDER BY category, title`,
    params
  );
}

export async function getObligation(id: number): Promise<ComplianceObligation | null> {
  const db = await getDb();
  const rows = await db.select<ComplianceObligation[]>(
    'SELECT * FROM compliance_obligations WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}

export async function createObligation(
  obligation: Omit<ComplianceObligation, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO compliance_obligations
      (title, category, frequency, description, status, next_due_date, last_validated_date, document_path, is_builtin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      obligation.title,
      obligation.category,
      obligation.frequency,
      obligation.description,
      obligation.status,
      obligation.next_due_date,
      obligation.last_validated_date,
      obligation.document_path,
      obligation.is_builtin,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateObligation(
  id: number,
  updates: Partial<ComplianceObligation>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_OBLIGATION_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE compliance_obligations SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteObligation(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM compliance_obligations WHERE id = ?', [id]);
}

export async function getObligationStats(): Promise<{
  total: number;
  compliant: number;
  overdue: number;
  upcoming30: number;
}> {
  const db = await getDb();

  const [totalRow] = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM compliance_obligations',
    []
  );
  const [compliantRow] = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM compliance_obligations WHERE status = 'compliant'",
    []
  );
  const [overdueRow] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM compliance_obligations
     WHERE next_due_date IS NOT NULL AND next_due_date < date('now') AND status != 'compliant'`,
    []
  );
  const [upcomingRow] = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM compliance_obligations
     WHERE next_due_date IS NOT NULL
       AND next_due_date >= date('now')
       AND next_due_date <= date('now', '+30 days')
       AND status != 'compliant'`,
    []
  );

  return {
    total: totalRow?.count ?? 0,
    compliant: compliantRow?.count ?? 0,
    overdue: overdueRow?.count ?? 0,
    upcoming30: upcomingRow?.count ?? 0,
  };
}
