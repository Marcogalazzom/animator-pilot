import { getDb } from './database';

export interface SearchResult {
  id: number;
  title: string;
  module: 'projets' | 'conformite' | 'notes' | 'tutelles' | 'veille';
  icon_hint: string;
  link_path: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const db = await getDb();
  const like = `%${query.trim()}%`;

  const [projects, obligations, documents, events, watchItems] = await Promise.all([
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM projects WHERE title LIKE ? ORDER BY created_at DESC LIMIT 5`,
      [like]
    ),
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM compliance_obligations WHERE title LIKE ? ORDER BY created_at DESC LIMIT 5`,
      [like]
    ),
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM documents WHERE title LIKE ? ORDER BY date DESC LIMIT 5`,
      [like]
    ),
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM authority_events WHERE title LIKE ? ORDER BY created_at DESC LIMIT 5`,
      [like]
    ),
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM regulatory_watch WHERE title LIKE ? ORDER BY date_published DESC LIMIT 5`,
      [like]
    ),
  ]);

  const results: SearchResult[] = [];

  for (const p of projects) {
    results.push({ id: p.id, title: p.title, module: 'projets', icon_hint: 'FolderKanban', link_path: `/projects` });
  }
  for (const o of obligations) {
    results.push({ id: o.id, title: o.title, module: 'conformite', icon_hint: 'ShieldCheck', link_path: `/compliance` });
  }
  for (const d of documents) {
    results.push({ id: d.id, title: d.title, module: 'notes', icon_hint: 'FileText', link_path: `/notes` });
  }
  for (const e of events) {
    results.push({ id: e.id, title: e.title, module: 'tutelles', icon_hint: 'Landmark', link_path: `/tutelles` });
  }
  for (const w of watchItems) {
    results.push({ id: w.id, title: w.title, module: 'veille', icon_hint: 'BookOpen', link_path: `/veille` });
  }

  return results.slice(0, 20);
}

// ─── Unified deadlines ────────────────────────────────────────

export interface UpcomingDeadline {
  title: string;
  date: string;
  module: 'projects' | 'compliance' | 'tutelles';
  link_path: string;
}

export async function getUpcomingDeadlines(limit = 10): Promise<UpcomingDeadline[]> {
  const db = await getDb();

  const [projects, obligations, events] = await Promise.all([
    db.select<{ title: string; due_date: string }[]>(
      `SELECT title, due_date FROM projects WHERE status != 'done' AND due_date IS NOT NULL ORDER BY due_date ASC LIMIT ?`,
      [limit]
    ),
    db.select<{ title: string; next_due_date: string }[]>(
      `SELECT title, next_due_date FROM compliance_obligations WHERE status != 'compliant' AND next_due_date IS NOT NULL ORDER BY next_due_date ASC LIMIT ?`,
      [limit]
    ),
    db.select<{ title: string; date_start: string }[]>(
      `SELECT title, date_start FROM authority_events WHERE status != 'completed' AND date_start IS NOT NULL AND date_start >= date('now') ORDER BY date_start ASC LIMIT ?`,
      [limit]
    ),
  ]);

  const results: UpcomingDeadline[] = [
    ...projects.map(p => ({ title: p.title, date: p.due_date, module: 'projects' as const, link_path: '/projects' })),
    ...obligations.map(o => ({ title: o.title, date: o.next_due_date, module: 'compliance' as const, link_path: '/compliance' })),
    ...events.map(e => ({ title: e.title, date: e.date_start, module: 'tutelles' as const, link_path: '/tutelles' })),
  ];

  return results
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
