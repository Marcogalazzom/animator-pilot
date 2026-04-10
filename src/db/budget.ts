import { getDb } from './database';
import type { AnimationBudget, Expense, ExpenseCategory } from './types';

const UPDATABLE_EXPENSE = new Set([
  'title', 'category', 'amount', 'date', 'description', 'supplier',
  'invoice_path', 'linked_intervenant_id', 'synced_from', 'last_sync_at', 'external_id',
]);

// ─── Budget ──────────────────────────────────────────────────

export async function getBudget(fiscalYear: number): Promise<AnimationBudget | null> {
  const db = await getDb();
  const rows = await db.select<AnimationBudget[]>(
    'SELECT * FROM animation_budget WHERE fiscal_year = ?',
    [fiscalYear]
  );
  return rows[0] ?? null;
}

export async function upsertBudget(fiscalYear: number, totalAllocated: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO animation_budget (fiscal_year, total_allocated)
     VALUES (?, ?)
     ON CONFLICT(fiscal_year) DO UPDATE SET total_allocated = excluded.total_allocated`,
    [fiscalYear, totalAllocated]
  );
}

// ─── Expenses ────────────────────────────────────────────────

export async function getExpenses(fiscalYear: number, category?: ExpenseCategory): Promise<Expense[]> {
  const db = await getDb();
  if (category) {
    return db.select<Expense[]>(
      'SELECT * FROM expenses WHERE fiscal_year = ? AND category = ? ORDER BY date DESC',
      [fiscalYear, category]
    );
  }
  return db.select<Expense[]>(
    'SELECT * FROM expenses WHERE fiscal_year = ? ORDER BY date DESC',
    [fiscalYear]
  );
}

export async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO expenses (fiscal_year, title, category, amount, date, description, supplier,
     invoice_path, linked_intervenant_id, synced_from, last_sync_at, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.fiscal_year, expense.title, expense.category, expense.amount,
      expense.date, expense.description, expense.supplier, expense.invoice_path,
      expense.linked_intervenant_id, expense.synced_from ?? '', expense.last_sync_at, expense.external_id,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateExpense(id: number, updates: Partial<Expense>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_EXPENSE.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE expenses SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM expenses WHERE id = ?', [id]);
}

// ─── Summary ─────────────────────────────────────────────────

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: Record<ExpenseCategory, number>;
}

export async function getExpenseSummary(fiscalYear: number): Promise<ExpenseSummary> {
  const db = await getDb();

  const totalRows = await db.select<{ total: number; cnt: number }[]>(
    'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM expenses WHERE fiscal_year = ?',
    [fiscalYear]
  ).catch(() => [{ total: 0, cnt: 0 }]);

  const catRows = await db.select<{ category: string; total: number }[]>(
    'SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE fiscal_year = ? GROUP BY category',
    [fiscalYear]
  ).catch(() => []);

  const byCategory: Record<ExpenseCategory, number> = {
    intervenants: 0, materiel: 0, sorties: 0, fetes: 0, other: 0,
  };
  for (const row of catRows) {
    if (row.category in byCategory) {
      byCategory[row.category as ExpenseCategory] = row.total;
    }
  }

  return { total: totalRows[0]?.total ?? 0, count: totalRows[0]?.cnt ?? 0, byCategory };
}
