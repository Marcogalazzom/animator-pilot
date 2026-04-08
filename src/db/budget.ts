import { getDb } from './database';
import type { BudgetSection, BudgetLine, BudgetLineType, Investment } from './types';

const UPDATABLE_BUDGET_LINE_FIELDS = new Set([
  'section_id',
  'title_number',
  'line_label',
  'line_type',
  'amount_previsionnel',
  'amount_realise',
  'fiscal_year',
  'period',
]);

const UPDATABLE_INVESTMENT_FIELDS = new Set([
  'title',
  'description',
  'amount_planned',
  'amount_committed',
  'amount_realized',
  'funding_source',
  'start_date',
  'end_date',
  'status',
  'fiscal_year',
]);

// ─── Budget sections ──────────────────────────────────────────

export async function getBudgetSections(): Promise<BudgetSection[]> {
  const db = await getDb();
  return db.select<BudgetSection[]>('SELECT * FROM budget_sections ORDER BY name', []);
}

// ─── Budget lines ─────────────────────────────────────────────

export async function getBudgetLines(
  sectionId?: number,
  fiscalYear?: number,
  lineType?: BudgetLineType
): Promise<BudgetLine[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (sectionId !== undefined) {
    conditions.push('section_id = ?');
    params.push(sectionId);
  }
  if (fiscalYear !== undefined) {
    conditions.push('fiscal_year = ?');
    params.push(fiscalYear);
  }
  if (lineType) {
    conditions.push('line_type = ?');
    params.push(lineType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<BudgetLine[]>(
    `SELECT * FROM budget_lines ${where} ORDER BY section_id, title_number, line_label`,
    params
  );
}

export async function createBudgetLine(
  line: Omit<BudgetLine, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO budget_lines
      (section_id, title_number, line_label, line_type, amount_previsionnel, amount_realise, fiscal_year, period)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      line.section_id,
      line.title_number,
      line.line_label,
      line.line_type,
      line.amount_previsionnel,
      line.amount_realise,
      line.fiscal_year,
      line.period,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateBudgetLine(
  id: number,
  updates: Partial<BudgetLine>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_BUDGET_LINE_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE budget_lines SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteBudgetLine(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM budget_lines WHERE id = ?', [id]);
}

export async function getBudgetSummary(
  fiscalYear: number
): Promise<{ section: string; totalChargesPrevu: number; totalProduitsPrevu: number; totalChargesRealise: number; totalProduitsRealise: number }[]> {
  const db = await getDb();
  const rows = await db.select<{ section: string; line_type: string; total_prevu: number; total_realise: number }[]>(
    `SELECT bs.label AS section, bl.line_type,
            SUM(bl.amount_previsionnel) AS total_prevu,
            SUM(bl.amount_realise) AS total_realise
     FROM budget_lines bl
     JOIN budget_sections bs ON bl.section_id = bs.id
     WHERE bl.fiscal_year = ?
     GROUP BY bs.label, bl.line_type`,
    [fiscalYear]
  );

  const map = new Map<string, { totalChargesPrevu: number; totalProduitsPrevu: number; totalChargesRealise: number; totalProduitsRealise: number }>();
  for (const row of rows) {
    if (!map.has(row.section)) {
      map.set(row.section, { totalChargesPrevu: 0, totalProduitsPrevu: 0, totalChargesRealise: 0, totalProduitsRealise: 0 });
    }
    const entry = map.get(row.section)!;
    if (row.line_type === 'charge') {
      entry.totalChargesPrevu = row.total_prevu ?? 0;
      entry.totalChargesRealise = row.total_realise ?? 0;
    } else {
      entry.totalProduitsPrevu = row.total_prevu ?? 0;
      entry.totalProduitsRealise = row.total_realise ?? 0;
    }
  }

  return Array.from(map.entries()).map(([section, data]) => ({
    section,
    ...data,
  }));
}

// ─── Investments ──────────────────────────────────────────────

export async function getInvestments(fiscalYear?: number): Promise<Investment[]> {
  const db = await getDb();
  if (fiscalYear !== undefined) {
    return db.select<Investment[]>(
      'SELECT * FROM investments WHERE fiscal_year = ? ORDER BY created_at DESC',
      [fiscalYear]
    );
  }
  return db.select<Investment[]>('SELECT * FROM investments ORDER BY created_at DESC', []);
}

export async function createInvestment(
  inv: Omit<Investment, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO investments
      (title, description, amount_planned, amount_committed, amount_realized, funding_source, start_date, end_date, status, fiscal_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inv.title,
      inv.description,
      inv.amount_planned,
      inv.amount_committed,
      inv.amount_realized,
      inv.funding_source,
      inv.start_date,
      inv.end_date,
      inv.status,
      inv.fiscal_year,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateInvestment(
  id: number,
  updates: Partial<Investment>
): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_INVESTMENT_FIELDS.has(k));
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE investments SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteInvestment(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM investments WHERE id = ?', [id]);
}
