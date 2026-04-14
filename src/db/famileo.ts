import { getDb } from './database';
import { getPhotos } from './photos';
import type { PhotoAlbum, Photo } from './types';

export interface FamileoSection {
  album: PhotoAlbum;
  photos: Photo[];
  text: string;                    // = album.description
}

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Récupère les sections Famileo pour un mois donné : tous les albums
 * dont `activity_date` commence par `YYYY-MM` (albums par type+mois).
 * Triés par type pour un rendu stable.
 */
export async function getFamileoSections(year: number, month: number): Promise<FamileoSection[]> {
  const db = await getDb();
  const prefix = monthPrefix(year, month);

  const albums = await db.select<PhotoAlbum[]>(
    "SELECT * FROM photo_albums WHERE substr(activity_date, 1, 7) = ? ORDER BY activity_type ASC, title ASC",
    [prefix],
  );

  if (albums.length === 0) return [];

  const sections: FamileoSection[] = await Promise.all(
    albums.map(async (album) => {
      const photos = await getPhotos(album.id).catch(() => [] as Photo[]);
      return {
        album,
        photos,
        text: (album.description || '').trim(),
      };
    })
  );

  return sections;
}
