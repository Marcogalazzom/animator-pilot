import { useState, useEffect, useCallback } from 'react';
import {
  Database, Info, RefreshCw,
  Save, CheckCircle2, HardDrive, Globe, LogIn, LogOut, Download, Eye, User as UserIcon,
  FlaskConical, Trash2, AlertTriangle, Layers, Plus, X, Upload, Package,
} from 'lucide-react';
import { getResidenceUnits, setResidenceUnits } from '@/db/settings';
import { buildExportBundle } from '@/utils/exportBundle';
import { importBundle, type ImportSummary } from '@/utils/importBundle';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { useUserSettings, setUserSettings, useUserSettingsLoaded } from '@/hooks/useUserSettings';
import {
  seedDemoData, clearAllData,
  countRemoteDemoRows, cleanupDemoFromFirestore, sweepRemoteDemoFirestore,
  type SeedCounts,
} from '@/utils/demoData';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { useActivityViewMode, type ActivityViewMode } from '@/hooks/useActivityViewMode';
import { getSetting, setSetting } from '@/db';
import { getDb } from '@/db/database';
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from '@/services/firebase';
import { checkForAppUpdate, downloadAndInstall, currentVersion, type UpdateInfo } from '@/utils/updater';

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
  const addToast = useToastStore((s) => s.add);

  const syncAllModules = useSyncStore((s) => s.syncAllModules);
  const syncActivitiesFull = useSyncStore((s) => s.syncActivitiesFull);
  const activitiesSyncStatus = useSyncStore((s) => s.modules.activities.status);
  const globalSyncStatus = useSyncStore((s) => s.globalStatus);

  const handleFullImport = useCallback(async () => {
    const confirmed = window.confirm(
      "Import complet des activités : tire toutes les semaines passées depuis planning-ehpad. Cette opération peut être longue. Continuer ?",
    );
    if (!confirmed) return;
    await syncActivitiesFull();
    const result = useSyncStore.getState().modules.activities.lastResult;
    if (result?.error) {
      addToast(`Import échoué : ${result.error.slice(0, 80)}`, 'error');
    } else {
      addToast(`Import complet : ${result?.synced ?? 0} activités importées`, 'success');
    }
  }, [syncActivitiesFull, addToast]);

  const [activityViewMode, setActivityViewMode] = useActivityViewMode();
  const handleViewModeChange = (m: ActivityViewMode) => {
    setActivityViewMode(m);
    addToast(m === 'pasa' ? 'Vue PASA activée' : 'Vue Animations activée', 'success');
  };

  // Settings state
  const [syncEmail, setSyncEmail]         = useState('');
  const [syncPassword, setSyncPassword]   = useState('');
  const [syncAutoEnabled, setSyncAutoEnabled] = useState(true);
  const [syncInterval, setSyncInterval]   = useState('15');
  const [firebaseUser, setFirebaseUser]   = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading]     = useState(false);
  const [dbStats, setDbStats]             = useState<DbStats>({ projects: 0, activities: 0, residents: 0, albums: 0, inventory: 0 });
  const [loading, setLoading]             = useState(true);
  const [appVersion, setAppVersion]       = useState<string>('…');
  const [updateCheck, setUpdateCheck]     = useState<UpdateInfo | null | 'checking'>(null);
  const [installing, setInstalling]       = useState(false);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return unsubscribe;
  }, []);

  // Load app version once
  useEffect(() => {
    currentVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateCheck('checking');
    const result = await checkForAppUpdate();
    setUpdateCheck(result);
    if (result === null) {
      addToast('Vérification impossible (pas de réseau ou config)', 'error');
    } else if (!result.available) {
      addToast("L'application est à jour", 'success');
    }
  }, [addToast]);

  const handleInstallFromSettings = useCallback(async () => {
    if (updateCheck && updateCheck !== 'checking' && updateCheck.available) {
      setInstalling(true);
      try {
        await downloadAndInstall(updateCheck.update);
      } catch (err) {
        addToast(`Erreur installation : ${String(err).slice(0, 80)}`, 'error');
        setInstalling(false);
      }
    }
  }, [updateCheck, addToast]);

  // Load settings
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sEmail, sAuto, sInt] = await Promise.all([
          getSetting('sync_email').catch(() => null),
          getSetting('sync_auto_enabled').catch(() => null),
          getSetting('sync_interval_minutes').catch(() => null),
        ]);
        if (cancelled) return;
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

  // Sync des préférences planning-ehpad à chaque changement
  useEffect(() => {
    setSetting('sync_email', syncEmail).catch(() => {});
    setSetting('sync_auto_enabled', syncAutoEnabled ? 'true' : 'false').catch(() => {});
    setSetting('sync_interval_minutes', syncInterval).catch(() => {});
  }, [syncEmail, syncAutoEnabled, syncInterval]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820, animation: 'slide-in 0.22s ease-out' }}>
      <div className="eyebrow">
        Configuration de l'application
      </div>

      <IdentitySection />

      <ResidenceUnitsSection />

      <BackupSection />

      <DemoDataSection />

      {/* Activity view mode section */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Eye size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            Affichage des activités
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Choisissez quelles activités sont visibles partout dans l'application (page Activités, Calendrier, Tableau de bord).
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([
              { value: 'animations', label: 'Animations', hint: 'Masque les activités PASA' },
              { value: 'pasa',       label: 'PASA',       hint: 'Affiche uniquement les activités PASA' },
            ] as const).map(({ value, label, hint }) => {
              const active = activityViewMode === value;
              return (
                <button
                  key={value}
                  onClick={() => handleViewModeChange(value)}
                  aria-pressed={active}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                    padding: '10px 14px', borderRadius: '6px',
                    border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: active ? 'rgba(124,58,237,0.06)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    fontFamily: 'var(--font-sans)', cursor: 'pointer', minWidth: '160px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{hint}</span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Préférence enregistrée localement sur cet appareil.
          </p>
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
            « Sync maintenant » et la sync automatique ne tirent que la <strong>semaine courante et les suivantes</strong>.
            Les activités personnelles (réunions, RDV) restent locales.
          </p>

          {/* Import complet — pour récupérer l'historique */}
          <div style={{
            marginTop: '4px', padding: '12px 14px', borderRadius: '8px',
            background: 'var(--color-bg-soft)', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <HardDrive size={14} style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                  Import complet des activités
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  Rapatrie toutes les activités passées de planning-ehpad. À utiliser pour initialiser ou combler un historique manquant.
                </p>
              </div>
              <button
                onClick={handleFullImport}
                disabled={activitiesSyncStatus === 'syncing' || !firebaseUser}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  border: '1.5px solid #7C3AED', background: 'transparent', color: '#7C3AED',
                  cursor: activitiesSyncStatus === 'syncing' || !firebaseUser ? 'not-allowed' : 'pointer',
                  opacity: activitiesSyncStatus === 'syncing' || !firebaseUser ? 0.5 : 1,
                  whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
                }}
              >
                {activitiesSyncStatus === 'syncing' ? 'Import…' : 'Import complet'}
              </button>
            </div>
          </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
          <p style={{ margin: 0 }}><strong>Pilot Animateur</strong> — Outil de pilotage pour animateurs/trices en EHPAD</p>
          <p style={{ margin: 0 }}>Version <strong style={{ color: 'var(--color-text-primary)' }}>v{appVersion}</strong></p>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <HardDrive size={12} /> Base de données locale SQLite (Tauri)
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleCheckUpdate}
              disabled={updateCheck === 'checking' || installing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: '6px',
                fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)',
                cursor: (updateCheck === 'checking' || installing) ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={12} style={updateCheck === 'checking' ? { animation: 'spin 1s linear infinite' } : {}} />
              {updateCheck === 'checking' ? 'Vérification…' : 'Vérifier les mises à jour'}
            </button>

            {updateCheck && updateCheck !== 'checking' && updateCheck.available && (
              <>
                <span style={{ fontSize: '12px', color: '#7C3AED', fontWeight: 500 }}>
                  Nouvelle version <strong>v{updateCheck.version}</strong> disponible
                </span>
                <button
                  onClick={handleInstallFromSettings}
                  disabled={installing}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', background: '#7C3AED', color: '#fff',
                    border: 'none', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                    cursor: installing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Download size={12} />
                  {installing ? 'Installation…' : 'Installer & redémarrer'}
                </button>
              </>
            )}
            {updateCheck && updateCheck !== 'checking' && !updateCheck.available && (
              <span style={{ fontSize: '12px', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> À jour
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentitySection() {
  const loaded = useUserSettingsLoaded();

  // Ne monte le formulaire qu'une fois la base chargée, sinon la race
  // entre l'initialisation locale et l'arrivée async du load écrase ce
  // que l'utilisateur tape.
  if (!loaded) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <UserIcon size={16} style={{ color: 'var(--terra-deep)' }} />
          <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
            Identité
          </h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Chargement…</div>
      </div>
    );
  }
  return <IdentitySectionForm />;
}

function IdentitySectionForm() {
  const settings = useUserSettings();
  const addToast = useToastStore((s) => s.add);
  // Initialisation **une seule fois** à partir des valeurs chargées —
  // plus de useEffect([settings]) qui pourrait écraser les saisies.
  const [first, setFirst]   = useState(settings.user_first_name);
  const [last, setLast]     = useState(settings.user_last_name);
  const [role, setRole]     = useState(settings.user_role);
  const [resName, setResName] = useState(settings.residence_name);
  const [resKind, setResKind] = useState(settings.residence_kind);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setUserSettings({
        user_first_name: first,
        user_last_name: last,
        user_role: role,
        residence_name: resName,
        residence_kind: resKind,
      });
      addToast('Identité mise à jour', 'success');
    } catch {
      addToast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', marginTop: 4,
    border: '1px solid var(--line)', borderRadius: 8, fontSize: 13,
    background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <UserIcon size={16} style={{ color: 'var(--terra-deep)' }} />
        <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
          Identité
        </h2>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Prénom</div>
            <input value={first} onChange={(e) => setFirst(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Nom</div>
            <input value={last} onChange={(e) => setLast(e.target.value)} style={inputStyle} />
          </label>
        </div>
        <label>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Rôle</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Animatrice" style={inputStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <label>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Nom de la résidence</div>
            <input value={resName} onChange={(e) => setResName(e.target.value)} style={inputStyle} />
          </label>
          <label>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Type</div>
            <select value={resKind} onChange={(e) => setResKind(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}>
              <option>EHPAD</option>
              <option>Résidence services</option>
              <option>Résidence autonomie</option>
              <option>USLD</option>
              <option>Autre</option>
            </select>
          </label>
        </div>
        <button onClick={save} disabled={saving} className="btn primary" style={{ width: 'fit-content' }}>
          {saving ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function BackupSection() {
  const addToast = useToastStore((s) => s.add);
  const [busy, setBusy] = useState<'' | 'export' | 'import'>('');
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    if (busy) return;
    setBusy('export');
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const targetPath = await saveDialog({
        defaultPath: `animator-pilot-sauvegarde-${stamp}.json`,
        filters: [{ name: 'Sauvegarde Animator Pilot', extensions: ['json'] }],
      });
      if (!targetPath) { setBusy(''); return; }
      const json = await buildExportBundle();
      await writeTextFile(targetPath, json);
      addToast('Sauvegarde exportée', 'success');
    } catch (err) {
      console.error('[export] failed:', err);
      addToast("Erreur lors de l'export", 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleImport() {
    if (busy) return;
    setBusy('import');
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: 'Sauvegarde Animator Pilot', extensions: ['json'] }],
      });
      if (!picked || typeof picked !== 'string') { setBusy(''); return; }
      if (!confirm(
        'Importer cette sauvegarde ? Les données existantes seront conservées, les données du fichier seront ajoutées.'
      )) { setBusy(''); return; }
      const json = await readTextFile(picked);
      const summary = await importBundle(json);
      setLastSummary(summary);
      if (summary.errors.length > 0) {
        addToast(summary.errors[0], 'error');
      } else {
        const total =
          summary.residents + summary.activities + summary.albums + summary.photos +
          summary.projects + summary.actions + summary.budgets + summary.expenses +
          summary.upcomingExpenses + summary.journalEntries + summary.staff + summary.suppliers;
        addToast(`${total} élément${total > 1 ? 's' : ''} ajouté${total > 1 ? 's' : ''}`, 'success');
      }
    } catch (err) {
      console.error('[import] failed:', err);
      addToast("Erreur lors de l'import", 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Package size={16} style={{ color: 'var(--terra-deep)' }} />
        <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
          Export / Import
        </h2>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-3)' }}>
        Sauvegardez toutes les données (résidents, activités, photos, projets, budget, carnet de bord, annuaire, fournisseurs) dans un fichier unique transportable sur clé USB. L'import <strong>ajoute</strong> les données à l'existant sans rien écraser.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn"
          onClick={handleExport}
          disabled={busy !== ''}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Download size={13} /> {busy === 'export' ? 'Export…' : 'Exporter toutes les données'}
        </button>
        <button
          className="btn primary"
          onClick={handleImport}
          disabled={busy !== ''}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Upload size={13} /> {busy === 'import' ? 'Import…' : 'Importer depuis une sauvegarde'}
        </button>
      </div>

      {lastSummary && (
        <div style={{
          marginTop: 14, padding: 12, borderRadius: 8,
          background: 'var(--surface-2)', fontSize: 12.5, lineHeight: 1.7,
          color: 'var(--ink-2)', fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>
            Dernier import
          </div>
          <div>résidents : {lastSummary.residents} · activités : {lastSummary.activities} · albums : {lastSummary.albums} · photos : {lastSummary.photos}</div>
          <div>projets : {lastSummary.projects} · actions : {lastSummary.actions} · budgets : {lastSummary.budgets} · dépenses : {lastSummary.expenses}</div>
          <div>prévisions : {lastSummary.upcomingExpenses} · notes : {lastSummary.journalEntries} · staff : {lastSummary.staff} · fournisseurs : {lastSummary.suppliers}</div>
          {lastSummary.skipped > 0 && (
            <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>
              {lastSummary.skipped} ligne{lastSummary.skipped > 1 ? 's' : ''} ignorée{lastSummary.skipped > 1 ? 's' : ''} (doublons FK ou année déjà présente)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResidenceUnitsSection() {
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUnit, setNewUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const addToast = useToastStore((s) => s.add);

  useEffect(() => {
    getResidenceUnits()
      .then(setUnits)
      .catch(() => setUnits([]))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: string[]) {
    setUnits(next);
    setBusy(true);
    try {
      await setResidenceUnits(next);
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const v = newUnit.trim();
    if (!v || units.some((u) => u.toLowerCase() === v.toLowerCase())) {
      setNewUnit('');
      return;
    }
    await persist([...units, v]);
    setNewUnit('');
    addToast('Unité ajoutée', 'success');
  }

  async function handleRemove(unit: string) {
    if (!confirm(`Supprimer l'unité « ${unit} » ? Les résidents rattachés seront désaffectés côté liste, leur fiche reste intacte.`)) return;
    await persist(units.filter((u) => u !== unit));
    addToast('Unité supprimée', 'success');
  }

  async function handleRename(oldName: string) {
    const next = prompt(`Renommer « ${oldName} » :`, oldName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === oldName) return;
    if (units.some((u) => u.toLowerCase() === trimmed.toLowerCase() && u !== oldName)) {
      addToast('Une unité avec ce nom existe déjà', 'error');
      return;
    }
    await persist(units.map((u) => (u === oldName ? trimmed : u)));
    addToast('Unité renommée', 'success');
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)', borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Layers size={16} style={{ color: 'var(--color-primary)' }} />
        <h2 style={{
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
          color: 'var(--color-text-primary)', margin: 0,
        }}>
          Unités / étages
        </h2>
      </div>

      <p style={{
        margin: '0 0 14px', fontSize: '12px', color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-sans)',
      }}>
        Liste des étages et unités (ex. UPG Bastille). Utilisée comme filtre dans la page Résidents et comme champ dans la fiche résident.
      </p>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {units.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                Aucune unité. Ajoutez-en ci-dessous.
              </div>
            ) : units.map((u) => (
              <div
                key={u}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--line)',
                }}
              >
                <Layers size={13} style={{ color: 'var(--ink-3)' }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{u}</span>
                <button
                  className="btn ghost sm"
                  onClick={() => handleRename(u)}
                  disabled={busy}
                  style={{ padding: '4px 8px' }}
                >
                  Renommer
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => handleRemove(u)}
                  disabled={busy}
                  style={{ padding: '4px 8px', color: 'var(--danger)' }}
                  title="Supprimer"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Nouvelle unité (ex. Étage 3)"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              style={{
                flex: 1, padding: '8px 10px',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: 13, fontFamily: 'var(--font-sans)',
              }}
            />
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={busy || !newUnit.trim()}
              style={{ opacity: busy || !newUnit.trim() ? 0.5 : 1 }}
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DemoDataSection() {
  const addToast = useToastStore((s) => s.add);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [lastSeed, setLastSeed] = useState<SeedCounts | null>(null);
  const [remoteCount, setRemoteCount] = useState<{ activities: number; expenses: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaningRemote, setCleaningRemote] = useState(false);

  // Auto-detect remote demo data on mount so the user immediately sees if there's
  // a mess to clean up.
  useEffect(() => {
    countRemoteDemoRows().then(setRemoteCount).catch(() => {});
  }, []);

  async function handleSeed() {
    if (seeding) return;
    setSeeding(true);
    try {
      const counts = await seedDemoData();
      setLastSeed(counts);
      addToast(
        `Démo chargée : ${counts.residents} résidents, ${counts.activities} activités, ${counts.journal} notes…`,
        'success',
      );
    } catch (err) {
      console.error('[demo] seed failed:', err);
      addToast(`Erreur au chargement : ${String(err).slice(0, 80)}`, 'error');
    } finally {
      setSeeding(false);
    }
  }

  async function handleClear() {
    if (clearing) return;
    if (confirmText !== 'EFFACER') return;
    setClearing(true);
    try {
      await clearAllData();
      addToast('Toutes les données utilisateur ont été effacées.', 'success');
      setConfirmClear(false);
      setConfirmText('');
      setLastSeed(null);
    } catch (err) {
      console.error('[demo] clear failed:', err);
      addToast(`Erreur lors de l'effacement : ${String(err).slice(0, 80)}`, 'error');
    } finally {
      setClearing(false);
    }
  }

  async function handleScanRemote() {
    setScanning(true);
    try {
      const c = await countRemoteDemoRows();
      setRemoteCount(c);
      if (c.activities === 0 && c.expenses === 0) {
        addToast('Aucune donnée de démo détectée sur le planning distant.', 'info');
      } else {
        addToast(`${c.activities} activité(s) + ${c.expenses} dépense(s) à nettoyer.`, 'info');
      }
    } finally {
      setScanning(false);
    }
  }

  async function handleCleanRemote() {
    if (cleaningRemote) return;
    if (!window.confirm(
      `Cette action va supprimer définitivement les données de démo qui ont été synchronisées sur planning-ehpad. Continuer ?`,
    )) return;
    setCleaningRemote(true);
    try {
      const r = await cleanupDemoFromFirestore();
      // Best-effort sweep for orphan Firestore docs (no local row).
      const sweep = await sweepRemoteDemoFirestore().catch(() => ({ activitiesDeleted: 0 }));
      addToast(
        `Nettoyage : ${r.activitiesDeleted + sweep.activitiesDeleted} activité(s) + ${r.expensesDeleted} dépense(s) supprimée(s) du planning distant.`,
        'success',
      );
      setRemoteCount({ activities: 0, expenses: 0 });
    } catch (err) {
      console.error('[demo] remote cleanup failed:', err);
      addToast(`Erreur nettoyage distant : ${String(err).slice(0, 80)}`, 'error');
    } finally {
      setCleaningRemote(false);
    }
  }

  const hasRemoteJunk = remoteCount !== null && (remoteCount.activities > 0 || remoteCount.expenses > 0);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FlaskConical size={16} style={{ color: 'var(--terra-deep)' }} />
        <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
          Données de démo
        </h2>
      </div>

      <p style={{
        margin: '0 0 12px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55,
      }}>
        Charge un jeu de données complet pour tester toutes les fonctionnalités :
        18 résidents répartis sur les 4 unités (étages + UPG), 25 activités,
        20 notes de journal (avec titres, heures, auteurs, catégories), 6 projets
        avec leurs étapes, budget annuel 15 000 € + limites par catégorie,
        15 dépenses, 8 prévisions (récurrentes + ponctuelles), 6 albums photos
        dont le Famileo du mois, 10 membres d'équipe, 12 fournisseurs.
      </p>

      <div style={{
        margin: '0 0 16px', padding: '8px 12px', borderRadius: 8,
        background: 'var(--sage-soft)', border: '1px solid var(--sage-soft)',
        fontSize: 12, color: 'var(--sage-deep)',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Les nouvelles données de démo sont marquées <code>synced_from='demo'</code> : elles
          <strong> ne sont jamais poussées</strong> sur le planning distant.
        </span>
      </div>

      {hasRemoteJunk && (
        <div style={{
          margin: '0 0 16px', padding: 14, borderRadius: 10,
          background: 'var(--warn-soft)', border: '1px solid var(--warn)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={16} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warn)', marginBottom: 4 }}>
                Données de démo détectées sur planning-ehpad
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5 }}>
                Une ancienne démo a été synchronisée à distance :{' '}
                <strong>{remoteCount?.activities} activité(s)</strong> et{' '}
                <strong>{remoteCount?.expenses} dépense(s)</strong>. Le bouton ci-dessous les
                supprime du planning distant et localement, en se basant sur les titres de la démo.
              </p>
              <button
                onClick={handleCleanRemote}
                disabled={cleaningRemote}
                className="btn primary sm"
                style={{
                  background: 'var(--warn)', borderColor: 'var(--warn)',
                  opacity: cleaningRemote ? 0.6 : 1,
                }}
              >
                <Trash2 size={12} />
                {cleaningRemote ? 'Nettoyage en cours…' : 'Nettoyer le planning distant'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          onClick={handleSeed}
          disabled={seeding}
          style={{ opacity: seeding ? 0.6 : 1 }}
        >
          <FlaskConical size={13} />
          {seeding ? 'Chargement…' : 'Charger des données de démo'}
        </button>

        <button
          className="btn"
          onClick={handleScanRemote}
          disabled={scanning}
          style={{ opacity: scanning ? 0.6 : 1 }}
        >
          <RefreshCw size={13} />
          {scanning ? 'Vérification…' : 'Vérifier le planning distant'}
        </button>

        {!confirmClear ? (
          <button
            className="btn"
            onClick={() => setConfirmClear(true)}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
          >
            <Trash2 size={13} /> Effacer toutes les données
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 999,
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
          }}>
            <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Tape EFFACER pour confirmer"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12.5, color: 'var(--danger)', minWidth: 200,
                fontWeight: 600,
              }}
            />
            <button
              onClick={handleClear}
              disabled={confirmText !== 'EFFACER' || clearing}
              className="btn sm"
              style={{
                background: confirmText === 'EFFACER' ? 'var(--danger)' : 'transparent',
                color: confirmText === 'EFFACER' ? '#fff' : 'var(--danger)',
                border: '1px solid var(--danger)',
                opacity: clearing ? 0.6 : 1,
              }}
            >
              {clearing ? 'Effacement…' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setConfirmClear(false); setConfirmText(''); }}
              className="btn ghost sm"
              style={{ color: 'var(--ink-3)' }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {lastSeed && (
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 10,
          background: 'var(--sage-soft)',
          border: '1px solid var(--sage-soft)',
          display: 'grid', gap: 4,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          fontSize: 12, color: 'var(--sage-deep)',
        }}>
          {([
            ['Résidents',     lastSeed.residents],
            ['Activités',     lastSeed.activities],
            ['Carnet (entrées)', lastSeed.journal],
            ['Projets',       lastSeed.projects],
            ['Dépenses',      lastSeed.expenses],
            ['Rendez-vous',   lastSeed.appointments],
            ['Albums',        lastSeed.albums],
            ['Inventaire',    lastSeed.inventory],
            ['Annuaire',      lastSeed.staff],
            ['Fournisseurs',  lastSeed.suppliers],
          ] as Array<[string, number]>).map(([label, n]) => (
            <div key={label}>
              <span className="num" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+{n}</span>
              {' '}<span style={{ opacity: 0.85 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{
        margin: '14px 0 0', fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic',
      }}>
        L'identité (Marie Coste / Les Glycines) reste préservée. Le bouton « Effacer » ne touche pas aux paramètres
        ni aux logs de synchronisation, uniquement aux données utilisateur (résidents, activités, journal, projets, etc.).
      </p>
    </div>
  );
}
