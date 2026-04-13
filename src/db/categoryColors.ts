import { getDb } from './database';

export interface CategoryColor {
  module: string;
  name: string;
  color: string;
  bg: string;
  label: string | null;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function autoColor(name: string): { color: string; bg: string } {
  const hue = hashHue(name);
  return {
    color: `hsl(${hue}, 65%, 32%)`,
    bg: `hsl(${hue}, 70%, 95%)`,
  };
}

export async function listCategoryColors(module: string): Promise<CategoryColor[]> {
  const db = await getDb();
  return db.select<CategoryColor[]>(
    'SELECT module, name, color, bg, label FROM category_colors WHERE module = ? ORDER BY name ASC',
    [module]
  );
}

export async function ensureCategoryColors(module: string, names: string[]): Promise<CategoryColor[]> {
  const unique = Array.from(new Set(names.filter((n): n is string => typeof n === 'string' && n.length > 0)));
  if (unique.length === 0) return listCategoryColors(module);

  const db = await getDb();
  const placeholders = unique.map(() => '?').join(',');
  const existing = await db.select<{ name: string }[]>(
    `SELECT name FROM category_colors WHERE module = ? AND name IN (${placeholders})`,
    [module, ...unique]
  );
  const existingSet = new Set(existing.map((r) => r.name));

  for (const name of unique) {
    if (existingSet.has(name)) continue;
    const { color, bg } = autoColor(name);
    await db.execute(
      'INSERT OR IGNORE INTO category_colors (module, name, color, bg, label) VALUES (?, ?, ?, ?, ?)',
      [module, name, color, bg, null]
    );
  }

  return listCategoryColors(module);
}

export function categoryLabel(c: CategoryColor): string {
  return c.label ?? c.name;
}
