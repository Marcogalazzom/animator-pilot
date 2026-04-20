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
      background: 'var(--surface-2)',
      padding: 24,
      borderRadius: 14,
      minHeight: 'calc(100vh - 200px)',
    }}>
      {/* A4-like page preview — ratio 1:1.414 */}
      <div style={{
        maxWidth: 720, margin: '0 auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        aspectRatio: '1 / 1.414',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Cover */}
        <div style={{
          background: 'linear-gradient(135deg, var(--terra-soft), #f9e9df)',
          color: 'var(--terra-deep)',
          padding: '48px 32px',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          <p className="eyebrow" style={{ margin: 0, color: 'var(--terra-deep)' }}>
            Famileo · Animation
          </p>
          <h1 className="serif" style={{
            margin: '12px 0 0', fontSize: 36, fontWeight: 500,
            letterSpacing: -0.6, color: 'var(--terra-deep)',
          }}>
            {MONTHS[month - 1]} {year}
          </h1>
          <textarea
            value={cover}
            onChange={(e) => onCoverChange(e.target.value)}
            placeholder="Mot d'introduction pour les familles (facultatif)…"
            rows={2}
            style={{
              display: 'block', margin: '24px auto 0', width: '80%',
              background: 'rgba(255,255,255,0.5)', border: '1px dashed var(--terra)',
              color: 'var(--terra-deep)', padding: '8px 12px', borderRadius: 6,
              fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
              outline: 'none',
            }}
          />
        </div>

        {/* Sections */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {included.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun album sélectionné. Active un album dans le panneau de gauche.
            </div>
          ) : (
            included.map((s) => (
              <FamileoSection key={s.album.id} section={s} onTextChange={onTextChange} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
