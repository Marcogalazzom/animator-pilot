/**
 * Sync Service — synchronises Activities, Inventory and Staff
 * with the external planning-ehpad API.
 *
 * API contract (planning-ehpad exposes):
 *   GET  /api/activities   → Activity[]
 *   GET  /api/inventory    → InventoryItem[]
 *   GET  /api/staff        → StaffMember[]
 *   POST /api/activities   → push local changes
 *   POST /api/inventory    → push local changes
 *
 * Each endpoint accepts ?since=ISO_DATE for incremental sync.
 */

import { getSetting } from '@/db/settings';
import { getDb } from '@/db/database';
import { createSyncLog, completeSyncLog, getLastSync } from '@/db/sync';
import type { Activity, InventoryItem, StaffMember, SyncModule } from '@/db/types';

// ─── Types for API responses ─────────────────────────────────

interface ApiActivity {
  id: string;
  title: string;
  activity_type: string;
  description: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  location: string;
  max_participants: number;
  actual_participants: number;
  animator_name: string;
  status: string;
  materials_needed: string;
  notes: string;
}

interface ApiInventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  location: string;
  notes: string;
}

interface ApiStaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  email: string;
  service: string;
  is_available: boolean;
  notes: string;
}

// ─── HTTP helper ─────────────────────────────────────────────

