import { getDb } from './database';
import type { Document, DocType } from './types';

const UPDATABLE_FIELDS = new Set(['title', 'doc_type', 'content', 'author_role', 'date', 'tags', 'is_template']);

export async function getDocuments(docType?: DocType, includeTemplates = false): Promise<Document[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (docType) { conditions.push('doc_type = ?'); bindings.push(docType); }
  if (!includeTemplates) { conditions.push('is_template = 0'); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<Document[]>(`SELECT * FROM documents ${where} ORDER BY date DESC`, bindings);
}

export async function getDocument(id: number): Promise<Document | null> {
  const db = await getDb();
  const rows = await db.select<Document[]>('SELECT * FROM documents WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function getTemplates(): Promise<Document[]> {
  const db = await getDb();
  return db.select<Document[]>('SELECT * FROM documents WHERE is_template = 1 ORDER BY doc_type', []);
}

export async function createDocument(doc: Omit<Document, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO documents (title, doc_type, content, author_role, date, tags, is_template) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [doc.title, doc.doc_type, doc.content, doc.author_role, doc.date, doc.tags, doc.is_template]
  );
  return result.lastInsertId ?? 0;
}

export async function updateDocument(id: number, updates: Partial<Document>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE documents SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM documents WHERE id = ?', [id]);
}
