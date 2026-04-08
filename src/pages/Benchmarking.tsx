import { useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useBenchmarkingData, ANAP_CATEGORY_LABELS } from './benchmarking/useBenchmarkingData';
import type { AnapCategory, AnapIndicator } from '@/db/types';

function fmt(n: number | null, unit: string): string {
  if (n === null) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + (unit ? ` ${unit}` : '');
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '4px',
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', textAlign: 'right' as const, width: '100px',
};

export default function Benchmarking() {
  const data = useBenchmarkingData();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Radar chart data — normalize values to 0-100 scale for comparison
  const radarData = data.indicators.map((ind) => {
    const etab = ind.value_etablissement ?? 0;
    const nat = ind.value_national ?? 0;
    // Simple normalization: percentage of national value
    const normalized = nat > 0 ? (etab / nat) * 100 : 0;
    return {
      indicator: ind.label.length > 20 ? ind.label.slice(0, 18) + '…' : ind.label,
      Établissement: Math.round(normalized),
      'Moyenne nationale': 100,
    };
  });

  function handleStartEdit(ind: AnapIndicator) {
    setEditingId(ind.id);
    setEditValue(ind.value_etablissement?.toString() ?? '');
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    const val = parseFloat(editValue.replace(',', '.'));
    if (!isNaN(val)) {
      await data.editIndicator(editingId, { value_etablissement: val });
    }
    setEditingId(null);
  }

  function ecartPct(etab: number | null, nat: number | null): { value: number; color: string; icon: 'up' | 'down' | 'neutral' } {
    if (etab === null || nat === null || nat === 0) return { value: 0, color: 'var(--color-text-secondary)', icon: 'neutral' };
    const pct = ((etab - nat) / nat) * 100;
    const absPct = Math.abs(pct);
    const color = absPct > 15 ? 'var(--color-danger)' : absPct > 5 ? 'var(--color-warning)' : 'var(--color-success)';
    return { value: pct, color, icon: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
  }

  if (data.loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '40px', color: 'var(--color-text-secondary)' }}><Loader2 size={18} className="animate-spin" /> Chargement...</div>;
  }

  const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--color-border)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Indicateurs ANAP</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>Positionnement par rapport aux moyennes nationales</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Année :</span>
          <select value={data.selectedYear} onChange={(e) => data.setSelectedYear(Number(e.target.value))} style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
            {data.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[null, 'activite', 'rh', 'finance', 'qualite'].map((c) => (
          <button key={c ?? 'all'} onClick={() => data.setFilterCategory(c as AnapCategory | null)} style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
            border: `1px solid ${data.filterCategory === c ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer',
            backgroundColor: data.filterCategory === c ? 'var(--color-primary)' : 'var(--color-surface)',
            color: data.filterCategory === c ? '#fff' : 'var(--color-text-secondary)',
          }}>
            {c ? ANAP_CATEGORY_LABELS[c as AnapCategory] : 'Tous'}
          </button>
        ))}
      </div>

      {/* Radar chart */}
      {radarData.length > 2 && (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
            <Activity size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
            Positionnement
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 150]} tick={false} axisLine={false} />
              <Radar name="Établissement" dataKey="Établissement" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.2} strokeWidth={2} />
              <Radar name="Moyenne nationale" dataKey="Moyenne nationale" stroke="var(--color-text-secondary)" fill="none" strokeWidth={1} strokeDasharray="4 4" />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '12px', fontFamily: 'var(--font-sans)', marginTop: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '12px', height: '3px', backgroundColor: 'var(--color-primary)', borderRadius: '2px', display: 'inline-block' }} /> Votre établissement</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '12px', height: '3px', backgroundColor: 'var(--color-text-secondary)', borderRadius: '2px', display: 'inline-block', borderTop: '1px dashed var(--color-text-secondary)' }} /> Moyenne nationale</span>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Indicateur</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Catégorie</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right' }}>Votre valeur</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right' }}>Moy. nationale</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right' }}>Écart</th>
            </tr>
          </thead>
          <tbody>
            {data.indicators.map((ind) => {
              const e = ecartPct(ind.value_etablissement, ind.value_national);
              const EIcon = e.icon === 'up' ? TrendingUp : e.icon === 'down' ? TrendingDown : Minus;
              return (
                <tr key={ind.id}>
                  <td style={{ ...cellStyle, fontWeight: 500 }}>{ind.label}</td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', padding: '1px 6px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.04)' }}>
                      {ANAP_CATEGORY_LABELS[ind.category]}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {editingId === ind.id ? (
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                        autoFocus style={inputStyle} />
                    ) : (
                      <span onClick={() => handleStartEdit(ind)} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, color: ind.value_etablissement !== null ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} title="Cliquer pour modifier">
                        {ind.value_etablissement !== null ? fmt(ind.value_etablissement, ind.unit) : 'Saisir'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{fmt(ind.value_national, ind.unit)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {ind.value_etablissement !== null && ind.value_national !== null ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: e.color, fontWeight: 600, fontSize: '12px' }}>
                        <EIcon size={13} />
                        {e.value > 0 ? '+' : ''}{e.value.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
            {data.indicators.length === 0 && (
              <tr><td colSpan={5} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)', padding: '32px' }}>Aucun indicateur pour cette année.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
