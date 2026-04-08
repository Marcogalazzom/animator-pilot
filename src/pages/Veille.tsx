import { useState } from 'react';
import { BookOpen, Plus, ExternalLink, Eye, EyeOff, Loader2, GraduationCap, Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { useVeilleData, WATCH_LABELS, WATCH_COLORS, TRAINING_LABELS } from './veille/useVeilleData';
import type { WatchCategory } from '@/db/types';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px',
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
};

type Tab = 'library' | 'training';

export default function Veille() {
  const data = useVeilleData();
  const [tab, setTab] = useState<Tab>('library');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddTraining, setShowAddTraining] = useState(false);

  // New item form
  const [ni, setNi] = useState({ title: '', category: 'legislation', source: '', url: '', date_published: '', summary: '' });
  // New training form
  const [nt, setNt] = useState({ title: '', category: 'securite', hours_planned: '', hours_completed: '0', notes: '' });

  const unreadCount = data.items.filter((i) => !i.is_read).length;
  const totalHoursPlanned = data.trainings.reduce((s, t) => s + t.hours_planned, 0);
  const totalHoursCompleted = data.trainings.reduce((s, t) => s + t.hours_completed, 0);
  const completionRate = totalHoursPlanned > 0 ? (totalHoursCompleted / totalHoursPlanned) * 100 : 0;

  async function handleAddItem() {
    if (!ni.title.trim()) return;
    await data.addItem({
      title: ni.title.trim(), category: ni.category as WatchCategory, source: ni.source,
      url: ni.url, date_published: ni.date_published || null, summary: ni.summary, is_read: 0,
    });
    setShowAddItem(false);
    setNi({ title: '', category: 'legislation', source: '', url: '', date_published: '', summary: '' });
  }

  async function handleAddTraining() {
    if (!nt.title.trim()) return;
    await data.addTraining({
      title: nt.title.trim(), category: nt.category,
      hours_planned: parseFloat(nt.hours_planned) || 0,
      hours_completed: parseFloat(nt.hours_completed) || 0,
      fiscal_year: data.trainingYear, notes: nt.notes,
    });
    setShowAddTraining(false);
    setNt({ title: '', category: 'securite', hours_planned: '', hours_completed: '0', notes: '' });
  }

  if (data.loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '40px', color: 'var(--color-text-secondary)' }}><Loader2 size={18} className="animate-spin" /> Chargement...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Veille réglementaire</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>Bibliothèque réglementaire et suivi des formations</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'library' as Tab, label: 'Bibliothèque', icon: <BookOpen size={14} /> },
          { key: 'training' as Tab, label: 'Formations', icon: <GraduationCap size={14} /> },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 20px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
            border: 'none', background: 'none', cursor: 'pointer',
            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
          }}>
            {t.icon} {t.label}
            {t.key === 'library' && unreadCount > 0 && (
              <span style={{ backgroundColor: 'var(--color-danger)', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '8px', padding: '1px 6px', lineHeight: '16px' }}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Bibliothèque ── */}
      {tab === 'library' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[null, 'legislation', 'has_recommendation', 'ars_circular', 'formation', 'other'].map((c) => (
              <button key={c ?? 'all'} onClick={() => data.setFilterCategory(c as WatchCategory | null)} style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                border: `1px solid ${data.filterCategory === c ? (c ? WATCH_COLORS[c] : 'var(--color-primary)') : 'var(--color-border)'}`,
                borderRadius: '6px', cursor: 'pointer',
                backgroundColor: data.filterCategory === c ? (c ? WATCH_COLORS[c] : 'var(--color-primary)') : 'var(--color-surface)',
                color: data.filterCategory === c ? '#fff' : 'var(--color-text-secondary)',
              }}>
                {c ? WATCH_LABELS[c] : 'Toutes'}
              </button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => setShowAddItem(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                <Plus size={14} /> Nouvel article
              </button>
            </div>
          </div>

          {/* Items */}
          {data.items.length === 0 ? (
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <BookOpen size={36} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Aucun article dans la bibliothèque.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.items.map((item) => (
                <div key={item.id} style={{
                  backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${WATCH_COLORS[item.category] ?? 'var(--color-border)'}`,
                  opacity: item.is_read ? 0.7 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{item.title}</span>
                        <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, color: WATCH_COLORS[item.category], backgroundColor: `color-mix(in srgb, ${WATCH_COLORS[item.category]} 10%, transparent)` }}>
                          {WATCH_LABELS[item.category]}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '6px' }}>
                        {item.source && <span>{item.source} · </span>}{fmtDate(item.date_published)}
                      </div>
                      {item.summary && <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px', borderRadius: '4px', color: 'var(--color-primary)', display: 'flex' }} title="Ouvrir le lien">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => data.editItem(item.id, { is_read: item.is_read ? 0 : 1 })} style={{ padding: '6px', borderRadius: '4px', background: 'none', border: 'none', cursor: 'pointer', color: item.is_read ? 'var(--color-success)' : 'var(--color-text-secondary)', display: 'flex' }} title={item.is_read ? 'Marquer non lu' : 'Marquer lu'}>
                        {item.is_read ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => data.removeItem(item.id)} style={{ padding: '6px', borderRadius: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', opacity: 0.4, display: 'flex' }} title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add item modal */}
          {showAddItem && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setShowAddItem(false)} />
              <div style={{ position: 'relative', backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-sans)', margin: '0 0 16px' }}>Nouvel article</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Titre</label><input value={ni.title} onChange={(e) => setNi({ ...ni, title: e.target.value })} style={inputStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Catégorie</label>
                      <select value={ni.category} onChange={(e) => setNi({ ...ni, category: e.target.value })} style={inputStyle}>{Object.entries(WATCH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Source</label><input value={ni.source} onChange={(e) => setNi({ ...ni, source: e.target.value })} style={inputStyle} placeholder="Légifrance, HAS..." /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>URL</label><input value={ni.url} onChange={(e) => setNi({ ...ni, url: e.target.value })} style={inputStyle} placeholder="https://..." /></div>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Date publication</label><input type="date" value={ni.date_published} onChange={(e) => setNi({ ...ni, date_published: e.target.value })} style={inputStyle} /></div>
                  </div>
                  <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Résumé</label><textarea value={ni.summary} onChange={(e) => setNi({ ...ni, summary: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button onClick={() => setShowAddItem(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Annuler</button>
                  <button onClick={handleAddItem} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Créer</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Formations ── */}
      {tab === 'training' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Heures planifiées</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{totalHoursPlanned}h</div>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Heures réalisées</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-sans)', color: 'var(--color-success)' }}>{totalHoursCompleted}h</div>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginBottom: '4px' }}>Taux de réalisation</div>
              <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-sans)', color: completionRate >= 80 ? 'var(--color-success)' : completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{completionRate.toFixed(0)}%</div>
              <div style={{ height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(completionRate, 100)}%`, backgroundColor: completionRate >= 80 ? 'var(--color-success)' : completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)', borderRadius: '2px' }} />
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button onClick={() => setShowAddTraining(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px',
                fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}>
                <Plus size={14} /> Nouvelle formation
              </button>
            </div>
          </div>

          {/* Training list */}
          {data.trainings.length === 0 ? (
            <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <GraduationCap size={36} style={{ color: 'var(--color-border)', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Aucune formation pour cet exercice.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.trainings.map((t) => {
                const pct = t.hours_planned > 0 ? (t.hours_completed / t.hours_planned) * 100 : 0;
                return (
                  <div key={t.id} style={{
                    backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{t.title}</span>
                        {t.category && <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)', backgroundColor: 'rgba(0,0,0,0.04)' }}>{TRAINING_LABELS[t.category] ?? t.category}</span>}
                      </div>
                      <button onClick={() => data.removeTraining(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)', opacity: 0.4 }}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{t.hours_completed}h / {t.hours_planned}h</span>
                      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-primary)' : 'var(--color-warning)', borderRadius: '2px' }} />
                      </div>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                    </div>
                    {t.notes && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '6px 0 0', fontFamily: 'var(--font-sans)' }}>{t.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add training modal */}
          {showAddTraining && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setShowAddTraining(false)} />
              <div style={{ position: 'relative', backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-sans)', margin: '0 0 16px' }}>Nouvelle formation</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Titre</label><input value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} style={inputStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Catégorie</label>
                      <select value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value })} style={inputStyle}>{Object.entries(TRAINING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Heures planifiées</label><input type="number" value={nt.hours_planned} onChange={(e) => setNt({ ...nt, hours_planned: e.target.value })} style={inputStyle} /></div>
                  </div>
                  <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Notes</label><textarea value={nt.notes} onChange={(e) => setNt({ ...nt, notes: e.target.value })} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button onClick={() => setShowAddTraining(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Annuler</button>
                  <button onClick={handleAddTraining} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Créer</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
