import { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar, CheckSquare, Trash2, X, Mail, Square } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useToastStore } from '@/stores/toastStore';
import { getAlbum, getPhotos, createPhoto, updatePhoto, deletePhoto } from '@/db/photos';
import { storePhoto, deletePhotoFiles } from '@/utils/photoStorage';
import { ensureCategoryColors, categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { PhotoAlbum, Photo } from '@/db/types';
import PhotoGrid from './PhotoGrid';
import Lightbox from './Lightbox';

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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

  // Reset selection when leaving select mode.
  useEffect(() => {
    if (!selectMode) setSelectedIds(new Set());
  }, [selectMode]);

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

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const targets = photos.filter((p) => selectedIds.has(p.id));
    let ok = 0, fail = 0;
    for (const p of targets) {
      try {
        await deletePhoto(p.id);
        await deletePhotoFiles(p.file_path, p.thumbnail_path);
        ok++;
      } catch { fail++; }
    }
    if (ok > 0) addToast(`${ok} photo${ok > 1 ? 's' : ''} supprimée${ok > 1 ? 's' : ''}`, 'success');
    if (fail > 0) addToast(`${fail} échec${fail > 1 ? 's' : ''} de suppression`, 'error');
    setSelectedIds(new Set());
    setSelectMode(false);
    await refresh();
  }

  const allSelected = useMemo(() =>
    photos.length > 0 && selectedIds.size === photos.length,
    [photos.length, selectedIds.size],
  );

  if (loading || !album) {
    return <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={onBack} className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={13} /> Retour aux albums
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="serif" style={{
              fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: -0.6,
            }}>
              {album.title}
            </h1>
            {category && (
              <span className="chip" style={{
                background: category.bg, color: category.color,
              }}>
                {categoryLabel(category)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
              <Calendar size={11} /> {formatMonth(album.activity_date)}
            </span>
            <span>{photos.length} photo{photos.length > 1 ? 's' : ''}</span>
          </div>
          {album.description && (
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '10px 0 0', maxWidth: 700, lineHeight: 1.5 }}>
              {album.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {photos.length > 0 && (
            <button
              onClick={() => setSelectMode((v) => !v)}
              className={selectMode ? 'btn primary' : 'btn'}
            >
              {selectMode ? <X size={13} /> : <CheckSquare size={13} />}
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          )}
          <button onClick={() => onEditAlbum(album)} className="btn">
            Modifier l'album
          </button>
          <button
            onClick={handleAddPhotos}
            disabled={uploading}
            className="btn primary"
            style={{ opacity: uploading ? 0.6 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            <Plus size={13} strokeWidth={2.5} /> {uploading ? 'Import…' : 'Ajouter des photos'}
          </button>
        </div>
      </div>

      <PhotoGrid
        photos={photos}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onOpenLightbox={(i) => setLightboxIndex(i)}
      />

      {/* Contextual toolbar (sticky bottom) */}
      {selectMode && (
        <div
          style={{
            position: 'sticky', bottom: 16, alignSelf: 'center',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <span className="num" style={{
            fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-2)',
          }}>
            {selectedIds.size} / {photos.length} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={allSelected ? () => setSelectedIds(new Set()) : selectAll}
            className="btn ghost sm"
          >
            {allSelected ? <X size={12} /> : <Square size={12} />}
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <button
            onClick={() => addToast('Bientôt : ajout direct au Famileo du mois', 'info')}
            className="btn sm"
            disabled={selectedIds.size === 0}
            style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
          >
            <Mail size={12} /> Ajouter au Famileo
          </button>
          <button
            onClick={deleteSelected}
            className="btn sm"
            disabled={selectedIds.size === 0}
            style={{
              color: 'var(--danger)',
              opacity: selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            <Trash2 size={12} /> Supprimer
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onCaption={handleCaption}
          onDelete={async (id) => {
            await handleDeletePhoto(id);
            setLightboxIndex(null);
          }}
        />
      )}
    </div>
  );
}
