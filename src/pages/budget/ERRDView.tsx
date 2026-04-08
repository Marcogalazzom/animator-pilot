import React from 'react';
import type { BudgetLine } from '@/db/types';
import { CHARGE_TITLES, PRODUIT_TITLES } from './useBudgetData';

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ecart(prevu: number, realise: number) {
  const v = realise - prevu;
  const p = prevu === 0 ? 0 : (v / prevu) * 100;
  const absP = Math.abs(p);
  const color = absP > 10 ? 'var(--color-danger)' : absP > 5 ? 'var(--color-warning)' : 'var(--color-text-secondary)';
  return { value: v, pct: p, color };
}

interface ERRDViewProps {
  sections: { id: number; name: string; label: string }[];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  lines: BudgetLine[];
  onEditRealise: (id: number, amount: number) => Promise<void>;
}

export default function ERRDView({ sections, selectedSectionId, onSelectSection, lines, onEditRealise }: ERRDViewProps) {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editValue, setEditValue] = React.useState('');

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)',
    borderBottom: '1px solid var(--color-border)',
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle, fontWeight: 700, backgroundColor: 'rgba(30,64,175,0.04)', color: 'var(--color-text-primary)',
  };
  const totalRowStyle: React.CSSProperties = {
    ...cellStyle, fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.02)', color: 'var(--color-text-primary)', fontSize: '14px',
  };

  const charges = lines.filter((l) => l.line_type === 'charge');
  const produits = lines.filter((l) => l.line_type === 'produit');
  const totalChargesP = charges.reduce((s, l) => s + l.amount_previsionnel, 0);
  const totalChargesR = charges.reduce((s, l) => s + l.amount_realise, 0);
  const totalProduitsP = produits.reduce((s, l) => s + l.amount_previsionnel, 0);
  const totalProduitsR = produits.reduce((s, l) => s + l.amount_realise, 0);
  const resultP = totalProduitsP - totalChargesP;
  const resultR = totalProduitsR - totalChargesR;

  function handleStartEdit(line: BudgetLine) {
    setEditingId(line.id);
    setEditValue(line.amount_realise.toString());
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    const val = parseFloat(editValue.replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val)) {
      await onEditRealise(editingId, val);
    }
    setEditingId(null);
  }

  function renderTitleGroup(titleNum: number, titleLabel: string, groupLines: BudgetLine[]) {
    const totalP = groupLines.reduce((s, l) => s + l.amount_previsionnel, 0);
    const totalR = groupLines.reduce((s, l) => s + l.amount_realise, 0);
    const e = ecart(totalP, totalR);
    return (
      <React.Fragment key={titleNum}>
        <tr>
          <td style={{ ...headerCellStyle, paddingLeft: '24px', fontSize: '12px' }}>{titleLabel}</td>
          <td style={{ ...headerCellStyle, textAlign: 'right', fontSize: '12px' }}>{fmt(totalP)}</td>
          <td style={{ ...headerCellStyle, textAlign: 'right', fontSize: '12px' }}>{fmt(totalR)}</td>
          <td style={{ ...headerCellStyle, textAlign: 'right', fontSize: '12px', color: e.color }}>{fmt(e.value)}</td>
          <td style={{ ...headerCellStyle, textAlign: 'right', fontSize: '12px', color: e.color }}>{e.pct.toFixed(1)}%</td>
        </tr>
        {groupLines.map((line) => {
          const le = ecart(line.amount_previsionnel, line.amount_realise);
          return (
            <tr key={line.id}>
              <td style={{ ...cellStyle, paddingLeft: '44px' }}>{line.line_label}</td>
              <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>{fmt(line.amount_previsionnel)}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                {editingId === line.id ? (
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSaveEdit} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                    autoFocus style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-sans)', textAlign: 'right', width: '120px', outline: 'none' }} />
                ) : (
                  <span onClick={() => handleStartEdit(line)} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }} title="Modifier le réalisé">
                    {fmt(line.amount_realise)}
                  </span>
                )}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right', color: le.color }}>{fmt(le.value)}</td>
              <td style={{ ...cellStyle, textAlign: 'right', color: le.color }}>{le.pct.toFixed(1)}%</td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  }

  if (lines.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Aucune ligne budgétaire. Initialisez d'abord l'EPRD pour cette section.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px' }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => onSelectSection(s.id)} style={{
            padding: '8px 16px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
            border: `1px solid ${selectedSectionId === s.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer',
            backgroundColor: selectedSectionId === s.id ? 'var(--color-primary)' : 'var(--color-surface)',
            color: selectedSectionId === s.id ? '#fff' : 'var(--color-text-secondary)',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', width: '36%' }}>Libellé</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', width: '16%' }}>Prévisionnel (€)</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', width: '16%' }}>Réalisé (€)</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', width: '16%' }}>Écart (€)</th>
              <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'right', width: '16%' }}>Écart (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} style={{ ...headerCellStyle, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--color-danger)' }}>CHARGES</td></tr>
            {[1, 2, 3, 4].map((t) => renderTitleGroup(t, CHARGE_TITLES[t], charges.filter((l) => l.title_number === t)))}
            {(() => { const e = ecart(totalChargesP, totalChargesR); return (
              <tr><td style={totalRowStyle}>TOTAL CHARGES</td><td style={{ ...totalRowStyle, textAlign: 'right', color: 'var(--color-danger)' }}>{fmt(totalChargesP)}</td><td style={{ ...totalRowStyle, textAlign: 'right' }}>{fmt(totalChargesR)}</td><td style={{ ...totalRowStyle, textAlign: 'right', color: e.color }}>{fmt(e.value)}</td><td style={{ ...totalRowStyle, textAlign: 'right', color: e.color }}>{e.pct.toFixed(1)}%</td></tr>
            ); })()}

            <tr><td colSpan={5} style={{ height: '12px', border: 'none' }}></td></tr>
            <tr><td colSpan={5} style={{ ...headerCellStyle, fontSize: '14px', letterSpacing: '0.05em', color: 'var(--color-success)' }}>PRODUITS</td></tr>
            {[1, 2, 3].map((t) => renderTitleGroup(t, PRODUIT_TITLES[t], produits.filter((l) => l.title_number === t)))}
            {(() => { const e = ecart(totalProduitsP, totalProduitsR); return (
              <tr><td style={totalRowStyle}>TOTAL PRODUITS</td><td style={{ ...totalRowStyle, textAlign: 'right', color: 'var(--color-success)' }}>{fmt(totalProduitsP)}</td><td style={{ ...totalRowStyle, textAlign: 'right' }}>{fmt(totalProduitsR)}</td><td style={{ ...totalRowStyle, textAlign: 'right', color: e.color }}>{fmt(e.value)}</td><td style={{ ...totalRowStyle, textAlign: 'right', color: e.color }}>{e.pct.toFixed(1)}%</td></tr>
            ); })()}

            <tr><td colSpan={5} style={{ height: '12px', border: 'none' }}></td></tr>
            {(() => { const eR = ecart(resultP, resultR); const bg = resultR >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)'; return (
              <tr>
                <td style={{ ...totalRowStyle, fontSize: '15px', backgroundColor: bg }}>RÉSULTAT</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', fontSize: '15px', backgroundColor: bg, color: resultP >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(resultP)}</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', fontSize: '15px', backgroundColor: bg, color: resultR >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(resultR)}</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', backgroundColor: bg, color: eR.color }}>{fmt(eR.value)}</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', backgroundColor: bg, color: eR.color }}>{eR.pct.toFixed(1)}%</td>
              </tr>
            ); })()}
          </tbody>
        </table>
      </div>
    </>
  );
}
