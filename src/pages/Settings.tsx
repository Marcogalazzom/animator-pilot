import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Database, Info, RefreshCw,
  Save, CheckCircle2, HardDrive, Globe,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { getSetting, setSetting } from '@/db';
import { getDb } from '@/db/database';

// ─── Types ────────────────────────────────────────────────────

type ToastKind = 'success' | 'error';

interface DbStats {
  projects:    number;
  activities:  number;
  residents:   number;
  albums:      number;
  inventory:   number;
}

// ─── Component ────────────────────────────────────────────────

export default function Settings() {
  const addToast = useToastStore((s) => s.addToast);

  const syncAllModules = useSyncStore((s) => s.syncAllModules);
  const globalSyncStatus = useSyncStore((s) => s.globalStatus);

  // Settings state
  const [etablissement, setEtablissement] = useState('Mon EHPAD');
  const [animatrice, setAnimatrice]       = useState('Marie Dupont');
  const [syncUrl, setSyncUrl]             = useState('');
  const [syncApiKey, setSyncApiKey]       = useState('');
  const [syncAutoEnabled, setSyncAutoEnabled] = useState(true);
  const [syncInterval, setSyncInterval]   = useState('15');
  const [dbStats, setDbStats]             = useState<DbStats>({ projects: 0, activities: 0, residents: 0, albums: 0, inventory: 0 });
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  // Load settings
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [etab, anim, sUrl, sKey, sAuto, sInt] = await Promise.all([
          getSetting('etablissement_name').catch(() => null),
          getSetting('animatrice_name').catch(() => null),
          getSetting('sync_url').catch(() => null),
          getSetting('sync_api_key').catch(() => null),
          getSetting('sync_auto_enabled').catch(() => null),
          getSetting('sync_interval_minutes').catch(() => null),
        ]);
        if (cancelled) return;
        if (etab) setEtablissement(etab);
        if (anim) setAnimatrice(anim);
        if (sUrl) setSyncUrl(sUrl);
        if (sKey) setSyncApiKey(sKey);
        if (sAuto !== null) setSyncAutoEnabled(sAuto === 'true');
        if (sInt) setSyncInterval(sInt);

        // DB stats
        const db = await getDb();
        const [projRows, actRows, resRows, albumRows, invRows] = await Promise.all([
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM projects', []).catch(() => [{ cnt: 0 }]),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM activities', []).catch(() => [{ cnt: 0 }]),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM residents', []).catch(() => [{ cnt: 0 }]),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM photo_albums', []).catch(() => [{ cnt: 0 }]),
          db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM inventory', []).catch(() => [{ cnt: 0 }]),
        ]);
        if (cancelled) return;
        setDbStats({
          projects:   projRows[0]?.cnt ?? 0,
          activities: actRows[0]?.cnt ?? 0,
          residents:  resRows[0]?.cnt ?? 0,
          albums:     albumRows[0]?.cnt ?? 0,
          inventory:  invRows[0]?.cnt ?? 0,
        });
      } catch {
        // Use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting('etablissement_name', etablissement);
      await setSetting('animatrice_name', animatrice);
      await setSetting('sync_url', syncUrl);
      await setSetting('sync_api_key', syncApiKey);
      await setSetting('sync_auto_enabled', syncAutoEnabled ? 'true' : 'false');
      await setSetting('sync_interval_minutes', syncInterval);
      addToast('Paramètres enregistrés', 'success');
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }, [etablissement, animatrice, syncUrl, syncApiKey, syncAutoEnabled, syncInterval, addToast]);

  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '200px', height: '28px', borderRadius: '6px', background: 'var(--color-border)' }} className="shimmer" />
        <div style={{ width: '100%', height: '200px', borderRadius: '8px', background: 'var(--color-surface)' }} className="shimmer" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700,
          color: 'var(--color-text-primary)', margin: 0,
        }}>
          Paramètres
        </h1>
        <p style={{
          fontSize: '14px', color: 'var(--color-text-secondary)',
          margin: '4px 0 0', fontFamily: 'var(--font-sans)',
        }}>
          Configuration de l'application
        </p>
      </div>

      {/* Établissement section */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            Établissement
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            Nom de l'établissement
            <input
              value={etablissement}
              onChange={(e) => setEtablissement(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', marginTop: '4px',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}
            />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            Animateur/trice principal(e)
            <input
              value={animatrice}
              onChange={(e) => setAnimatrice(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', marginTop: '4px',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}
            />
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: saving ? 'not-allowed' : 'pointer', width: 'fit-content',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Sync section */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Globe size={16} style={{ color: '#7C3AED' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0, flex: 1,
          }}>
            Synchronisation planning-ehpad
          </h2>
          <button
            onClick={() => syncAllModules()}
            disabled={globalSyncStatus === 'syncing'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', backgroundColor: 'transparent',
              color: globalSyncStatus === 'syncing' ? 'var(--color-text-secondary)' : '#7C3AED',
              border: `1.5px solid ${globalSyncStatus === 'syncing' ? 'var(--color-border)' : '#7C3AED'}`,
              borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: globalSyncStatus === 'syncing' ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={12} style={globalSyncStatus === 'syncing' ? { animation: 'spin 1s linear infinite' } : {}} />
            {globalSyncStatus === 'syncing' ? 'Sync...' : 'Sync maintenant'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            URL de l'API planning-ehpad
            <input
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
              placeholder="https://planning-ehpad.exemple.fr"
              style={{
                width: '100%', padding: '8px 10px', marginTop: '4px',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}
            />
          </label>
          <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
            Clé API (optionnelle)
            <input
              value={syncApiKey}
              onChange={(e) => setSyncApiKey(e.target.value)}
              type="password"
              placeholder="Bearer token"
              style={{
                width: '100%', padding: '8px 10px', marginTop: '4px',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                fontSize: '13px', fontFamily: 'var(--font-sans)',
              }}
            />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={syncAutoEnabled}
                onChange={(e) => setSyncAutoEnabled(e.target.checked)}
              />
              Synchronisation automatique
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
              Intervalle (minutes)
              <input
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                type="number" min="1" max="120"
                style={{
                  width: '100%', padding: '8px 10px', marginTop: '4px',
                  border: '1px solid var(--color-border)', borderRadius: '6px',
                  fontSize: '13px', fontFamily: 'var(--font-sans)',
                }}
              />
            </label>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Les activités, l'inventaire et l'annuaire seront synchronisés depuis le site planning-ehpad.
            Les modifications locales sont aussi poussées vers le site.
          </p>
        </div>
      </div>

      {/* Database stats section */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Database size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            Base de données
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Projets',    value: dbStats.projects },
            { label: 'Activités',  value: dbStats.activities },
            { label: 'Résidents',  value: dbStats.residents },
            { label: 'Albums',     value: dbStats.albums },
            { label: 'Inventaire', value: dbStats.inventory },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
                {value}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* About section */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Info size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            À propos
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
          <p style={{ margin: 0 }}><strong>Pilot Animateur</strong> — Outil de pilotage pour animateurs/trices en EHPAD</p>
          <p style={{ margin: 0 }}>Version 0.1.0</p>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HardDrive size={12} /> Base de données locale SQLite (Tauri)
          </p>
        </div>
      </div>
    </div>
  );
}
