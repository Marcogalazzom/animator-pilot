import { useState } from 'react';
import { Camera } from 'lucide-react';
import { categoryLabel } from '@/db/categoryColors';
import { photoSrc } from '@/utils/photoStorage';
import type { UIFamileoSection } from './useFamileoData';

interface Props {
  section: UIFamileoSection;
  onTextChange: (albumId: number, text: string) => Promise<void>;
}

export default function FamileoSection({ section, onTextChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.text);

  const { album, photos, category } = section;
  const color = category?.color ?? '#7C3AED';

  async function commit() {
    setEditing(false);
    await onTextChange(album.id, draft);
  }

  return (
    <div style={{
      padding: '18px 20px',
      borderTop: `2px solid ${color}`,
      background: '#fff',
      pageBreakInside: 'avoid',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>
            {album.title}
          </h2>
          {category && (
            <span style={{
              padding: '2px 10px', borderRadius: '12px',
              fontSize: '11px', fontWeight: 600,
              color: category.color, backgroundColor: category.bg,
              border: `1px solid ${category.color}33`,
            }}>
              {categoryLabel(category)}
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Camera size={11} /> {photos.length} photo{photos.length > 1 ? 's' : ''}
        </span>
      </div>

      {photos.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: photos.length === 1 ? '1fr' : photos.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: '6px', marginBottom: '12px',
        }}>
          {photos.slice(0, 6).map((p) => (
            <div key={p.id} style={{ aspectRatio: '4/3', overflow: 'hidden', borderRadius: '6px', background: '#eee' }}>
              <img src={photoSrc(p.thumbnail_path || p.file_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '18px', textAlign: 'center', fontSize: '12px',
          background: 'var(--color-bg-soft)', borderRadius: '6px', marginBottom: '12px',
          color: 'var(--color-text-secondary)',
        }}>
          Aucune photo dans cet album — ajoutez-en depuis la page Photos.
        </div>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          autoFocus
          rows={4}
          style={{
            width: '100%', padding: '8px 10px',
            border: `1px solid ${color}`, borderRadius: '6px',
            fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.5,
            resize: 'vertical',
          }}
        />
      ) : (
        <p
          onClick={() => { setEditing(true); setDraft(section.text); }}
          style={{
            margin: 0, fontSize: '13px', lineHeight: 1.6,
            color: section.text ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontStyle: section.text ? 'normal' : 'italic',
            cursor: 'text',
            padding: '6px 8px', borderRadius: '4px',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0D`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {section.text || 'Cliquez ici pour écrire le paragraphe Famileo…'}
        </p>
      )}
    </div>
  );
}
