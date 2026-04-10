import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, Calendar, Mail, Phone, Users,
  Plus, X, ChevronRight, Loader2, Trash2, Square, CheckSquare, FolderKanban,
} from 'lucide-react';
import { getProject, createProject } from '@/db';
import {
  useTutellesData, AUTHORITY_LABELS, AUTHORITY_COLORS,
  EVENT_TYPE_LABELS, STATUS_LABELS, CORR_TYPE_LABELS, CORR_DIR_LABELS, CORR_STATUS_LABELS,
} from './tutelles/useTutellesData';
import type { AuthorityEvent, AuthorityCorrespondence, AuthorityType, EventStatus } from '@/db/types';

// ─── Helpers ─────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

type Tab = 'calendar' | 'events' | 'correspondences';

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px',
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
};

// ═════════════════════════════════════════════════════════════
// Main
// ═════════════════════════════════════════════════════════════

export default function Tutelles() {
  const data = useTutellesData();
  const [tab, setTab] = useState<Tab>('calendar');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateCorr, setShowCreateCorr] = useState(false);

  // Create event form
  const [newEvt, setNewEvt] = useState({ title: '', event_type: 'other', authority: 'ars', date_start: '', notes: '' });

  // Create correspondence form
  const [newCorr, setNewCorr] = useState({
    date: new Date().toISOString().slice(0, 10), direction: 'sent', type: 'letter',
    authority: 'ars', contact_role: '', subject: '', content: '', document_path: '',
  });

  const selectedEvent = useMemo(() =>
    data.events.find((e) => e.id === data.selectedEventId) ?? null,
  [data.events, data.selectedEventId]);

  // ── Handlers ──
  async function handleCreateEvent() {
    if (!newEvt.title.trim()) return;
    await data.addEvent({
      title: newEvt.title.trim(),
      event_type: newEvt.event_type as AuthorityEvent['event_type'],
      authority: newEvt.authority as AuthorityEvent['authority'],
      date_start: newEvt.date_start || '',
      date_end: null, status: 'planned', notes: newEvt.notes,
      is_recurring: 0, recurrence_rule: null, linked_project_id: null,
    });
    setShowCreateEvent(false);
    setNewEvt({ title: '', event_type: 'other', authority: 'ars', date_start: '', notes: '' });
  }

  async function handleCreateCorr() {
    if (!newCorr.subject.trim()) return;
    await data.addCorrespondence({
      event_id: data.selectedEventId,
      date: newCorr.date,
      direction: newCorr.direction as AuthorityCorrespondence['direction'],
      type: newCorr.type as AuthorityCorrespondence['type'],
      authority: newCorr.authority as AuthorityCorrespondence['authority'],
      contact_role: newCorr.contact_role, subject: newCorr.subject.trim(),
      content: newCorr.content, document_path: newCorr.document_path || null,
      status: newCorr.direction === 'sent' ? 'sent' : 'received',
    });
    setShowCreateCorr(false);
    setNewCorr({ date: new Date().toISOString().slice(0, 10), direction: 'sent', type: 'letter', authority: 'ars', contact_role: '', subject: '', content: '', document_path: '' });
  }

  if (data.loading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '40px', color: 'var(--color-text-secondary)' }}><Loader2 size={18} className="animate-spin" /> Chargement...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Relation tutelles</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>ARS, Conseil départemental, HAS</p>
        </div>
        <button onClick={() => setShowCreateEvent(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
          backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px',
          fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}>
          <Plus size={14} /> Nouvel événement
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[null, 'ars', 'cd', 'has', 'prefecture'].map((a) => (
          <button key={a ?? 'all'} onClick={() => data.setFilterAuthority(a as AuthorityType | null)} style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
            border: `1px solid ${data.filterAuthority === a ? (a ? AUTHORITY_COLORS[a] : 'var(--color-primary)') : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer',
            backgroundColor: data.filterAuthority === a ? (a ? AUTHORITY_COLORS[a] : 'var(--color-primary)') : 'var(--color-surface)',
            color: data.filterAuthority === a ? '#fff' : 'var(--color-text-secondary)',
          }}>
            {a ? AUTHORITY_LABELS[a] : 'Toutes'}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'calendar' as Tab, label: 'Calendrier', icon: <Calendar size={14} /> },
          { key: 'events' as Tab, label: 'Événements', icon: <Landmark size={14} /> },
          { key: 'correspondences' as Tab, label: 'Courriers', icon: <Mail size={14} /> },
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
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'calendar' && <CalendarView events={data.events} onSelect={data.setSelectedEventId} />}

      {tab === 'events' && (
        <EventsTable events={data.events} selectedId={data.selectedEventId} onSelect={data.setSelectedEventId} />
      )}

      {tab === 'correspondences' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateCorr(true)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>
              <Plus size={12} /> Nouveau courrier
            </button>
          </div>
          <CorrespondencesTable correspondences={data.correspondences} />
        </>
      )}

      {/* Detail panel */}
      {selectedEvent && (
        <DetailPanel
          event={selectedEvent}
          checklist={data.checklist}
          correspondences={data.correspondences.filter((c) => c.event_id === selectedEvent.id)}
          onClose={() => data.setSelectedEventId(null)}
          onEditEvent={data.editEvent}
          onDeleteEvent={data.removeEvent}
          onAddCheckItem={data.addCheckItem}
          onEditCheckItem={data.editCheckItem}
          onRemoveCheckItem={data.removeCheckItem}
        />
      )}

      {/* Create event modal */}
      {showCreateEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setShowCreateEvent(false)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-sans)', margin: '0 0 16px' }}>Nouvel événement</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Titre</label><input value={newEvt.title} onChange={(e) => setNewEvt({ ...newEvt, title: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select value={newEvt.event_type} onChange={(e) => setNewEvt({ ...newEvt, event_type: e.target.value })} style={inputStyle}>
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Autorité</label>
                  <select value={newEvt.authority} onChange={(e) => setNewEvt({ ...newEvt, authority: e.target.value })} style={inputStyle}>
                    {Object.entries(AUTHORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Date</label><input type="date" value={newEvt.date_start} onChange={(e) => setNewEvt({ ...newEvt, date_start: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Notes</label><textarea value={newEvt.notes} onChange={(e) => setNewEvt({ ...newEvt, notes: e.target.value })} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowCreateEvent(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Annuler</button>
              <button onClick={handleCreateEvent} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Create correspondence modal */}
      {showCreateCorr && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setShowCreateCorr(false)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '24px', width: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-sans)', margin: '0 0 16px' }}>Nouveau courrier</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Date</label><input type="date" value={newCorr.date} onChange={(e) => setNewCorr({ ...newCorr, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Direction</label>
                  <select value={newCorr.direction} onChange={(e) => setNewCorr({ ...newCorr, direction: e.target.value })} style={inputStyle}>
                    {Object.entries(CORR_DIR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select value={newCorr.type} onChange={(e) => setNewCorr({ ...newCorr, type: e.target.value })} style={inputStyle}>
                    {Object.entries(CORR_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Autorité</label>
                  <select value={newCorr.authority} onChange={(e) => setNewCorr({ ...newCorr, authority: e.target.value })} style={inputStyle}>
                    {Object.entries(AUTHORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Interlocuteur (fonction)</label><input value={newCorr.contact_role} onChange={(e) => setNewCorr({ ...newCorr, contact_role: e.target.value })} style={inputStyle} placeholder="Ex: Délégué territorial" /></div>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Objet</label><input value={newCorr.subject} onChange={(e) => setNewCorr({ ...newCorr, subject: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Contenu / Notes</label><textarea value={newCorr.content} onChange={(e) => setNewCorr({ ...newCorr, content: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowCreateCorr(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface)', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Annuler</button>
              <button onClick={handleCreateCorr} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Calendar View
// ═════════════════════════════════════════════════════════════

function CalendarView({ events, onSelect }: { events: AuthorityEvent[]; onSelect: (id: number) => void }) {
  const now = new Date();
  const currentMonth = now.getMonth();

  const eventsByMonth = useMemo(() => {
    const map: Record<number, AuthorityEvent[]> = {};
    for (const e of events) {
      if (!e.date_start) continue;
      const m = new Date(e.date_start).getMonth();
      (map[m] ??= []).push(e);
    }
    return map;
  }, [events]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {MONTHS.map((label, i) => {
        const monthEvents = eventsByMonth[i] ?? [];
        const isCurrent = i === currentMonth;
        return (
          <div key={i} style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '8px', padding: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: isCurrent ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
            minHeight: '100px',
          }}>
            <div style={{
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
              color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-primary)',
              marginBottom: '8px',
            }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {monthEvents.map((e) => (
                <button key={e.id} onClick={() => onSelect(e.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
                  borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.02)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: AUTHORITY_COLORS[e.authority] ?? 'var(--color-text-secondary)',
                  }} />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </span>
                </button>
              ))}
              {monthEvents.length === 0 && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Events Table
// ═════════════════════════════════════════════════════════════

function EventsTable({ events, selectedId, onSelect }: { events: AuthorityEvent[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--color-border)' };

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Événement</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Autorité</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Type</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Date</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Statut</th>
            <th style={{ ...cellStyle, width: '30px' }}></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} onClick={() => onSelect(e.id)} style={{
              cursor: 'pointer', backgroundColor: selectedId === e.id ? 'rgba(30,64,175,0.04)' : undefined,
              transition: 'background-color 0.1s',
            }}>
              <td style={{ ...cellStyle, fontWeight: 500 }}>{e.title}</td>
              <td style={cellStyle}>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: AUTHORITY_COLORS[e.authority], backgroundColor: `color-mix(in srgb, ${AUTHORITY_COLORS[e.authority]} 10%, transparent)` }}>
                  {AUTHORITY_LABELS[e.authority]}
                </span>
              </td>
              <td style={{ ...cellStyle, color: 'var(--color-text-secondary)' }}>{EVENT_TYPE_LABELS[e.event_type]}</td>
              <td style={{ ...cellStyle, color: 'var(--color-text-secondary)' }}>{fmtDate(e.date_start)}</td>
              <td style={cellStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: e.status === 'completed' ? 'var(--color-success)' : e.status === 'cancelled' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                  {STATUS_LABELS[e.status]}
                </span>
              </td>
              <td style={cellStyle}><ChevronRight size={14} style={{ color: 'var(--color-border)' }} /></td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr><td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)', padding: '32px' }}>Aucun événement</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Correspondences Table
// ═════════════════════════════════════════════════════════════

function CorrespondencesTable({ correspondences }: { correspondences: AuthorityCorrespondence[] }) {
  const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)', borderBottom: '1px solid var(--color-border)' };
  const TYPE_ICONS: Record<string, React.ReactNode> = { letter: <Mail size={12} />, email: <Mail size={12} />, meeting: <Users size={12} />, phone: <Phone size={12} /> };

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Date</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Type</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Direction</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Autorité</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Objet</th>
            <th style={{ ...cellStyle, fontWeight: 600, textAlign: 'left' }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {correspondences.map((c) => (
            <tr key={c.id}>
              <td style={cellStyle}>{fmtDate(c.date)}</td>
              <td style={cellStyle}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  {TYPE_ICONS[c.type]} {CORR_TYPE_LABELS[c.type]}
                </span>
              </td>
              <td style={cellStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: c.direction === 'sent' ? 'var(--color-primary)' : 'var(--color-success)' }}>
                  {CORR_DIR_LABELS[c.direction]}
                </span>
              </td>
              <td style={cellStyle}><span style={{ fontSize: '11px', color: AUTHORITY_COLORS[c.authority] }}>{AUTHORITY_LABELS[c.authority]}</span></td>
              <td style={{ ...cellStyle, fontWeight: 500 }}>{c.subject}</td>
              <td style={cellStyle}><span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{CORR_STATUS_LABELS[c.status]}</span></td>
            </tr>
          ))}
          {correspondences.length === 0 && (
            <tr><td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)', padding: '32px' }}>Aucun courrier</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Detail Panel
// ═════════════════════════════════════════════════════════════

interface DetailPanelProps {
  event: AuthorityEvent;
  checklist: import('@/db/types').PreparationChecklist[];
  correspondences: AuthorityCorrespondence[];
  onClose: () => void;
  onEditEvent: (id: number, u: Partial<AuthorityEvent>) => Promise<void>;
  onDeleteEvent: (id: number) => Promise<void>;
  onAddCheckItem: (item: Omit<import('@/db/types').PreparationChecklist, 'id' | 'created_at'>) => Promise<number>;
  onEditCheckItem: (id: number, u: Partial<import('@/db/types').PreparationChecklist>) => Promise<void>;
  onRemoveCheckItem: (id: number) => Promise<void>;
}

function DetailPanel({ event, checklist, correspondences, onClose, onEditEvent, onDeleteEvent, onAddCheckItem, onEditCheckItem, onRemoveCheckItem }: DetailPanelProps) {
  const [newItem, setNewItem] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [linkedProjectTitle, setLinkedProjectTitle] = useState<string | null>(null);
  const [linkingProject, setLinkingProject] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (event.linked_project_id) {
      getProject(event.linked_project_id).then((p) => {
        setLinkedProjectTitle(p ? p.title : null);
      });
    } else {
      setLinkedProjectTitle(null);
    }
  }, [event.linked_project_id]);

  async function handleCreateLinkedProject() {
    setLinkingProject(true);
    try {
      const newId = await createProject({
        title: event.title,
        description: '',
        owner_role: '',
        status: 'todo',
        start_date: null,
        due_date: null,
      });
      await onEditEvent(event.id, { linked_project_id: newId });
      const proj = await getProject(newId);
      setLinkedProjectTitle(proj ? proj.title : event.title);
    } finally {
      setLinkingProject(false);
    }
  }

  async function handleUnlinkProject() {
    await onEditEvent(event.id, { linked_project_id: null });
    setLinkedProjectTitle(null);
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto' };
  const doneCount = checklist.filter((c) => c.is_done).length;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'rgba(0,0,0,0.15)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', zIndex: 91,
        backgroundColor: 'var(--color-surface)', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Color bar */}
        <div style={{ height: '4px', backgroundColor: AUTHORITY_COLORS[event.authority] }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Close button */}
          <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)' }}>
            <X size={18} />
          </button>

          {/* Title */}
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text-primary)', paddingRight: '32px' }}>
            {event.title}
          </h2>

          {/* Event info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Autorité</label>
              <select value={event.authority} onChange={(e) => onEditEvent(event.id, { authority: e.target.value as AuthorityType })} style={selectStyle}>
                {Object.entries(AUTHORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Statut</label>
              <select value={event.status} onChange={(e) => onEditEvent(event.id, { status: e.target.value as EventStatus })} style={selectStyle}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Type</label>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-sans)' }}>{EVENT_TYPE_LABELS[event.event_type]}</span>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Date</label>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-sans)' }}>{fmtDate(event.date_start)}</span>
            </div>
          </div>

          {/* Notes */}
          {event.notes && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Notes</label>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-sans)', margin: 0, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{event.notes}</p>
            </div>
          )}

          {/* Checklist */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={14} /> Checklist de préparation
              </h3>
              {checklist.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                  {doneCount}/{checklist.length}
                </span>
              )}
            </div>
            {checklist.length > 0 && (
              <div style={{ height: '3px', backgroundColor: 'var(--color-border)', borderRadius: '2px', marginBottom: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%`, backgroundColor: 'var(--color-success)', borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {checklist.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <button onClick={() => onEditCheckItem(item.id, { is_done: item.is_done ? 0 : 1 })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.is_done ? 'var(--color-success)' : 'var(--color-text-secondary)', display: 'flex' }}>
                    {item.is_done ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-sans)', flex: 1, textDecoration: item.is_done ? 'line-through' : 'none', color: item.is_done ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                    {item.item_text}
                  </span>
                  <button onClick={() => onRemoveCheckItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-secondary)', opacity: 0.3 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Ajouter un item..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItem.trim()) {
                    onAddCheckItem({ event_id: event.id, item_text: newItem.trim(), is_done: 0, category: '', sort_order: checklist.length });
                    setNewItem('');
                  }
                }}
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { if (newItem.trim()) { onAddCheckItem({ event_id: event.id, item_text: newItem.trim(), is_done: 0, category: '', sort_order: checklist.length }); setNewItem(''); } }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '4px' }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Linked correspondences */}
          {correspondences.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} /> Courriers liés ({correspondences.length})
              </h3>
              {correspondences.map((c) => (
                <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                  <div style={{ fontWeight: 500 }}>{c.subject}</div>
                  <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>{fmtDate(c.date)} · {CORR_DIR_LABELS[c.direction]} · {CORR_TYPE_LABELS[c.type]}</div>
                </div>
              ))}
            </div>
          )}

          {/* Projet lié */}
          <div style={{
            marginBottom: '20px',
            borderRadius: '8px',
            border: event.linked_project_id
              ? '1px solid rgba(22, 163, 74, 0.35)'
              : '1px dashed var(--color-border)',
            borderLeft: event.linked_project_id
              ? '3px solid #16A34A'
              : '3px dashed var(--color-border)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: event.linked_project_id ? 'rgba(22,163,74,0.04)' : 'var(--color-bg)',
          }}>
            <FolderKanban size={15} style={{ color: event.linked_project_id ? '#16A34A' : 'var(--color-text-secondary)', flexShrink: 0 }} />
            {event.linked_project_id && linkedProjectTitle !== null ? (
              <>
                <button
                  onClick={() => navigate('/projects')}
                  style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: '#16A34A' }}
                >
                  {linkedProjectTitle}
                </button>
                <button
                  onClick={handleUnlinkProject}
                  title="Délier le projet"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={handleCreateLinkedProject}
                disabled={linkingProject}
                style={{
                  flex: 1,
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Plus size={12} />
                {linkingProject ? 'Création...' : 'Créer un projet lié'}
              </button>
            )}
          </div>

          {/* Delete */}
          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={() => confirmDel ? onDeleteEvent(event.id) : setConfirmDel(true)} style={{
              padding: '8px 14px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              border: '1px solid var(--color-danger)', borderRadius: '6px', cursor: 'pointer',
              backgroundColor: confirmDel ? 'var(--color-danger)' : 'var(--color-surface)',
              color: confirmDel ? '#fff' : 'var(--color-danger)',
            }}>
              <Trash2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
              {confirmDel ? 'Confirmer la suppression' : 'Supprimer l\'événement'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
