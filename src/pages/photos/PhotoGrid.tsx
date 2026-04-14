import { Trash2, Pencil, Check } from 'lucide-react';
import { useState } from 'react';
import { photoSrc } from '@/utils/photoStorage';
import type { Photo } from '@/db/types';

interface Props {
  photos: Photo[];
  onCaption: (id: number, caption: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function PhotoGrid({ photos, onCaption, onDelete }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  if (photos.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        Aucune photo dans cet album. Cliquez sur « Ajouter des photos » pour commencer.
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '12px',
    }}>
      {photos.map((p) => {
        const src = photoSrc(p.thumbnail_path || p.file_path);
        const isEditing = editing === p.id;
        return (
          <div
            key={p.id}
            style={{
              background: 'var(--color-surface)', borderRadius: '8px',
              overflow: 'hidden', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ aspectRatio: '4/3', background: '#111', overflow: 'hidden' }}>
              <img src={src} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { onCaption(p.id, draft); setEditing(null); } }}
                    style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => { onCaption(p.id, draft); setEditing(null); }}
                    style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}
                  ><Check size={12} /></button>
                </div>
              ) : (
                <p
                  onClick={() => { setEditing(p.id); setDraft(p.caption); }}
                  style={{
                    margin: 0, fontSize: '12px', color: p.caption ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontStyle: p.caption ? 'normal' : 'italic', cursor: 'text',
                    minHeight: '16px',
                  }}
                >
                  {p.caption || 'Ajouter une légende…'}
                </p>
              )}
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                {!isEditing && (
                  <button onClick={() => { setEditing(p.id); setDraft(p.caption); }}
                    style={iconBtn} title="Légende"><Pencil size={12} /></button>
                )}
                <button onClick={() => onDelete(p.id)} style={{ ...iconBtn, color: 'var(--color-danger)' }} title="Supprimer">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'var(--color-bg-soft)', border: 'none', borderRadius: '4px',
  padding: '3px 6px', cursor: 'pointer', color: 'var(--color-text-secondary)',
};
