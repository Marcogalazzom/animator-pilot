/**
 * Sync Service — synchronises Activities, Inventory and Staff
 * with Firebase Firestore (planning-ehpad project).
 *
 * Firestore collections:
 *   activities   → local activities table
 *   inventory    → local inventory table
 *   intervenants → local staff table
 *
 * Auth: email/password via Firebase Auth (required for inventory reads).
 * Plan Spark: no Cloud Functions, direct SDK access.
 */

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './firebase';
import { getDb } from '@/db/database';
import { createSyncLog, completeSyncLog, getLastSync } from '@/db/sync';
import { getSetting } from '@/db/settings';
import type { Activity, SyncModule } from '@/db/types';

// ─── Activity type mapping (Firestore → local) ──────────────

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  sport: 'sport',
  cognitive: 'jeux',
  creative: 'atelier_creatif',
  vr: 'other',
  boardgames: 'jeux',
  music: 'musique',
  food: 'cuisine',
  social: 'intergenerationnel',
  outing: 'sortie',
  festive: 'fete',
  sensory: 'bien_etre',
  animal: 'other',
  religious: 'other',
  cinema: 'other',
  reading: 'lecture',
  press: 'lecture',
  volleyball: 'sport',
};

// Reverse mapping (local → Firestore) for push
const ACTIVITY_TYPE_REVERSE: Record<string, string> = {
  sport: 'sport',
  jeux: 'boardgames',
  atelier_creatif: 'creative',
  musique: 'music',
  cuisine: 'food',
  intergenerationnel: 'social',
  sortie: 'outing',
  fete: 'festive',
  bien_etre: 'sensory',
  lecture: 'reading',
  other: 'cognitive',
};

// ─── Day / week helpers ──────────────────────────────────────

const DAY_OFFSET: Record<string, number> = {
  Lundi: 0, Mardi: 1, Mercredi: 2, Jeudi: 3,
  Vendredi: 4, Samedi: 5, Dimanche: 6,
};

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function computeDate(weekId: string, day: string): string {
  const monday = new Date(weekId + 'T00:00:00');
  monday.setDate(monday.getDate() + (DAY_OFFSET[day] ?? 0));
  return monday.toISOString().slice(0, 10);
}

function computeWeekIdAndDay(dateStr: string): { weekId: string; day: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const weekId = monday.toISOString().slice(0, 10);
  const dayIndex = dow === 0 ? 6 : dow - 1;
  return { weekId, day: DAY_NAMES[dayIndex] };
}

// ─── Inventory condition mapping ─────────────────────────────

const CONDITION_MAP: Record<string, string> = {
  good: 'bon',
  worn: 'usage',
  to_replace: 'a_remplacer',
  out_of_service: 'a_remplacer',
};


// ─── Staff role: on conserve la valeur brute de Firestore ───
// (liberal/salarie/benevole ou toute valeur custom), le module
// Staff utilise category_colors pour afficher chaque rôle.

// ─── Sync Activities ─────────────────────────────────────────

