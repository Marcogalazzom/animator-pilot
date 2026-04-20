import { Check } from 'lucide-react';
import { photoSrc } from '@/utils/photoStorage';
import type { Photo } from '@/db/types';

interface Props {
  photos: Photo[];
  selectMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onOpenLightbox?: (index: number) => void;
}

export default function PhotoGrid({
  photos, selectMode = false, selectedIds, onToggleSelect, onOpenLightbox,
}: Props) {
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 12,
    }}>
      {photos.map((p, idx) => {
        const src = photoSrc(p.thumbnail_path || p.file_path);
        const selected = selectedIds?.has(p.id) ?? false;
        return (
          <button
            key={p.id}
            onClick={() => {
              if (selectMode) onToggleSelect?.(p.id);
              else onOpenLightbox?.(idx);
            }}
            style={{
              position: 'relative',
              background: 'var(--surface)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: selected ? '0 0 0 3px var(--terra)' : 'var(--shadow-sm)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'box-shadow 0.15s ease, transform 0.18s ease',
            }}
            onMouseEnter={(ev) => { if (!selected) ev.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={(ev) => { if (!selected) ev.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            title={p.caption || undefined}
          >
            <div style={{ aspectRatio: '4/3', background: 'var(--surface-3)', overflow: 'hidden' }}>
              <img src={src} alt={p.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            {/* Selection indicator — always visible in select mode, on hover otherwise */}
            {selectMode && (
              <div
                style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 22, height: 22, borderRadius: '50%',
                  background: selected ? 'var(--terra)' : 'rgba(255,255,255,0.85)',
                  border: `2px solid ${selected ? 'var(--terra-deep)' : 'var(--line-strong)'}`,
                  color: '#fff',
                  display: 'grid', placeItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </div>
            )}

            {p.caption && (
              <div
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '16px 10px 8px',
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))',
                  color: '#fff', fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}
              >
                {p.caption}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
