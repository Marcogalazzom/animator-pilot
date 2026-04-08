import { getDb } from './database';
import type { Project, Action } from './types';

export async function getProjects(status?: string): Promise<Project[]> {
  const db = await getDb();
  if (status) {
    return db.select<Project[]>(
      'SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
  }
  return db.select<Project[]>('SELECT * FROM projects ORDER BY created_at DESC', []);
}

export async function getProject(id: number): Promise<Project | null> {
  const db = await getDb();
  const rows = await db.select<Project[]>('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO projects (title, description, owner_role, status, start_date, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      project.title,
      project.description,
      project.owner_role,
      project.status,
      project.start_date,
      project.due_date,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateProject(id: number, updates: Partial<Project>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE projects SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM projects WHERE id = ?', [id]);
}

export async function getActions(projectId: number): Promise<Action[]> {
  const db = await getDb();
  return db.select<Action[]>(
    'SELECT * FROM actions WHERE project_id = ? ORDER BY created_at ASC',
    [projectId]
  );
}

export async function createAction(action: Omit<Action, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO actions (project_id, title, progress, due_date, status)
     VALUES (?, ?, ?, ?, ?)`,
    [action.project_id, action.title, action.progress, action.due_date, action.status]
  );
  return result.lastInsertId ?? 0;
}

export async function updateAction(id: number, updates: Partial<Action>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter(
    (k) => k !== 'id' && k !== 'created_at' && k !== 'project_id'
  );
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);

  await db.execute(`UPDATE actions SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteAction(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM actions WHERE id = ?', [id]);
}
