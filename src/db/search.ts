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
