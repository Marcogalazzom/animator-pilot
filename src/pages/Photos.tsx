import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Plus } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { createAlbum, updateAlbum, deleteAlbum } from '@/db/photos';
import { deletePhotoFiles } from '@/utils/photoStorage';
import { getPhotos } from '@/db/photos';
import type { PhotoAlbum } from '@/db/types';
import { useAlbumsData } from './photos/useAlbumsData';
import AlbumCard from './photos/AlbumCard';
import AlbumFormModal from './photos/AlbumFormModal';
import AlbumDetail from './photos/AlbumDetail';

export default function Photos() {
  const data = useAlbumsData();
  const [params, setParams] = useSearchParams();
  const openedId = params.get('album') ? Number(params.get('album')) : null;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PhotoAlbum | null>(null);
  const addToast = useToastStore((s) => s.add);

  // Quand on revient de la vue détail vers la liste, rafraîchir
  // (photo count, cover) sans déclencher au mount initial.
  const prevOpenedId = useRef(openedId);
  const { refresh } = data;
  useEffect(() => {
    if (prevOpenedId.current !== null && openedId === null) {
      refresh().catch(() => {});
    }
    prevOpenedId.current = openedId;
  }, [openedId, refresh]);

  function setOpenedId(id: number | null) {
    const next = new URLSearchParams(params);
    if (id) next.set('album', String(id));
    else next.delete('album');
    setParams(next, { replace: true });
  }

  async function handleSubmit(values: Omit<PhotoAlbum, 'id' | 'created_at'>) {
    try {
      if (editing) {
        await updateAlbum(editing.id, values);
        addToast('Album mis à jour', 'success');
      } else {
        const id = await createAlbum(values);
        addToast('Album créé', 'success');
        setOpenedId(id);
      }
      setShowForm(false); setEditing(null);
      await data.refresh();
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  async function handleDelete(album: PhotoAlbum) {
    if (!confirm(`Supprimer l'album « ${album.title} » et toutes ses photos ?`)) return;
    try {
      const photos = await getPhotos(album.id).catch(() => []);
      await deleteAlbum(album.id);
      for (const p of photos) {
        await deletePhotoFiles(p.file_path, p.thumbnail_path);
      }
      addToast('Album supprimé', 'success');
      await data.refresh();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    }
  }

  // ── Detail view ──
  if (openedId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
        <AlbumDetail
          albumId={openedId}
          onBack={() => setOpenedId(null)}
          onEditAlbum={(a) => { setEditing(a); setShowForm(true); }}
        />
        {showForm && (
          <AlbumFormModal
            initial={editing}
            types={data.types}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
            Photos & comptes rendus
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
            Albums liés aux activités — la base du Famileo mensuel
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '8px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nouvel album
        </button>
      </div>

      {data.loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Chargement…</p>
      ) : data.albums.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '40px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <Camera size={40} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Aucun album pour le moment. Créez votre premier album !
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {data.albums.map((item) => (
            <AlbumCard
              key={item.album.id}
              item={item}
              onOpen={() => setOpenedId(item.album.id)}
              onEdit={() => { setEditing(item.album); setShowForm(true); }}
              onDelete={() => handleDelete(item.album)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AlbumFormModal
          initial={editing}
          types={data.types}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
