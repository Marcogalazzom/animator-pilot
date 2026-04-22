import { useEffect, useState } from 'react';

// Source de vérité pour l'heure courante côté UI. Re-render à l'intervalle
// choisi. Utilisé par le greeting et la timeline pour que les transitions
// (matin → après-midi, à venir → en cours → terminé) apparaissent sans que
// l'utilisateur ait à recharger.
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
