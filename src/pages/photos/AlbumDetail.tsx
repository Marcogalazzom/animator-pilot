import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Calendar } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useToastStore } from '@/stores/toastStore';
import { getAlbum, getPhotos, createPhoto, updatePhoto, deletePhoto } from '@/db/photos';
import { storePhoto, deletePhotoFiles } from '@/utils/photoStorage';
import { ensureCategoryColors, categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { PhotoAlbum, Photo } from '@/db/types';
import PhotoGrid from './PhotoGrid';

interface Props {
  albumId: number;
  onBack: () => void;
  onEditAlbum: (album: PhotoAlbum) => void;
}

function formatMonth(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function AlbumDetail({ albumId, onBack, onEditAlbum }: Props) {
  const [album, setAlbum] = useState<PhotoAlbum | null>(null);
  const [category, setCategory] = useState<CategoryColor | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const addToast = useToastStore((s) => s.add);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([getAlbum(albumId), getPhotos(albumId)]);
      setAlbum(a); setPhotos(p);
      if (a?.activity_type) {
        const cats = await ensureCategoryColors('activities', [a.activity_type]).catch(() => []);
        setCategory(cats.find((c) => c.name === a.activity_type) ?? null);
      } else {
        setCategory(null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [albumId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAddPhotos() {
    if (uploading) return;
    let picked: string | string[] | null;
    try {
      picked = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
    } catch (err) {
      addToast(`Erreur dialog : ${String(err).slice(0, 80)}`, 'error');
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length === 0) return;

    setUploading(true);
    let ok = 0, fail = 0;
    for (const srcPath of paths) {
      try {
        const { filePath, thumbnailPath } = await storePhoto(srcPath);
        await createPhoto({
          album_id: albumId,
          file_path: filePath,
          thumbnail_path: thumbnailPath,
          caption: '',
          taken_at: new Date().toISOString(),
        });
        ok++;
      } catch (err) {
        console.error('Photo upload failed', err);
        fail++;
      }
    }
    setUploading(false);
    if (ok > 0) addToast(`${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''}`, 'success');
    if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''} d'upload`, 'error');
    await refresh();
  }

  async function handleCaption(id: number, caption: string) {
    await updatePhoto(id, { caption }).catch(() => {});
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, caption } : p));
  }

  async function handleDeletePhoto(id: number) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    await deletePhoto(id).catch(() => {});
    await deletePhotoFiles(p.file_path, p.thumbnail_path);
    addToast('Photo supprimée', 'success');
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  }

  if (loading || !album) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Chargement…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button onClick={onBack} style={{
        alignSelf: 'flex-start',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '13px', color: 'var(--color-text-secondary)', padding: 0,
      }}>
        <ArrowLeft size={14} /> Retour aux albums
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
              {album.title}
            </h1>
            {category && (
              <span style={{
                padding: '3px 10px', borderRadius: '12px',
                fontSize: '11px', fontWeight: 600,
                color: category.color, backgroundColor: category.bg,
                border: `1px solid ${category.color}33`,
              }}>
                {categoryLabel(category)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
              <Calendar size={11} /> {formatMonth(album.activity_date)}
            </span>
          </div>
          {album.description && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '10px 0 0', maxWidth: '700px', lineHeight: 1.5 }}>
              {album.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => onEditAlbum(album)} style={secondaryBtn}>
            Modifier l'album
          </button>
          <button onClick={handleAddPhotos} disabled={uploading} style={{
            ...primaryBtn,
            opacity: uploading ? 0.6 : 1,
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}>
            <Plus size={14} /> {uploading ? 'Import…' : 'Ajouter des photos'}
          </button>
        </div>
      </div>

      <PhotoGrid photos={photos} onCaption={handleCaption} onDelete={handleDeletePhoto} />
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: '8px',
  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px', background: 'var(--color-surface)', color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)', borderRadius: '8px',
  fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
