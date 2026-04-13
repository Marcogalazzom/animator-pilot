import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

export type CalendarView = 'day' | 'week' | 'location' | 'list';

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Jour', week: 'Semaine', location: 'Lieux', list: 'Liste',
};

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  date: string;                // YYYY-MM-DD
  onDateChange: (d: string) => void;
  dateLabel: string;           // ex: "mer. 15 avril" ou "Semaine du 13 avril"
  types: CategoryColor[];
  typeFilter: string;          // '' ou nom de type
  onTypeFilterChange: (v: string) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  onToday: () => void;
}

export default function CalendarToolbar(p: Props) {
  const shift = (days: number) => {
    const d = new Date(p.date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    p.onDateChange(d.toISOString().slice(0, 10));
  };
  const step = p.view === 'week' ? 7 : 1;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
      <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => p.onViewChange(v)}
            style={{
              padding: '6px 12px',
              border: 'none',
              background: p.view === v ? 'var(--color-primary)' : 'var(--color-surface)',
              color: p.view === v ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {p.view !== 'list' && (
        <>
          <button onClick={() => shift(-step)} style={btnIcon}><ChevronLeft size={14} /></button>
          <span style={{ minWidth: '160px', textAlign: 'center', fontWeight: 600, fontSize: '13px' }}>{p.dateLabel}</span>
          <button onClick={() => shift(step)} style={btnIcon}><ChevronRight size={14} /></button>
          <button onClick={p.onToday} style={btnMini}>Aujourd'hui</button>
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <select value={p.typeFilter} onChange={(e) => p.onTypeFilterChange(e.target.value)} style={selectStyle}>
          <option value="">Tous types</option>
          {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
        </select>
        <select value={p.locationFilter} onChange={(e) => p.onLocationFilterChange(e.target.value)} style={selectStyle}>
          <option value="">Tous lieux</option>
          {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

const btnIcon: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', borderRadius: '6px', cursor: 'pointer',
};
const btnMini: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', borderRadius: '6px', cursor: 'pointer',
  fontSize: '12px', fontFamily: 'var(--font-sans)',
};
const selectStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid var(--color-border)',
  borderRadius: '6px', fontSize: '12px', background: 'var(--color-surface)',
};
