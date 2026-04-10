import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Database, Info, RefreshCw,
  Save, CheckCircle2, HardDrive, Globe, LogIn, LogOut,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { getSetting, setSetting } from '@/db';
import { getDb } from '@/db/database';
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from '@/services/firebase';

// ─── Types ────────────────────────────────────────────────────

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
  const [syncEmail, setSyncEmail]         = useState('');
  const [syncPassword, setSyncPassword]   = useState('');
  const [syncAutoEnabled, setSyncAutoEnabled] = useState(true);
  const [syncInterval, setSyncInterval]   = useState('15');
  const [firebaseUser, setFirebaseUser]   = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading]     = useState(false);
  const [dbStats, setDbStats]             = useState<DbStats>({ projects: 0, activities: 0, residents: 0, albums: 0, inventory: 0 });
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return unsubscribe;
  }, []);

  // Load settings
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [etab, anim, sEmail, sAuto, sInt] = await Promise.all([
          getSetting('etablissement_name').catch(() => null),
          getSetting('animatrice_name').catch(() => null),
          getSetting('sync_email').catch(() => null),
          getSetting('sync_auto_enabled').catch(() => null),
          getSetting('sync_interval_minutes').catch(() => null),
        ]);
        if (cancelled) return;
        if (etab) setEtablissement(etab);
        if (anim) setAnimatrice(anim);
        if (sEmail) setSyncEmail(sEmail);
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
      await setSetting('sync_email', syncEmail);
      await setSetting('sync_auto_enabled', syncAutoEnabled ? 'true' : 'false');
      await setSetting('sync_interval_minutes', syncInterval);
      addToast('Paramètres enregistrés', 'success');
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }, [etablissement, animatrice, syncEmail, syncAutoEnabled, syncInterval, addToast]);

  const handleFirebaseLogin = useCallback(async () => {
    if (!syncEmail || !syncPassword) {
      addToast('Veuillez entrer email et mot de passe', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, syncEmail, syncPassword);
      setSyncPassword('');
      addToast('Connecté à planning-ehpad', 'success');
    } catch (err) {
      addToast(`Erreur de connexion : ${String(err).replace('FirebaseError: ', '')}`, 'error');
    } finally {
      setAuthLoading(false);
    }
  }, [syncEmail, syncPassword, addToast]);

  const handleFirebaseLogout = useCallback(async () => {
    try {
      await signOut(auth);
      addToast('Déconnecté', 'info');
    } catch {
      addToast('Erreur de déconnexion', 'error');
    }
  }, [addToast]);

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
          {/* Auth status */}
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            backgroundColor: firebaseUser ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
            border: `1px solid ${firebaseUser ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: firebaseUser ? 'var(--color-success)' : 'var(--color-danger)',
            }} />
            <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: firebaseUser ? 'var(--color-success)' : 'var(--color-danger)', flex: 1 }}>
              {firebaseUser ? `Connecté : ${firebaseUser.email}` : 'Non connecté'}
            </span>
            {firebaseUser && (
              <button
                onClick={handleFirebaseLogout}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', background: 'none', border: '1px solid var(--color-border)',
                  borderRadius: '4px', fontSize: '11px', fontWeight: 500, fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text-secondary)', cursor: 'pointer',
                }}
              >
                <LogOut size={11} /> Déconnexion
              </button>
            )}
          </div>

          {/* Login form (hidden when connected) */}
          {!firebaseUser && (
            <>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Email (compte planning-ehpad)
                <input
                  value={syncEmail}
                  onChange={(e) => setSyncEmail(e.target.value)}
                  type="email"
                  placeholder="animatrice@ehpad.fr"
                  style={{
                    width: '100%', padding: '8px 10px', marginTop: '4px',
                    border: '1px solid var(--color-border)', borderRadius: '6px',
                    fontSize: '13px', fontFamily: 'var(--font-sans)',
                  }}
                />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Mot de passe
                <input
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  type="password"
                  placeholder="Mot de passe planning-ehpad"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFirebaseLogin(); }}
                  style={{
                    width: '100%', padding: '8px 10px', marginTop: '4px',
                    border: '1px solid var(--color-border)', borderRadius: '6px',
                    fontSize: '13px', fontFamily: 'var(--font-sans)',
                  }}
                />
              </label>
              <button
                onClick={handleFirebaseLogin}
                disabled={authLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', backgroundColor: '#7C3AED',
                  color: '#fff', border: 'none', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                  cursor: authLoading ? 'not-allowed' : 'pointer', width: 'fit-content',
                  opacity: authLoading ? 0.7 : 1,
                }}
              >
                <LogIn size={14} />
                {authLoading ? 'Connexion...' : 'Se connecter'}
              </button>
            </>
          )}

          {/* Auto-sync settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={syncAutoEnabled}
                onChange={(e) => setSyncAutoEnabled(e.target.checked)}
              />
              Sync automatique
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
            Activités partagées, inventaire et annuaire sont synchronisés avec Firestore (planning-ehpad).
            Les activités personnelles (réunions, RDV) restent locales.
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
