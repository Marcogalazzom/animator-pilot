import { useEffect, useState } from 'react';
import { Download, X, CheckCircle2, Loader2 } from 'lucide-react';
import { checkForAppUpdate, downloadAndInstall, type UpdateInfo } from '@/utils/updater';
import type { Update } from '@tauri-apps/plugin-updater';

const DISMISS_KEY = 'update-dismissed-version';

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check silently 3s after mount to not slow down startup
    const timer = setTimeout(async () => {
      const result = await checkForAppUpdate();
      if (result && result.available) {
        const dismissedVersion = localStorage.getItem(DISMISS_KEY);
        if (dismissedVersion === result.version) {
          setDismissed(true);
        }
      }
      setInfo(result);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!info || !info.available || dismissed) return null;

  async function handleInstall(update: Update) {
    setInstalling(true);
    try {
      await downloadAndInstall(update, (dl, tot) => {
        setProgress(dl);
        setTotal(tot);
      });
      setDone(true);
      // relaunch() is called inside downloadAndInstall; the app will restart.
    } catch (err) {
      console.error('[updater] install failed:', err);
      setInstalling(false);
    }
  }

  function handleDismiss() {
    if (info && info.available) {
      localStorage.setItem(DISMISS_KEY, info.version);
    }
    setDismissed(true);
  }

  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px',
      background: 'linear-gradient(90deg, #7C3AED 0%, #6D28D9 100%)',
      color: '#fff',
      fontSize: '13px', fontFamily: 'var(--font-sans)',
      flexShrink: 0,
    }}>
      {done ? (
        <>
          <CheckCircle2 size={16} />
          <span>Installation terminée — redémarrage de l'application…</span>
        </>
      ) : installing ? (
        <>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ flex: 1 }}>
            Téléchargement de la version <strong>{info.version}</strong>…
            {total > 0 && ` ${pct}%`}
          </span>
          {total > 0 && (
            <div style={{
              width: '160px', height: '4px', borderRadius: '2px',
              background: 'rgba(255,255,255,0.25)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: '#fff',
                transition: 'width 120ms linear',
              }} />
            </div>
          )}
        </>
      ) : (
        <>
          <Download size={16} />
          <span style={{ flex: 1 }}>
            Nouvelle version <strong>v{info.version}</strong> disponible
            {info.notes ? ` — ${info.notes.split('\n')[0].slice(0, 80)}` : ''}
          </span>
          <button
            onClick={() => handleInstall(info.update)}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 600,
              background: '#fff', color: '#7C3AED',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            Mettre à jour maintenant
          </button>
          <button
            onClick={handleDismiss}
            title="Plus tard"
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              cursor: 'pointer', padding: '4px', display: 'inline-flex',
            }}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
