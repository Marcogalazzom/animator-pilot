import { useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useSyncStore } from '@/stores/syncStore';
import type { SyncModule } from '@/db/types';

// ─── Global sync badge (for Header) ─────────────────────────

export function SyncBadge() {
  const globalStatus = useSyncStore((s) => s.globalStatus);
  const syncAll = useSyncStore((s) => s.syncAllModules);
  const loadLast = useSyncStore((s) => s.loadLastSyncTimes);
  const startAuto = useSyncStore((s) => s.startAutoSync);

  // Load last sync times on mount and start auto-sync
  useEffect(() => {
    loadLast();
    startAuto(15);
    return () => useSyncStore.getState().stopAutoSync();
  }, [loadLast, startAuto]);

  const isSyncing = globalStatus === 'syncing';

  return (
    <button
      onClick={() => syncAll()}
      disabled={isSyncing}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
      style={{
        color: globalStatus === 'error' ? 'var(--color-danger)'
          : globalStatus === 'success' ? 'var(--color-success)'
          : 'var(--color-text-secondary)',
        position: 'relative',
      }}
      aria-label="Synchroniser avec planning-ehpad"
      title={isSyncing ? 'Synchronisation en cours...' : 'Synchroniser avec planning-ehpad'}
    >
      {isSyncing ? (
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <RefreshCw size={16} />
      )}
    </button>
  );
}

// ─── Per-module sync button (for pages) ──────────────────────

interface SyncButtonProps {
  module: SyncModule;
  label?: string;
}

export function SyncButton({ module, label = 'Synchroniser' }: SyncButtonProps) {
  const moduleState = useSyncStore((s) => s.modules[module]);
  const syncModule = useSyncStore((s) => s.syncModule);

  const isSyncing = moduleState.status === 'syncing';

  return (
    <button
      onClick={() => syncModule(module)}
      disabled={isSyncing}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        backgroundColor: 'transparent',
        color: isSyncing ? 'var(--color-text-secondary)' : 'var(--color-primary)',
        border: `1.5px solid ${isSyncing ? 'var(--color-border)' : 'var(--color-primary)'}`,
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        cursor: isSyncing ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: isSyncing ? 0.7 : 1,
      }}
      title={moduleState.lastSyncAt
        ? `Dernière sync : ${new Date(moduleState.lastSyncAt).toLocaleString('fr-FR')}`
        : 'Jamais synchronisé'}
    >
      {isSyncing ? (
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
      ) : moduleState.status === 'success' ? (
        <CheckCircle2 size={14} />
      ) : moduleState.status === 'error' ? (
        <AlertTriangle size={14} />
      ) : (
        <RefreshCw size={14} />
      )}
      {isSyncing ? 'Sync en cours...' : label}
    </button>
  );
}

// ─── Sync status line (last sync info) ───────────────────────

export function SyncStatus({ module }: { module: SyncModule }) {
  const moduleState = useSyncStore((s) => s.modules[module]);

  if (!moduleState.lastSyncAt && moduleState.status === 'idle') {
    return (
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
        Non synchronisé
      </span>
    );
  }

  if (moduleState.status === 'error' && moduleState.lastResult?.error) {
    return (
      <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}>
        Erreur : {moduleState.lastResult.error.substring(0, 60)}
      </span>
    );
  }

  if (moduleState.lastSyncAt) {
    const dt = new Date(moduleState.lastSyncAt);
    const timeStr = dt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const result = moduleState.lastResult;
    return (
      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>
        Sync {timeStr}
        {result && result.synced > 0 && ` — ${result.synced} mis à jour`}
      </span>
    );
  }

  return null;
}
