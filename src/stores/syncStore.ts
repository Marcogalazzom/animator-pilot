import { create } from 'zustand';
import type { SyncModule, SyncStatus } from '@/db/types';
import { syncAll, syncActivities, syncInventory, syncStaff, syncBudget, shouldAutoSync } from '@/services/syncService';
import type { SyncResult, ActivitiesSyncScope } from '@/services/syncService';
import { getLastSyncAll } from '@/db/sync';

interface ModuleSyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  lastResult: SyncResult | null;
}

interface SyncState {
  modules: Record<SyncModule, ModuleSyncState>;
  globalStatus: SyncStatus;
  autoSyncTimer: ReturnType<typeof setInterval> | null;

  // Actions
  syncModule: (module: SyncModule) => Promise<void>;
  syncAllModules: () => Promise<void>;
  syncActivitiesFull: () => Promise<void>;
  loadLastSyncTimes: () => Promise<void>;
  startAutoSync: (intervalMinutes?: number) => void;
  stopAutoSync: () => void;
}

const DEFAULT_MODULE_STATE: ModuleSyncState = {
  status: 'idle',
  lastSyncAt: null,
  lastResult: null,
};

export const useSyncStore = create<SyncState>((set, get) => ({
  modules: {
    activities: { ...DEFAULT_MODULE_STATE },
    inventory: { ...DEFAULT_MODULE_STATE },
    staff: { ...DEFAULT_MODULE_STATE },
    budget: { ...DEFAULT_MODULE_STATE },
  },
  globalStatus: 'idle',
  autoSyncTimer: null,

  loadLastSyncTimes: async () => {
    try {
      const lastSyncs = await getLastSyncAll();
      set((state) => ({
        modules: {
          activities: {
            ...state.modules.activities,
            lastSyncAt: lastSyncs.activities?.finished_at ?? null,
          },
          inventory: {
            ...state.modules.inventory,
            lastSyncAt: lastSyncs.inventory?.finished_at ?? null,
          },
          staff: {
            ...state.modules.staff,
            lastSyncAt: lastSyncs.staff?.finished_at ?? null,
          },
          budget: {
            ...state.modules.budget,
            lastSyncAt: lastSyncs.budget?.finished_at ?? null,
          },
        },
      }));
    } catch {
      // ignore
    }
  },

  syncModule: async (module: SyncModule) => {
    set((state) => ({
      modules: {
        ...state.modules,
        [module]: { ...state.modules[module], status: 'syncing' as SyncStatus },
      },
      globalStatus: 'syncing',
    }));

    try {
      const syncFn: () => Promise<{ synced: number; failed: number }> =
        module === 'activities' ? () => syncActivities()
        : module === 'inventory' ? syncInventory
        : module === 'staff' ? syncStaff
        : syncBudget;

      const result = await syncFn();
      const now = new Date().toISOString();

      set((state) => ({
        modules: {
          ...state.modules,
          [module]: {
            status: 'success' as SyncStatus,
            lastSyncAt: now,
            lastResult: { module, ...result },
          },
        },
        globalStatus: 'success',
      }));
    } catch (err) {
      set((state) => ({
        modules: {
          ...state.modules,
          [module]: {
            ...state.modules[module],
            status: 'error' as SyncStatus,
            lastResult: { module, synced: 0, failed: 0, error: String(err) },
          },
        },
        globalStatus: 'error',
      }));
    }
  },

  syncActivitiesFull: async () => {
    set((state) => ({
      modules: {
        ...state.modules,
        activities: { ...state.modules.activities, status: 'syncing' as SyncStatus },
      },
      globalStatus: 'syncing',
    }));

    try {
      const scope: ActivitiesSyncScope = 'full';
      const result = await syncActivities({ scope });
      const now = new Date().toISOString();

      set((state) => ({
        modules: {
          ...state.modules,
          activities: {
            status: 'success' as SyncStatus,
            lastSyncAt: now,
            lastResult: { module: 'activities', ...result },
          },
        },
        globalStatus: 'success',
      }));
    } catch (err) {
      set((state) => ({
        modules: {
          ...state.modules,
          activities: {
            ...state.modules.activities,
            status: 'error' as SyncStatus,
            lastResult: { module: 'activities', synced: 0, failed: 0, error: String(err) },
          },
        },
        globalStatus: 'error',
      }));
    }
  },

  syncAllModules: async () => {
    set({ globalStatus: 'syncing' });

    try {
      const results = await syncAll();
      const now = new Date().toISOString();

      set((state) => {
        const newModules = { ...state.modules };
        for (const r of results) {
          newModules[r.module] = {
            status: r.error ? 'error' : 'success',
            lastSyncAt: r.error ? state.modules[r.module].lastSyncAt : now,
            lastResult: r,
          };
        }
        const hasError = results.some((r) => r.error);
        return {
          modules: newModules,
          globalStatus: hasError ? 'error' : 'success',
        };
      });
    } catch {
      set({ globalStatus: 'error' });
    }
  },

  startAutoSync: (intervalMinutes = 15) => {
    const existing = get().autoSyncTimer;
    if (existing) clearInterval(existing);

    const timer = setInterval(async () => {
      const canSync = await shouldAutoSync().catch(() => false);
      if (canSync) {
        get().syncAllModules();
      }
    }, intervalMinutes * 60 * 1000);

    set({ autoSyncTimer: timer });
  },

  stopAutoSync: () => {
    const timer = get().autoSyncTimer;
    if (timer) clearInterval(timer);
    set({ autoSyncTimer: null });
  },
}));
