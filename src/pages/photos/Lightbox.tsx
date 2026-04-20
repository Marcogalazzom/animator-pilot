import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Check, Mail, Trash2 } from 'lucide-react';
import { photoSrc } from '@/utils/photoStorage';
import type { Photo } from '@/db/types';

interface Props {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
  onCaption: (id: number, caption: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAddToFamileo?: (id: number) => void;
}

export default function Lightbox({ photos, startIndex, onClose, onCaption, onDelete, onAddToFamileo }: Props) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0)));
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const photo = photos[index];

  useEffect(() => {
    setDraft(photo?.caption ?? '');
  }, [photo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  if (!photo) return null;

  async function commitCaption() {
    if (!photo) return;
    if (draft !== photo.caption) await onCaption(photo.id, draft);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(15, 12, 10, 0.92)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          color: 'var(--ink-4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {index + 1} / {photos.length}
        </div>
        <div style={{ flex: 1 }} />
        {onAddToFamileo && (
          <button
            onClick={() => onAddToFamileo(photo.id)}
            className="btn sm"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            <Mail size={12} /> Ajouter au Famileo
          </button>
        )}
        <button
          onClick={() => onDelete(photo.id)}
          className="btn sm"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--danger-soft)', border: '1px solid rgba(255,255,255,0.18)' }}
          title="Supprimer"
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={onClose}
          className="btn sm"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Image area */}
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 80px', minHeight: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photoSrc(photo.file_path)}
          alt={photo.caption || ''}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* Nav buttons */}
      <button
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.max(0, i - 1)); }}
        disabled={index === 0}
        style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: index === 0 ? 'not-allowed' : 'pointer',
          display: 'grid', placeItems: 'center',
          opacity: index === 0 ? 0.4 : 1,
        }}
        aria-label="Précédente"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setIndex((i) => Math.min(photos.length - 1, i + 1)); }}
        disabled={index === photos.length - 1}
        style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: index === photos.length - 1 ? 'not-allowed' : 'pointer',
          display: 'grid', placeItems: 'center',
          opacity: index === photos.length - 1 ? 0.4 : 1,
        }}
        aria-label="Suivante"
      >
        <ChevronRight size={20} />
      </button>

      {/* Caption bar */}
      <div
        style={{
          padding: '14px 20px 18px',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitCaption}
          onKeyDown={(e) => { if (e.key === 'Enter') { commitCaption(); inputRef.current?.blur(); } }}
          placeholder="Ajouter une légende…"
          style={{
            flex: 1, padding: '8px 14px',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999,
            fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={commitCaption}
          className="btn sm"
          style={{ background: 'var(--terra)', color: '#fff', border: '1px solid var(--terra-deep)' }}
        >
          <Check size={12} strokeWidth={2.5} /> Enregistrer
        </button>
      </div>
    </div>
  );
}
