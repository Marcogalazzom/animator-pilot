import { Check, Eye } from 'lucide-react';
import { photoSrc } from '@/utils/photoStorage';
import type { Photo } from '@/db/types';

interface Props {
  photos: Photo[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenLightbox: (index: number) => void;
}

export default function PhotoGrid({ photos, selectedIds, onToggleSelect, onOpenLightbox }: Props) {
  if (photos.length === 0) {
    return (
      <div style={{
        padding: 48, textAlign: 'center',
        color: 'var(--ink-3)', fontSize: 13,
      }}>
        Aucune photo dans cet album. Cliquez sur « Ajouter des photos » pour commencer.
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 10,
    }}>
      {photos.map((p, idx) => {
        const src = photoSrc(p.thumbnail_path || p.file_path);
        const selected = selectedIds.has(p.id);
        const big = idx === 0;

        return (
          <div
            key={p.id}
            onClick={() => onToggleSelect(p.id)}
            style={{
              gridColumn: big ? 'span 2' : undefined,
              gridRow: big ? 'span 2' : undefined,
              position: 'relative',
              aspectRatio: '1/1',
              borderRadius: 10,
              overflow: 'hidden',
              border: selected ? '3px solid var(--terra)' : '1px solid var(--line)',
              cursor: 'pointer',
              transition: 'border 0.15s ease',
            }}
            title={p.caption || undefined}
          >
            <img
              src={src} alt={p.caption || ''}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Selection indicator */}
            {selected ? (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--terra)', color: '#fff',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}>
                <Check size={14} strokeWidth={2.5} />
              </div>
            ) : (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)', border: '1px solid var(--line)',
              }} />
            )}

            {/* Lightbox trigger (on hover) */}
            <button
              onClick={(e) => { e.stopPropagation(); onOpenLightbox(idx); }}
              title="Voir en grand"
              style={{
                position: 'absolute', bottom: 8, left: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)', border: 'none',
                display: 'grid', placeItems: 'center',
                cursor: 'pointer', color: 'var(--ink-2)',
                opacity: 0, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onFocus={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Eye size={14} />
            </button>

            {/* Caption overlay */}
            {p.caption && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '20px 10px 8px',
                background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))',
                color: '#fff', fontSize: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {p.caption}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
