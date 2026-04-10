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
  type DocumentData,
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

// ─── Staff role mapping ──────────────────────────────────────

function mapStaffRole(firestoreType: string): string {
  if (firestoreType === 'benevole') return 'benevole';
  if (firestoreType === 'salarie') return 'other';
  if (firestoreType === 'liberal') return 'other';
  return 'other';
}

// ─── Sync Activities ─────────────────────────────────────────

export async function syncActivities(): Promise<{ synced: number; failed: number }> {
  const logId = await createSyncLog('activities', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSyncRecord = await getLastSync('activities');
    const db = await getDb();
    const now = new Date().toISOString();

    // ── PULL from Firestore ──
    const activitiesRef = collection(firestore, 'activities');
    let q;
    if (lastSyncRecord?.finished_at) {
      const sinceMs = new Date(lastSyncRecord.finished_at).getTime();
      q = query(activitiesRef, where('createdAt', '>', sinceMs));
    } else {
      q = query(activitiesRef);
    }

    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
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
    throw new Error('Connexion Firebase requise pour synchroniser l\'inventaire');
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
        const category = data.category ?? 'other';
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
    let q;
    if (lastSyncRecord?.finished_at) {
      // intervenants has updatedAt → use for incremental sync
      const sinceDate = new Date(lastSyncRecord.finished_at);
      q = query(intervenantsRef, where('actif', '==', true), where('updatedAt', '>', sinceDate));
    } else {
      q = query(intervenantsRef, where('actif', '==', true));
    }

    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        const firstName = data.prenom ?? '';
        const lastName = data.nom ?? '';
        const role = mapStaffRole(data.type ?? '');
        const phone = data.tel ?? '';
        const email = data.email ?? '';
        const service = Array.isArray(data.specialites) ? data.specialites.join(', ') : '';
        const isAvailable = data.actif ? 1 : 0;
        const notes = data.notes ?? '';

        const existing = await db.select<{ id: number }[]>(
          'SELECT id FROM staff WHERE external_id = ?',
          [docSnap.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE staff SET first_name=?, last_name=?, role=?, phone=?, email=?,
             service=?, is_available=?, notes=?,
             synced_from='planning-ehpad', last_sync_at=?
             WHERE external_id=?`,
            [firstName, lastName, role, phone, email, service, isAvailable, notes, now, docSnap.id]
          );
        } else {
          await db.execute(
            `INSERT INTO staff (first_name, last_name, role, phone, email, service,
             is_available, notes, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [firstName, lastName, role, phone, email, service, isAvailable, notes, now, docSnap.id]
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
