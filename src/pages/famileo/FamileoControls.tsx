import { ChevronUp, ChevronDown, Eye, EyeOff, ImageOff, AlertCircle, FileDown } from 'lucide-react';
import { categoryLabel } from '@/db/categoryColors';
import type { UIFamileoSection } from './useFamileoData';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface Props {
  year: number;
  month: number;
  onMonthChange: (y: number, m: number) => void;
  sections: UIFamileoSection[];
  onSectionsChange: (next: UIFamileoSection[]) => void;
  onExport: () => void;
  exporting: boolean;
}

export default function FamileoControls({
  year, month, onMonthChange, sections, onSectionsChange, onExport, exporting,
}: Props) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  function toggle(albumId: number) {
    onSectionsChange(sections.map((s) => s.album.id === albumId ? { ...s, included: !s.included } : s));
  }
  function move(albumId: number, delta: number) {
    const idx = sorted.findIndex((s) => s.album.id === albumId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const a = sorted[idx], b = sorted[target];
    onSectionsChange(sections.map((s) => {
      if (s.album.id === a.album.id) return { ...s, order: b.order };
      if (s.album.id === b.album.id) return { ...s, order: a.order };
      return s;
    }));
  }

  const years = [year - 1, year, year + 1];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '16px',
      background: 'var(--color-surface)', borderRadius: '10px',
      boxShadow: 'var(--shadow-card)', padding: '16px',
      maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
    }}>
      <div>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mois
        </label>
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <select value={month} onChange={(e) => onMonthChange(year, Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => onMonthChange(Number(e.target.value), month)} style={selectStyle}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Albums du mois ({sorted.length})
        </label>
        {sorted.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>
            Aucun album pour ce mois. Depuis une activité, clique sur « Photos » pour créer l'album du type.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {sorted.map((s, i) => {
              const noPhotos = s.photos.length === 0;
              const color = s.category?.color ?? '#7C3AED';
              return (
                <div key={s.album.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 10px', borderRadius: '6px',
                  background: s.included ? `${color}0F` : 'var(--color-bg-soft)',
                  border: `1px solid ${s.included ? `${color}33` : 'var(--color-border)'}`,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.album.title}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {s.category && <span style={{ color, fontWeight: 500 }}>{categoryLabel(s.category)}</span>}
                      <span>· {s.photos.length} photo{s.photos.length > 1 ? 's' : ''}</span>
                      {noPhotos && (
                        <span style={{ color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <ImageOff size={10} /> vide
                        </span>
                      )}
                      {s.text.length === 0 && (
                        <span style={{ color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <AlertCircle size={10} /> pas de texte
                        </span>
                      )}
                    </span>
                  </div>
                  <button onClick={() => move(s.album.id, -1)} disabled={i === 0} style={iconBtn} title="Monter"><ChevronUp size={12} /></button>
                  <button onClick={() => move(s.album.id, 1)} disabled={i === sorted.length - 1} style={iconBtn} title="Descendre"><ChevronDown size={12} /></button>
                  <button onClick={() => toggle(s.album.id)} style={iconBtn} title={s.included ? 'Masquer' : 'Inclure'}>
                    {s.included ? <Eye size={12} style={{ color }} /> : <EyeOff size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onExport}
        disabled={exporting || sorted.filter((s) => s.included).length === 0}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '10px', background: '#7C3AED', color: '#fff',
          border: 'none', borderRadius: '8px',
          fontSize: '14px', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer',
          opacity: exporting ? 0.6 : 1,
          marginTop: 'auto',
        }}
      >
        <FileDown size={14} /> {exporting ? 'Export en cours…' : 'Exporter PDF'}
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1, padding: '7px 10px',
  border: '1px solid var(--color-border)', borderRadius: '6px',
  fontSize: '13px', background: 'var(--color-surface)', cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: '4px', padding: '3px 5px', cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};
