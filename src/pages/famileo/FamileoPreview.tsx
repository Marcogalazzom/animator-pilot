import FamileoSection from './FamileoSection';
import type { UIFamileoSection } from './useFamileoData';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface Props {
  year: number;
  month: number;
  sections: UIFamileoSection[];
  cover: string;
  onCoverChange: (v: string) => void;
  onTextChange: (albumId: number, text: string) => Promise<void>;
}

export default function FamileoPreview({ year, month, sections, cover, onCoverChange, onTextChange }: Props) {
  const included = sections.filter((s) => s.included).sort((a, b) => a.order - b.order);

  return (
    <div style={{
      background: '#F3F0F9',
      padding: '24px',
      borderRadius: '10px',
      minHeight: 'calc(100vh - 160px)',
    }}>
      {/* A4-like page preview */}
      <div style={{
        maxWidth: '720px', margin: '0 auto',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {/* Cover */}
        <div style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
          color: '#fff',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.9 }}>
            Famileo · Animation
          </p>
          <h1 style={{ margin: '12px 0 0', fontSize: '36px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {MONTHS[month - 1]} {year}
          </h1>
          <textarea
            value={cover}
            onChange={(e) => onCoverChange(e.target.value)}
            placeholder="Mot d'introduction pour les familles (facultatif)…"
            rows={2}
            style={{
              display: 'block', margin: '24px auto 0', width: '80%',
              background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.4)',
              color: '#fff', padding: '8px 12px', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
            }}
          />
        </div>

        {/* Sections */}
        {included.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            Aucun album sélectionné. Active un album dans le panneau de gauche.
          </div>
        ) : (
          included.map((s) => (
            <FamileoSection key={s.album.id} section={s} onTextChange={onTextChange} />
          ))
        )}
      </div>
    </div>
  );
}
