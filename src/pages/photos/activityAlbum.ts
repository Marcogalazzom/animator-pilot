import type { NavigateFunction } from 'react-router-dom';
import { getAlbumByTypeAndMonth, createAlbum } from '@/db/photos';
import type { Activity } from '@/db/types';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function monthPrefix(date: string): string {
  // 'YYYY-MM-DD' → 'YYYY-MM'
  return (date || new Date().toISOString().slice(0, 10)).slice(0, 7);
}

function firstOfMonth(date: string): string {
  return `${monthPrefix(date)}-01`;
}

/**
 * Ouvre (ou crée) l'album regroupant toutes les sessions d'un **type**
 * d'activité pour le **mois** de l'activité cliquée.
 *
 * Exemple : cliquer "Photos" sur n'importe quelle session de Loto d'avril
 * ouvre l'album "Loto — Avril 2026" partagé par toutes les sessions de loto
 * de ce mois.
 */
export async function openOrCreateActivityAlbum(
  activity: Activity,
  navigate: NavigateFunction,
): Promise<void> {
  const type = activity.activity_type || 'autre';
  const prefix = monthPrefix(activity.date);
  const [year, month] = prefix.split('-').map(Number);

  const existing = await getAlbumByTypeAndMonth(type, prefix).catch(() => null);
  let albumId = existing?.id;
  if (!albumId) {
    const title = `${cap(type)} — ${cap(MONTHS_FR[(month - 1) || 0])} ${year}`;
    albumId = await createAlbum({
      title,
      description: '',
      activity_date: firstOfMonth(activity.date),
      cover_path: null,
      activity_id: null,
      activity_type: type,
    });
  }
  navigate(`/photos?album=${albumId}`);
}
