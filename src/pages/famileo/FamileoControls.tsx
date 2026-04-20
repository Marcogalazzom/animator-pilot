import { ChevronUp, ChevronDown, Eye, EyeOff, ImageOff, AlertCircle, FileDown, Check, AlertTriangle, Circle } from 'lucide-react';
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
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 16,
      maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
    }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Mois</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={month} onChange={(e) => onMonthChange(year, Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => onMonthChange(Number(e.target.value), month)} style={selectStyle}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Albums du mois ({sorted.length})
        </div>
        {sorted.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            Aucun album pour ce mois. Depuis une activité, clique sur « Photos » pour créer l'album du type.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map((s, i) => {
              const noPhotos = s.photos.length === 0;
              const noText = s.text.length === 0;
              // Completeness: ok if has photos + text; warn if missing one; dot if both empty
              const status: 'ok' | 'warn' | 'dot' =
                (!noPhotos && !noText) ? 'ok'
                : (noPhotos && noText) ? 'dot'
                : 'warn';
              return (
                <div key={s.album.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 10px', borderRadius: 8,
                  background: s.included ? 'var(--terra-soft)' : 'var(--surface-2)',
                  border: `1px solid ${s.included ? 'var(--terra-soft)' : 'var(--line)'}`,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: status === 'ok' ? 'var(--sage-soft)' : status === 'warn' ? 'var(--warn-soft)' : 'var(--surface-2)',
                    color: status === 'ok' ? 'var(--sage-deep)' : status === 'warn' ? 'var(--warn)' : 'var(--ink-4)',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }} title={status === 'ok' ? 'Complet' : status === 'warn' ? 'Incomplet' : 'Vide'}>
                    {status === 'ok' && <Check size={11} strokeWidth={3} />}
                    {status === 'warn' && <AlertTriangle size={10} strokeWidth={2.5} />}
                    {status === 'dot' && <Circle size={6} fill="currentColor" stroke="none" />}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.album.title}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {s.category && <span style={{ fontWeight: 500 }}>{categoryLabel(s.category)}</span>}
                      <span>· {s.photos.length} photo{s.photos.length > 1 ? 's' : ''}</span>
                      {noPhotos && (
                        <span style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <ImageOff size={10} /> vide
                        </span>
                      )}
                      {noText && !noPhotos && (
                        <span style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <AlertCircle size={10} /> pas de texte
                        </span>
                      )}
                    </span>
                  </div>
                  <button onClick={() => move(s.album.id, -1)} disabled={i === 0} style={iconBtn} title="Monter"><ChevronUp size={12} /></button>
                  <button onClick={() => move(s.album.id, 1)} disabled={i === sorted.length - 1} style={iconBtn} title="Descendre"><ChevronDown size={12} /></button>
                  <button onClick={() => toggle(s.album.id)} style={iconBtn} title={s.included ? 'Masquer' : 'Inclure'}>
                    {s.included ? <Eye size={12} style={{ color: 'var(--terra-deep)' }} /> : <EyeOff size={12} />}
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
        className="btn primary"
        style={{
          justifyContent: 'center',
          marginTop: 'auto',
          opacity: exporting ? 0.6 : 1,
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        <FileDown size={14} /> {exporting ? 'Export en cours…' : 'Exporter PDF'}
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1, padding: '7px 10px',
  border: '1px solid var(--line)', borderRadius: 8,
  fontSize: 13, background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '3px 5px', cursor: 'pointer',
  color: 'var(--ink-3)',
};
