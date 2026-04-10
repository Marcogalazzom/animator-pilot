import { getDb } from './database';

export interface SearchResult {
  id: number;
  title: string;
  module: 'projets' | 'notes';
  icon_hint: string;
  link_path: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const db = await getDb();
  const like = `%${query.trim()}%`;

  const [projects, documents] = await Promise.all([
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM projects WHERE title LIKE ? ORDER BY created_at DESC LIMIT 5`,
      [like]
    ),
    db.select<{ id: number; title: string }[]>(
      `SELECT id, title FROM documents WHERE title LIKE ? ORDER BY date DESC LIMIT 5`,
      [like]
    ),
  ]);

  const results: SearchResult[] = [];

  for (const p of projects) {
    results.push({ id: p.id, title: p.title, module: 'projets', icon_hint: 'FolderKanban', link_path: `/projects` });
  }
  for (const d of documents) {
    results.push({ id: d.id, title: d.title, module: 'notes', icon_hint: 'FileText', link_path: `/notes` });
  }

  return results.slice(0, 20);
}

// ─── Unified deadlines ────────────────────────────────────────

export interface UpcomingDeadline {
  title: string;
  date: string;
  module: 'projects' | 'activities';
  link_path: string;
}

export async function getUpcomingDeadlines(limit = 10): Promise<UpcomingDeadline[]> {
  const db = await getDb();

  const [projects, activities] = await Promise.all([
    db.select<{ title: string; due_date: string }[]>(
      `SELECT title, due_date FROM projects WHERE status != 'done' AND due_date IS NOT NULL ORDER BY due_date ASC LIMIT ?`,
      [limit]
    ),
    db.select<{ title: string; date: string }[]>(
      `SELECT title, date FROM activities WHERE status IN ('planned', 'in_progress') AND date IS NOT NULL ORDER BY date ASC LIMIT ?`,
      [limit]
    ),
  ]);

  const results: UpcomingDeadline[] = [
    ...projects.map(p => ({ title: p.title, date: p.due_date, module: 'projects' as const, link_path: '/projects' })),
    ...activities.map(a => ({ title: a.title, date: a.date, module: 'activities' as const, link_path: '/activities' })),
  ];

  return results
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
