import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './database';
import { firestore } from '@/services/firebase';
import { resolveSwatch } from '@/data/activityTypeLibrary';

// ─── Remote sync (Firestore customActivityTypes) ─────────────

interface RemoteCustomType {
  key?: unknown;
  label?: unknown;
  icon?: unknown;
  colorName?: unknown;
}

/**
 * Pulls the per-EHPAD custom types from Firestore's customActivityTypes
 * collection and mirrors them into category_colors. Silent on network errors
 * — offline keeps the last-seen palette.
 */
export async function syncCustomActivityTypesFromFirestore(): Promise<void> {
  const snapshot = await getDocs(collection(firestore, 'customActivityTypes'));
  const db = await getDb();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as RemoteCustomType;
    const key = typeof data.key === 'string' ? data.key.trim() : '';
    const label = typeof data.label === 'string' ? data.label.trim() : '';
    if (!key || !label) continue;

    const colorName = typeof data.colorName === 'string' ? data.colorName : 'slate';
    const swatch = resolveSwatch(colorName);

    await db.execute(
      `INSERT INTO category_colors (module, name, color, bg, label)
       VALUES ('activities', ?, ?, ?, ?)
       ON CONFLICT(module, name) DO UPDATE SET
         color = excluded.color,
         bg    = excluded.bg,
         label = excluded.label`,
      [key, swatch.hex, swatch.hexBg, label],
    );
  }
}
