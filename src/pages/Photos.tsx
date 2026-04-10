import { useState, useEffect, useRef } from 'react';
import {
  Camera, Plus, Trash2, X, Image, FolderOpen,
  Calendar, ChevronLeft, Pencil,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { getAlbums, createAlbum, updateAlbum, deleteAlbum } from '@/db/photos';
import type { PhotoAlbum } from '@/db/types';

// ─── Mock data ───────────────────────────────────────────────

const MOCK_ALBUMS: PhotoAlbum[] = [
  { id: 1, title: 'Atelier peinture - Mars 2026', description: 'Séance peinture aquarelle avec les résidents du 2ème étage', activity_date: '2026-03-15', cover_path: null, created_at: '' },
  { id: 2, title: 'Fête du Printemps', description: 'Décoration du hall et spectacle musical', activity_date: '2026-03-20', cover_path: null, created_at: '' },
  { id: 3, title: 'Sortie Jardin Botanique', description: 'Visite du jardin botanique avec 12 résidents', activity_date: '2026-04-02', cover_path: null, created_at: '' },
  { id: 4, title: 'Atelier cuisine - Crêpes', description: 'Préparation de crêpes pour la Chandeleur', activity_date: '2026-02-02', cover_path: null, created_at: '' },
  { id: 5, title: 'Concert intergénérationnel', description: 'Concert avec les élèves de l\'école primaire', activity_date: '2026-02-14', cover_path: null, created_at: '' },
  { id: 6, title: 'Atelier mémoire - Jeux de société', description: 'Après-midi jeux : loto, mémory, puzzles', activity_date: '2026-01-20', cover_path: null, created_at: '' },
];

// Colors for album cards (cycle)
const ALBUM_COLORS = ['#1E40AF', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0F766E', '#EC4899', '#EA580C'];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────

export default function Photos() {
  const [albums, setAlbums] = useState<PhotoAlbum[]>(MOCK_ALBUMS);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getAlbums()
      .then((rows) => { if (rows.length > 0) setAlbums(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      activity_date: fd.get('activity_date') as string,
      cover_path: null,
    };

    try {
      if (editId) {
        await updateAlbum(editId, data).catch(() => {});
        setAlbums((prev) => prev.map((a) => a.id === editId ? { ...a, ...data } : a));
        addToast('Album mis à jour', 'success');
      } else {
        const id = await createAlbum(data).catch(() => Date.now());
        setAlbums((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Album créé', 'success');
      }
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDeleteAlbum(id: number) {
    await deleteAlbum(id).catch(() => {});
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    addToast('Album supprimé', 'success');
  }

  const editAlbum = editId ? albums.find((a) => a.id === editId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Photos & Comptes rendus
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Albums photos des activités et animations
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setShowForm(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', backgroundColor: 'var(--color-primary)',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nouvel album
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>{albums.length}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Albums</p>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>
            {albums.filter((a) => {
              const d = new Date(a.activity_date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Ce mois-ci</p>
        </div>
      </div>

      {/* Album grid */}
      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement...</p>
      ) : albums.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '40px',
          textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <Camera size={40} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Aucun album pour le moment. Créez votre premier album !
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {albums.map((album, i) => {
            const color = ALBUM_COLORS[i % ALBUM_COLORS.length];
            return (
              <div key={album.id} style={{
                backgroundColor: 'var(--color-surface)', borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
                transition: 'box-shadow 0.15s ease', cursor: 'pointer',
              }} className="overdue-project-item">
                {/* Color header */}
                <div style={{
                  height: '120px', backgroundColor: `${color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderBottom: `2px solid ${color}30`,
                }}>
                  <Image size={36} style={{ color: `${color}60` }} />
                </div>

                <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {album.title}
                  </h3>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
                    {album.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      <Calendar size={11} /> {formatDate(album.activity_date)}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditId(album.id); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                        <Pencil size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }} onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '12px',
            padding: '24px', width: '480px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier l\'album' : 'Nouvel album'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Titre de l'album
                <input name="title" defaultValue={editAlbum?.title ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Description / Compte rendu
                <textarea name="description" rows={4} defaultValue={editAlbum?.description ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} placeholder="Décrivez l'activité, le nombre de participants, les retours..." />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Date de l'activité
                <input name="activity_date" type="date" defaultValue={editAlbum?.activity_date ?? new Date().toISOString().slice(0, 10)} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Créer l\'album'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
