import { Image as ImageIcon, Calendar, Camera, Trash2, Pencil } from 'lucide-react';
import { categoryLabel } from '@/db/categoryColors';
import { photoSrc } from '@/utils/photoStorage';
import type { AlbumWithMeta } from './useAlbumsData';

interface Props {
  item: AlbumWithMeta;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function AlbumCard({ item, onOpen, onEdit, onDelete }: Props) {
  const { album, photoCount, coverPath, category } = item;
  const color = category?.color ?? 'var(--color-primary)';
  const bg = category?.bg ?? 'var(--color-bg-soft)';

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--color-surface)', borderRadius: '10px',
        boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        cursor: 'pointer', transition: 'var(--transition-fast)',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
    >
      <div style={{
        height: '140px', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {coverPath ? (
          <img src={photoSrc(coverPath)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageIcon size={40} style={{ color }} />
        )}
        <span style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '2px 8px', borderRadius: '12px',
          fontSize: '11px', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
          <Camera size={11} /> {photoCount}
        </span>
        {category && (
          <span style={{
            position: 'absolute', top: '8px', left: '8px',
            background: color, color: '#fff',
            padding: '2px 8px', borderRadius: '12px',
            fontSize: '10px', fontWeight: 600,
          }}>
            {categoryLabel(category)}
          </span>
        )}
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {album.title}
        </h3>
        {album.description && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {album.description}
          </p>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
            <Calendar size={11} /> {formatMonthLabel(album.activity_date)}
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Modifier"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }}>
              <Pencil size={13} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Supprimer"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