export async function syncActivities(): Promise<{ synced: number; failed: number }> {
  const logId = await createSyncLog('activities', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSyncRecord = await getLastSync('activities');
    const db = await getDb();
    const now = new Date().toISOString();

    // ── PULL from Firestore (animation only, not PASA) ──
    const activitiesRef = collection(firestore, 'activities');
    const baseQuery = query(activitiesRef, where('unit', '==', 'main'));
    const snapshot = await getDocs(baseQuery);

    // Filter createdAt client-side to avoid composite index requirement
    const sinceMs = lastSyncRecord?.finished_at
      ? new Date(lastSyncRecord.finished_at).getTime()
      : 0;
    const filteredDocs = sinceMs > 0
      ? snapshot.docs.filter(doc => {
          const createdAt = doc.data().createdAt;
          return typeof createdAt === 'number' && createdAt > sinceMs;
        })
      : snapshot.docs;

    for (const docSnap of filteredDocs) {
      try {
        const data = docSnap.data();
        const date = computeDate(data.weekId ?? '', data.day ?? '');
        const activityType = ACTIVITY_TYPE_MAP[data.type] ?? 'other';
        const status = data.cancelled ? 'cancelled' : 'planned';
        const title = data.title ?? '';
        const timeStart = data.time ?? null;
        const location = data.desc ?? '';
        const animatorName = data.intervenant ?? '';
        const typeLabel = data.typeLabel ?? '';
        const notes = typeLabel ? `${typeLabel}` : '';

        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM activities WHERE external_id = ?',
          [docSnap.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE activities SET title=?, activity_type=?, description=?, date=?,
             time_start=?, location=?, animator_name=?, status=?, notes=?,
             synced_from='planning-ehpad', last_sync_at=?, is_shared=1
             WHERE external_id=?`,
            [title, activityType, '', date, timeStart, location, animatorName, status, notes, now, docSnap.id]
          );
        } else {
          await db.execute(
            `INSERT INTO activities (title, activity_type, description, date, time_start, time_end,
             location, max_participants, actual_participants, animator_name, status,
             materials_needed, notes, synced_from, last_sync_at, external_id, is_shared)
             VALUES (?, ?, '', ?, ?, NULL, ?, 0, 0, ?, ?, '', ?, 'planning-ehpad', ?, ?, 1)`,
            [title, activityType, date, timeStart, location, animatorName, status, notes, now, docSnap.id]
          );
        }
        synced++;
      } catch {
        failed++;
      }
    }

    // ── PUSH local shared activities to Firestore ──
    const localOnly = await db.select<Activity[]>(
      `SELECT * FROM activities WHERE (synced_from = '' OR synced_from IS NULL) AND is_shared = 1`,
      []
    );

    for (const a of localOnly) {
      try {
        const { weekId, day } = computeWeekIdAndDay(a.date);
        const firestoreType = ACTIVITY_TYPE_REVERSE[a.activity_type] ?? 'cognitive';

        const docData: Record<string, unknown> = {
          title: a.title,
          type: firestoreType,
          day,
          weekId,
          time: a.time_start ?? '',
          desc: a.location,
          intervenant: a.animator_name,
          cancelled: a.status === 'cancelled',
          unit: 'main',
          isRecurring: false,
          createdAt: Date.now(),
        };

        // If user is authenticated, try to add lastModifiedBy
        if (auth.currentUser) {
          docData.lastModifiedBy = {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email ?? '',
          };
        }

        const docRef = await addDoc(collection(firestore, 'activities'), docData);

        // Mark as synced locally
        await db.execute(
          `UPDATE activities SET synced_from='planning-ehpad', last_sync_at=?, external_id=? WHERE id=?`,
          [now, docRef.id, a.id]
        );
        synced++;
      } catch {
        // Push failed — not critical, will retry next sync
        failed++;
      }
    }

    await completeSyncLog(logId, synced, failed, 'success');
  } catch (err) {
    await completeSyncLog(logId, synced, failed, 'error', String(err));
    throw err;
  }

  return { synced, failed };
}

// ─── Sync Inventory ──────────────────────────────────────────

export async function syncInventory(): Promise<{ synced: number; failed: number }> {
  if (!auth.currentUser) {
    throw new Error('Connectez-vous dans Paramètres pour synchroniser l\'inventaire');
  }

  const logId = await createSyncLog('inventory', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const db = await getDb();
    const now = new Date().toISOString();

    const snapshot = await getDocs(collection(firestore, 'inventory'));

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        const name = data.name ?? '';
        const category = typeof data.category === 'string' && data.category ? data.category : 'other';
        const inventoryType = data.type ?? 'consumable'; // consumable or durable
        const quantity = data.quantity ?? (inventoryType === 'durable' ? 1 : 0);
        const condition = inventoryType === 'durable'
          ? (CONDITION_MAP[data.condition] ?? 'bon')
          : 'bon';
        const location = data.unit ?? '';
        const notes = data.notes ?? '';

        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM inventory WHERE external_id = ?',
          [docSnap.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE inventory SET name=?, category=?, quantity=?, condition=?,
             location=?, notes=?, inventory_type=?,
             synced_from='planning-ehpad', last_sync_at=?
             WHERE external_id=?`,
            [name, category, quantity, condition, location, notes, inventoryType, now, docSnap.id]
          );
        } else {
          await db.execute(
            `INSERT INTO inventory (name, category, quantity, condition, location, notes,
             inventory_type, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [name, category, quantity, condition, location, notes, inventoryType, now, docSnap.id]
          );
        }
        synced++;
      } catch {
        failed++;
      }
    }

    await completeSyncLog(logId, synced, failed, 'success');
  } catch (err) {
    await completeSyncLog(logId, synced, failed, 'error', String(err));
    throw err;
  }

  return { synced, failed };
}

// ─── Sync Staff (intervenants) ───────────────────────────────

export async function syncStaff(): Promise<{ synced: number; failed: number }> {
  const logId = await createSyncLog('staff', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSyncRecord = await getLastSync('staff');
    const db = await getDb();
    const now = new Date().toISOString();

    const intervenantsRef = collection(firestore, 'intervenants');
    const q = query(intervenantsRef, where('actif', '==', true));
    const snapshot = await getDocs(q);

    // Filter updatedAt client-side to avoid composite index requirement
    const sinceMs = lastSyncRecord?.finished_at
      ? new Date(lastSyncRecord.finished_at).getTime()
      : 0;
    const filteredDocs = sinceMs > 0
      ? snapshot.docs.filter(doc => {
          const updatedAt = doc.data().updatedAt;
          if (!updatedAt) return true;
          const ts = updatedAt.toDate ? updatedAt.toDate().getTime() : new Date(updatedAt).getTime();
          return ts > sinceMs;
        })
      : snapshot.docs;

    for (const docSnap of filteredDocs) {
      try {
        const data = docSnap.data();
        const firstName = data.prenom ?? '';
        const lastName = data.nom ?? '';
        const role = typeof data.type === 'string' && data.type ? data.type : 'other';
        const phone = data.tel ?? '';
        const email = data.email ?? '';
        const service = Array.isArray(data.specialites) ? data.specialites.join(', ') : '';
        const isAvailable = data.actif ? 1 : 0;
        const notes = data.notes ?? '';
        const hourlyRate = typeof data.tarif === 'number' ? data.tarif : null;
        const sessionRate = typeof data.tarifSeance === 'number' ? data.tarifSeance : null;

        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM staff WHERE external_id = ?',
          [docSnap.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE staff SET first_name=?, last_name=?, role=?, phone=?, email=?,
             service=?, is_available=?, notes=?, hourly_rate=?, session_rate=?,
             synced_from='planning-ehpad', last_sync_at=?
             WHERE external_id=?`,
            [firstName, lastName, role, phone, email, service, isAvailable, notes, hourlyRate, sessionRate, now, docSnap.id]
          );
        } else {
          await db.execute(
            `INSERT INTO staff (first_name, last_name, role, phone, email, service,
             is_available, notes, hourly_rate, session_rate, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [firstName, lastName, role, phone, email, service, isAvailable, notes, hourlyRate, sessionRate, now, docSnap.id]
          );
        }
        synced++;
      } catch {
        failed++;
      }
    }

    await completeSyncLog(logId, synced, failed, 'success');
  } catch (err) {
    await completeSyncLog(logId, synced, failed, 'error', String(err));
    throw err;
  }

  return { synced, failed };
}

// ─── Sync All ────────────────────────────────────────────────

// ─── Sync Budget ─────────────────────────────────────────────

export async function syncBudget(): Promise<{ synced: number; failed: number }> {
  if (!auth.currentUser) {
    throw new Error('Connectez-vous dans Paramètres pour synchroniser le budget');
  }

  const logId = await createSyncLog('budget', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // PULL budgets
    const budgetSnap = await getDocs(collection(firestore, 'animationBudget'));
    for (const docSnap of budgetSnap.docs) {
      try {
        const data = docSnap.data();
        const fiscalYear = data.fiscal_year ?? parseInt(docSnap.id);
        const totalAllocated = data.total_allocated ?? 0;

        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM animation_budget WHERE fiscal_year = ?', [fiscalYear]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE animation_budget SET total_allocated=?, synced_from='planning-ehpad', last_sync_at=?, external_id=? WHERE fiscal_year=?`,
            [totalAllocated, now, docSnap.id, fiscalYear]
          );
        } else {
          await db.execute(
            `INSERT INTO animation_budget (fiscal_year, total_allocated, synced_from, last_sync_at, external_id) VALUES (?, ?, 'planning-ehpad', ?, ?)`,
            [fiscalYear, totalAllocated, now, docSnap.id]
          );
        }
        synced++;
      } catch { failed++; }
    }

    // PULL expenses
    const lastSyncRecord = await getLastSync('budget');
    let expQ;
    if (lastSyncRecord?.finished_at) {
      const sinceMs = new Date(lastSyncRecord.finished_at).getTime();
      expQ = query(collection(firestore, 'animationExpenses'), where('created_at', '>', sinceMs));
    } else {
      expQ = query(collection(firestore, 'animationExpenses'));
    }

    const expSnap = await getDocs(expQ);
    for (const docSnap of expSnap.docs) {
      try {
        const data = docSnap.data();
        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM expenses WHERE external_id = ?', [docSnap.id]
        );

        const vals = [
          data.fiscal_year ?? new Date().getFullYear(),
          data.title ?? '', data.category ?? 'other', data.amount ?? 0,
          data.date ?? '', data.description ?? '', data.supplier ?? '',
          data.invoice_path ?? null, data.linked_intervenant_id ?? null,
        ];

        if (existing.length > 0) {
          await db.execute(
            `UPDATE expenses SET fiscal_year=?, title=?, category=?, amount=?, date=?, description=?, supplier=?, invoice_path=?, linked_intervenant_id=?, synced_from='planning-ehpad', last_sync_at=? WHERE external_id=?`,
            [...vals, now, docSnap.id]
          );
        } else {
          await db.execute(
            `INSERT INTO expenses (fiscal_year, title, category, amount, date, description, supplier, invoice_path, linked_intervenant_id, synced_from, last_sync_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [...vals, now, docSnap.id]
          );
        }
        synced++;
      } catch { failed++; }
    }

    // PUSH local-only budgets
    const localBudgets = await db.select<{ fiscal_year: number; total_allocated: number }[]>(
      `SELECT fiscal_year, total_allocated FROM animation_budget WHERE synced_from = '' OR synced_from IS NULL`, []
    );
    for (const b of localBudgets) {
      try {
        const docData: Record<string, unknown> = {
          fiscal_year: b.fiscal_year, total_allocated: b.total_allocated,
          created_at: Date.now(), updated_at: Date.now(),
        };
        if (auth.currentUser) {
          docData.created_by = { uid: auth.currentUser.uid, email: auth.currentUser.email ?? '' };
        }
        const docRef = await addDoc(collection(firestore, 'animationBudget'), docData);
        await db.execute(
          `UPDATE animation_budget SET synced_from='planning-ehpad', last_sync_at=?, external_id=? WHERE fiscal_year=?`,
          [now, docRef.id, b.fiscal_year]
        );
        synced++;
      } catch { failed++; }
    }

    // PUSH local-only expenses
    const localExpenses = await db.select<{ id: number; fiscal_year: number; title: string; category: string; amount: number; date: string; description: string; supplier: string; invoice_path: string | null; linked_intervenant_id: string | null }[]>(
      `SELECT id, fiscal_year, title, category, amount, date, description, supplier, invoice_path, linked_intervenant_id FROM expenses WHERE synced_from = '' OR synced_from IS NULL`, []
    );
    for (const e of localExpenses) {
      try {
        const docData: Record<string, unknown> = {
          fiscal_year: e.fiscal_year, title: e.title, category: e.category,
          amount: e.amount, date: e.date, description: e.description,
          supplier: e.supplier, invoice_path: e.invoice_path,
          linked_intervenant_id: e.linked_intervenant_id,
          created_at: Date.now(), updated_at: Date.now(),
        };
        if (auth.currentUser) {
          docData.created_by = { uid: auth.currentUser.uid, email: auth.currentUser.email ?? '' };
        }
        const docRef = await addDoc(collection(firestore, 'animationExpenses'), docData);
        await db.execute(
          `UPDATE expenses SET synced_from='planning-ehpad', last_sync_at=?, external_id=? WHERE id=?`,
          [now, docRef.id, e.id]
        );
        synced++;
      } catch { failed++; }
    }

    await completeSyncLog(logId, synced, failed, 'success');
  } catch (err) {
    await completeSyncLog(logId, synced, failed, 'error', String(err));
    throw err;
  }

  return { synced, failed };
}

// ─── Sync All ────────────────────────────────────────────────

export interface SyncResult {
  module: SyncModule;
  synced: number;
  failed: number;
  error?: string;
}

export async function syncAll(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const { module, fn } of [
    { module: 'activities' as SyncModule, fn: syncActivities },
    { module: 'inventory' as SyncModule, fn: syncInventory },
    { module: 'staff' as SyncModule, fn: syncStaff },
    { module: 'budget' as SyncModule, fn: syncBudget },
  ]) {
    try {
      const result = await fn();
      results.push({ module, ...result });
    } catch (err) {
      results.push({ module, synced: 0, failed: 0, error: String(err) });
    }
  }

  return results;
}

// ─── Auto-sync check ─────────────────────────────────────────

export async function shouldAutoSync(): Promise<boolean> {
  const enabled = await getSetting('sync_auto_enabled').catch(() => 'true');
  return enabled === 'true' && auth.currentUser !== null;
}