async function getSyncConfig(): Promise<{ url: string; apiKey: string } | null> {
  const url = await getSetting('sync_url').catch(() => null);
  const apiKey = await getSetting('sync_api_key').catch(() => null);
  if (!url) return null;
  return { url: url.replace(/\/$/, ''), apiKey: apiKey ?? '' };
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const config = await getSyncConfig();
  if (!config) throw new Error('URL de synchronisation non configurée');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.url}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!response.ok) {
    throw new Error(`Erreur API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ─── Sync Activities ─────────────────────────────────────────

export async function syncActivities(): Promise<{ synced: number; failed: number }> {
  const logId = await createSyncLog('activities', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSync = await getLastSync('activities');
    const since = lastSync?.finished_at ?? '';
    const query = since ? `?since=${encodeURIComponent(since)}` : '';

    const remoteActivities = await apiFetch<ApiActivity[]>(`/api/activities${query}`);
    const db = await getDb();
    const now = new Date().toISOString();

    for (const remote of remoteActivities) {
      try {
        // Check if already exists by external_id
        const existing = await db.select<{ id: number }[]>(
          `SELECT id FROM activities WHERE external_id = ?`,
          [remote.id]
        );

        if (existing.length > 0) {
          // Update existing
          await db.execute(
            `UPDATE activities SET title=?, activity_type=?, description=?, date=?, time_start=?,
             time_end=?, location=?, max_participants=?, actual_participants=?, animator_name=?,
             status=?, materials_needed=?, notes=?, synced_from='planning-ehpad', last_sync_at=?
             WHERE external_id = ?`,
            [
              remote.title, remote.activity_type, remote.description, remote.date,
              remote.time_start, remote.time_end, remote.location, remote.max_participants,
              remote.actual_participants, remote.animator_name, remote.status,
              remote.materials_needed, remote.notes, now, remote.id,
            ]
          );
        } else {
          // Insert new
          await db.execute(
            `INSERT INTO activities (title, activity_type, description, date, time_start, time_end,
             location, max_participants, actual_participants, animator_name, status, materials_needed,
             notes, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [
              remote.title, remote.activity_type, remote.description, remote.date,
              remote.time_start, remote.time_end, remote.location, remote.max_participants,
              remote.actual_participants, remote.animator_name, remote.status,
              remote.materials_needed, remote.notes, now, remote.id,
            ]
          );
        }
        synced++;
      } catch {
        failed++;
      }
    }

    // Also push local activities that are NOT synced (created locally)
    const localOnly = await db.select<Activity[]>(
      `SELECT * FROM activities WHERE synced_from = '' OR synced_from IS NULL`,
      []
    );

    if (localOnly.length > 0) {
      try {
        await apiFetch('/api/activities', {
          method: 'POST',
          body: JSON.stringify(localOnly.map(a => ({
            title: a.title,
            activity_type: a.activity_type,
            description: a.description,
            date: a.date,
            time_start: a.time_start,
            time_end: a.time_end,
            location: a.location,
            max_participants: a.max_participants,
            actual_participants: a.actual_participants,
            animator_name: a.animator_name,
            status: a.status,
            materials_needed: a.materials_needed,
            notes: a.notes,
          }))),
        });
        // Mark them as synced
        for (const a of localOnly) {
          await db.execute(
            `UPDATE activities SET synced_from = 'planning-ehpad', last_sync_at = ? WHERE id = ?`,
            [now, a.id]
          );
        }
      } catch {
        // Push failed, not critical
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
  const logId = await createSyncLog('inventory', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSync = await getLastSync('inventory');
    const since = lastSync?.finished_at ?? '';
    const query = since ? `?since=${encodeURIComponent(since)}` : '';

    const remoteItems = await apiFetch<ApiInventoryItem[]>(`/api/inventory${query}`);
    const db = await getDb();
    const now = new Date().toISOString();

    for (const remote of remoteItems) {
      try {
        const existing = await db.select<{ id: number }[]>(
          `SELECT id FROM inventory WHERE external_id = ?`,
          [remote.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE inventory SET name=?, category=?, quantity=?, condition=?, location=?,
             notes=?, synced_from='planning-ehpad', last_sync_at=? WHERE external_id = ?`,
            [remote.name, remote.category, remote.quantity, remote.condition, remote.location, remote.notes, now, remote.id]
          );
        } else {
          await db.execute(
            `INSERT INTO inventory (name, category, quantity, condition, location, notes, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [remote.name, remote.category, remote.quantity, remote.condition, remote.location, remote.notes, now, remote.id]
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

// ─── Sync Staff ──────────────────────────────────────────────

export async function syncStaff(): Promise<{ synced: number; failed: number }> {
  const logId = await createSyncLog('staff', 'pull');
  let synced = 0;
  let failed = 0;

  try {
    const lastSync = await getLastSync('staff');
    const since = lastSync?.finished_at ?? '';
    const query = since ? `?since=${encodeURIComponent(since)}` : '';

    const remoteMembers = await apiFetch<ApiStaffMember[]>(`/api/staff${query}`);
    const db = await getDb();
    const now = new Date().toISOString();

    for (const remote of remoteMembers) {
      try {
        const existing = await db.select<{ id: number }[]>(
          `SELECT id FROM staff WHERE external_id = ?`,
          [remote.id]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE staff SET first_name=?, last_name=?, role=?, phone=?, email=?,
             service=?, is_available=?, notes=?, synced_from='planning-ehpad', last_sync_at=?
             WHERE external_id = ?`,
            [
              remote.first_name, remote.last_name, remote.role, remote.phone, remote.email,
              remote.service, remote.is_available ? 1 : 0, remote.notes, now, remote.id,
            ]
          );
        } else {
          await db.execute(
            `INSERT INTO staff (first_name, last_name, role, phone, email, service, is_available, notes, synced_from, last_sync_at, external_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planning-ehpad', ?, ?)`,
            [
              remote.first_name, remote.last_name, remote.role, remote.phone, remote.email,
              remote.service, remote.is_available ? 1 : 0, remote.notes, now, remote.id,
            ]
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

  for (const syncFn of [
    { module: 'activities' as SyncModule, fn: syncActivities },
    { module: 'inventory' as SyncModule, fn: syncInventory },
    { module: 'staff' as SyncModule, fn: syncStaff },
  ]) {
    try {
      const result = await syncFn.fn();
      results.push({ module: syncFn.module, ...result });
    } catch (err) {
      results.push({ module: syncFn.module, synced: 0, failed: 0, error: String(err) });
    }
  }

  return results;
}

// ─── Auto-sync check ─────────────────────────────────────────

export async function shouldAutoSync(): Promise<boolean> {
  const enabled = await getSetting('sync_auto_enabled').catch(() => 'true');
  const url = await getSetting('sync_url').catch(() => '');
  return enabled === 'true' && !!url;
}
