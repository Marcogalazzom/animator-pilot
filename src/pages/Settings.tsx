import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Database, Info, RefreshCw,
  Save, CheckCircle2, HardDrive, Globe, LogIn, LogOut, Download, Eye, Stethoscope, User as UserIcon,
  FlaskConical, Trash2, AlertTriangle,
} from 'lucide-react';
import { useUserSettings, setUserSettings } from '@/hooks/useUserSettings';
import { seedDemoData, clearAllData, type SeedCounts } from '@/utils/demoData';
import { collection, getDocs } from 'firebase/firestore';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { useActivityViewMode, type ActivityViewMode, ACTIVITY_VIEW_MODE_KEY } from '@/hooks/useActivityViewMode';
import { getSetting, setSetting } from '@/db';
import { getDb } from '@/db/database';
import { auth, firestore, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from '@/services/firebase';
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
  const [etablissement, setEtablissement] = useState('');
  const [animatrice, setAnimatrice]       = useState('');
  const [syncEmail, setSyncEmail]         = useState('');
  const [syncPassword, setSyncPassword]   = useState('');
  const [syncAutoEnabled, setSyncAutoEnabled] = useState(true);
  const [syncInterval, setSyncInterval]   = useState('15');
  const [firebaseUser, setFirebaseUser]   = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading]     = useState(false);
  const [dbStats, setDbStats]             = useState<DbStats>({ projects: 0, activities: 0, residents: 0, albums: 0, inventory: 0 });
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [appVersion, setAppVersion]       = useState<string>('…');
  const [updateCheck, setUpdateCheck]     = useState<UpdateInfo | null | 'checking'>(null);
  const [installing, setInstalling]       = useState(false);
  const [diagReport, setDiagReport]       = useState<string>('');
  const [diagRunning, setDiagRunning]     = useState(false);

  const handleRunDiagnostic = useCallback(async () => {
    setDiagRunning(true);
    const lines: string[] = [];
    const push = (s: string) => lines.push(s);
    try {
      push(`App v${appVersion}`);
      push(`Mode: ${localStorage.getItem(ACTIVITY_VIEW_MODE_KEY) ?? '(unset)'} | Firebase: ${auth.currentUser?.email ?? 'NON CONNECTÉ'}`);

      push('\n— Firestore (activities) —');
      try {
        const snap = await getDocs(collection(firestore, 'activities'));
        const docs = snap.docs.map((d) => d.data() as Record<string, unknown>);
        const main = docs.filter((d) => (d.unit ?? 'main') === 'main').length;
        const pasa = docs.filter((d) => d.unit === 'pasa').length;
        const other = docs.length - main - pasa;
        const pasaRec = docs.filter((d) => d.unit === 'pasa' && d.isRecurring === true).length;
        const pasaOneshot = pasa - pasaRec;
        push(`total=${docs.length}  main=${main}  pasa=${pasa}  autre=${other}`);
        push(`pasa récurrents=${pasaRec}  pasa ponctuels=${pasaOneshot}`);
        if (pasa > 0) {
          const sample = docs.find((d) => d.unit === 'pasa');
          push(`ex. PASA: title="${sample?.title}" day=${sample?.day} time=${sample?.time} weekId=${sample?.weekId} recurring=${sample?.isRecurring}`);
        }
      } catch (e) {
        push(`ERREUR Firestore: ${String(e).slice(0, 120)}`);
      }

      push('\n— Base locale (activities) —');
      const db = await getDb();
      const byUnit = await db.select<{ unit: string; cnt: number }[]>(
        "SELECT COALESCE(NULLIF(unit,''),'main') as unit, COUNT(*) as cnt FROM activities WHERE is_template=0 GROUP BY 1",
        [],
      );
      const byRec = await db.select<{ is_recurring: number; cnt: number }[]>(
        'SELECT is_recurring, COUNT(*) as cnt FROM activities WHERE is_template=0 GROUP BY is_recurring',
        [],
      );
      const pasaFuture = await db.select<{ cnt: number }[]>(
        "SELECT COUNT(*) as cnt FROM activities WHERE unit='pasa' AND date >= date('now') AND is_template=0",
        [],
      );
      const bySource = await db.select<{ src: string; cnt: number }[]>(
        "SELECT COALESCE(NULLIF(synced_from,''),'local') as src, COUNT(*) as cnt FROM activities WHERE is_template=0 GROUP BY 1",
        [],
      );
      push(`par unit: ${byUnit.map((r) => `${r.unit}=${r.cnt}`).join('  ')}`);
      push(`par is_recurring: ${byRec.map((r) => `${r.is_recurring}=${r.cnt}`).join('  ')}`);
      push(`par source: ${bySource.map((r) => `${r.src}=${r.cnt}`).join('  ')}`);
      push(`PASA à venir (date ≥ aujourd'hui): ${pasaFuture[0]?.cnt ?? 0}`);

      push('\n— Dernier sync activities —');
      const lastSync = await db.select<{ started_at: string; finished_at: string | null; status: string; items_synced: number; items_failed: number; error_message: string | null }[]>(
        "SELECT started_at, finished_at, status, items_synced, items_failed, error_message FROM sync_log WHERE module='activities' ORDER BY id DESC LIMIT 1",
        [],
      );
      if (lastSync.length === 0) {
        push('AUCUN sync log — sync jamais exécuté depuis la dernière migration.');
      } else {
        const l = lastSync[0];
        push(`${l.status} synced=${l.items_synced} failed=${l.items_failed} started=${l.started_at} finished=${l.finished_at ?? '—'}`);
        if (l.error_message) push(`error: ${l.error_message.slice(0, 200)}`);
      }
    } catch (e) {
      push(`\nEXCEPTION: ${String(e).slice(0, 200)}`);
    } finally {
      setDiagReport(lines.join('\n'));
      setDiagRunning(false);
    }
  }, [appVersion]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820, animation: 'slide-in 0.22s ease-out' }}>
      <div className="eyebrow">
        Configuration de l'application
      </div>

      <IdentitySection />

      <DemoDataSection />

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

      {/* Diagnostic PASA — à partager en cas de problème */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Stethoscope size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Diagnostic PASA
          </h2>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
          Compare Firestore et la base locale pour identifier où le problème se situe.
        </p>
        <button
          onClick={handleRunDiagnostic}
          disabled={diagRunning}
          style={{
            padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            border: '1.5px solid var(--color-primary)', background: 'transparent',
            color: 'var(--color-primary)', cursor: diagRunning ? 'wait' : 'pointer',
          }}
        >
          {diagRunning ? 'Analyse en cours…' : 'Lancer le diagnostic'}
        </button>
        {diagReport && (
          <pre style={{
            marginTop: '12px', padding: '12px', background: 'var(--color-bg-soft)',
            borderRadius: '6px', fontSize: '11px', fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflow: 'auto',
          }}>{diagReport}</pre>
        )}
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
  const settings = useUserSettings();
  const addToast = useToastStore((s) => s.add);
  const [first, setFirst]   = useState(settings.user_first_name);
  const [last, setLast]     = useState(settings.user_last_name);
  const [role, setRole]     = useState(settings.user_role);
  const [resName, setResName] = useState(settings.residence_name);
  const [resKind, setResKind] = useState(settings.residence_kind);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirst(settings.user_first_name);
    setLast(settings.user_last_name);
    setRole(settings.user_role);
    setResName(settings.residence_name);
    setResKind(settings.residence_kind);
  }, [settings]);

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

function DemoDataSection() {
  const addToast = useToastStore((s) => s.add);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [lastSeed, setLastSeed] = useState<SeedCounts | null>(null);

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

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FlaskConical size={16} style={{ color: 'var(--terra-deep)' }} />
        <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
          Données de démo
        </h2>
      </div>

      <p style={{
        margin: '0 0 16px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55,
      }}>
        Charge un jeu de données réaliste pour tester toutes les fonctionnalités : 12 résidents
        (avec anniversaires, humeurs, contacts famille), 25 activités (templates + planning),
        12 entrées de carnet de bord, 6 projets, 15 dépenses, 5 RDV, inventaire, annuaire et
        fournisseurs.
      </p>

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
