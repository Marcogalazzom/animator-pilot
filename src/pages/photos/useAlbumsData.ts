import { useState, useEffect, useCallback } from 'react';
import { getAlbums, getPhotos } from '@/db/photos';
import { getActivities } from '@/db/activities';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import type { PhotoAlbum, Photo, Activity } from '@/db/types';

export interface AlbumWithMeta {
  album: PhotoAlbum;
  photoCount: number;
  coverPath: string | null;
  category: CategoryColor | null;
}

export interface AlbumsData {
  albums: AlbumWithMeta[];
  types: CategoryColor[];           // catégories activités connues (pour datalist)
  activities: Activity[];           // legacy — conservé pour d'autres usages
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAlbumsData(): AlbumsData {
  const [albums, setAlbums] = useState<AlbumWithMeta[]>([]);
  const [types, setTypes] = useState<CategoryColor[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rawAlbums = await getAlbums();
      const acts = await getActivities().catch(() => [] as Activity[]);

      const allTypeNames = [
        ...rawAlbums.map((a) => a.activity_type).filter(Boolean),
        ...acts.map((a) => a.activity_type).filter(Boolean),
      ];
      const cats = await ensureCategoryColors('activities', allTypeNames).catch(() => [] as CategoryColor[]);
      const catsByName = new Map(cats.map((c) => [c.name, c]));

      const enriched: AlbumWithMeta[] = await Promise.all(
        rawAlbums.map(async (album) => {
          const photos: Photo[] = await getPhotos(album.id).catch(() => []);
          const cover = photos[0]?.thumbnail_path ?? photos[0]?.file_path ?? null;
          return {
            album,
            photoCount: photos.length,
            coverPath: cover,
            category: album.activity_type ? (catsByName.get(album.activity_type) ?? null) : null,
          };
        }),
      );

      setAlbums(enriched);
      setTypes(cats);
      setActivities(acts.filter((a) => !a.is_template));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { albums, types, activities, loading, refresh };
}
