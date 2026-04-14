import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import type { PhotoAlbum } from '@/db/types';

interface Props {
  initial: PhotoAlbum | null;
  types: CategoryColor[];
  onSubmit: (data: Omit<PhotoAlbum, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

function monthInputValue(dateStr: string): string {
  return (dateStr || new Date().toISOString().slice(0, 10)).slice(0, 7);
}

function firstOfMonth(yyyyMm: string): string {
  return `${yyyyMm}-01`;
}

export default function AlbumFormModal({ initial, types, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState(initial?.activity_type ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current; if (!form) return;
    const fd = new FormData(form);
    const monthVal = (fd.get('month') as string) || monthInputValue('');
    const data: Omit<PhotoAlbum, 'id' | 'created_at'> = {
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || '',
      activity_date: firstOfMonth(monthVal),
      cover_path: initial?.cover_path ?? null,
      activity_id: initial?.activity_id ?? null,
      activity_type: type.trim(),
    };
    await onSubmit(data);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            {initial ? "Modifier l'album" : 'Nouvel album'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Type d'activité
              <input
                list="album-types"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="loto, gym, chant…"
                required
                style={inputStyle}
              />
              <datalist id="album-types">
                {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
              </datalist>
            </label>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>
              Mois couvert
              <input
                name="month"
                type="month"
                defaultValue={monthInputValue(initial?.activity_date ?? '')}
                required
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Titre de l'album
            <input name="title" defaultValue={initial?.title ?? ''} required style={inputStyle} placeholder="Ex: Loto — Avril 2026" />
          </label>

          <label style={{ fontSize: '13px', fontWeight: 500 }}>
            Texte Famileo / Compte rendu
            <textarea
              name="description"
              rows={5}
              defaultValue={initial?.description ?? ''}
              placeholder="Paragraphe qui sera repris dans le Famileo du mois…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          <button type="submit" style={{ padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {initial ? 'Mettre à jour' : "Créer l'album"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', marginTop: '4px',
  border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px',
};
