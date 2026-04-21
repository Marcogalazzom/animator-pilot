import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, X, Pencil, Home, Cake, Smile, Meh, Moon, Frown, Mail, Layers } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { getResidents, createResident, updateResident, deleteResident } from '@/db/residents';
import { getJournalEntries } from '@/db/journal';
import { getResidenceUnits } from '@/db/settings';
import { tagChipClass } from '@/utils/tagColor';
import { residentMoodFromNotes } from '@/utils/moodFromJournal';
import type { Resident, ResidentMood, JournalEntry } from '@/db/types';

type ParticipationLevel = Resident['participation_level'];

const PARTICIPATION: Record<ParticipationLevel, { label: string; chip: string }> = {
  active:     { label: 'Actif',       chip: 'done' },
  moderate:   { label: 'Modéré',      chip: 'info' },
  occasional: { label: 'Occasionnel', chip: 'warn' },
  observer:   { label: 'Observateur', chip: 'ghost' },
};

const PARTICIPATION_KEYS = Object.keys(PARTICIPATION) as ParticipationLevel[];

const MOOD_META: Record<ResidentMood, { label: string; Icon: typeof Smile; color: string; chip: string }> = {
  happy: { label: 'En forme',  Icon: Smile, color: 'var(--sage-deep)', chip: 'done' },
  calm:  { label: 'Calme',     Icon: Meh,   color: 'var(--sage-deep)', chip: 'done' },
  sleep: { label: 'Endormi',   Icon: Moon,  color: 'var(--ink-4)',     chip: 'ghost' },
  quiet: { label: 'Réservé',   Icon: Frown, color: 'var(--warn)',      chip: 'warn' },
};

const MOOD_KEYS = Object.keys(MOOD_META) as ResidentMood[];

const DAY_FR_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTH_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

function ageFromBirthday(birthday: string | null): number | null {
  if (!birthday || birthday.length < 10) return null;
  const b = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  ) age -= 1;
  return age;
}

function formatArrival(iso: string | null): string {
  if (!iso || iso.length < 10) return '—';
  const d = new Date(iso);
  return `${MONTH_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntilBirthday(birthday: string | null): number | null {
  if (!birthday) return null;
  const md = birthday.length >= 10 ? birthday.slice(5) : birthday;
  const [mm, dd] = md.split('-').map(Number);
  if (!mm || !dd) return null;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), mm - 1, dd);
  candidate.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < today) candidate.setFullYear(now.getFullYear() + 1);
  return Math.round((candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Residents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('');
  const [filterBirthday, setFilterBirthday] = useState<boolean>(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.add);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    Promise.all([
      getResidents().catch((err) => {
        console.error('[residents] load failed:', err);
        addToast('Impossible de charger les résidents', 'error');
        return [] as Resident[];
      }),
      getJournalEntries().catch(() => [] as JournalEntry[]),
      getResidenceUnits().catch(() => [] as string[]),
    ]).then(([r, j, u]) => {
      setResidents(r);
      setJournal(j);
      setUnits(u);
      if (r[0]) setSelectedId(r[0].id);
    }).finally(() => setLoading(false));
  }, [addToast]);

  const filtered = useMemo(() => residents.filter((r) => {
    if (filterUnit && r.unit !== filterUnit) return false;
    if (filterBirthday) {
      const days = daysUntilBirthday(r.birthday);
      if (days === null || days < 0 || days > 7) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return r.display_name.toLowerCase().includes(q)
        || r.room_number.toLowerCase().includes(q)
        || r.interests.toLowerCase().includes(q);
    }
    return true;
  }), [residents, filterUnit, filterBirthday, search]);

  const unitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of residents) counts.set(r.unit, (counts.get(r.unit) ?? 0) + 1);
    return counts;
  }, [residents]);

  const selected = useMemo(
    () => residents.find((r) => r.id === selectedId) ?? null,
    [residents, selectedId],
  );

  const selectedNotes = useMemo(() => {
    if (!selected) return [];
    return journal.filter((e) =>
      e.linked_resident_ids.split(',').map((s) => Number(s.trim())).includes(selected.id)
    );
  }, [journal, selected]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      display_name: fd.get('display_name') as string,
      room_number: fd.get('room_number') as string,
      unit: (fd.get('unit') as string) || '',
      interests: fd.get('interests') as string,
      animation_notes: fd.get('animation_notes') as string,
      participation_level: fd.get('participation_level') as ParticipationLevel,
      birthday: (fd.get('birthday') as string) || null,
      arrival_date: (fd.get('arrival_date') as string) || null,
      mood: (fd.get('mood') as ResidentMood) || 'calm',
      family_contacts: (fd.get('family_contacts') as string) || '',
    };

    try {
      if (editId) {
        await updateResident(editId, data);
        setResidents((prev) => prev.map((r) => r.id === editId ? { ...r, ...data } : r));
        addToast('Fiche mise à jour', 'success');
      } else {
        const id = await createResident(data);
        setResidents((prev) => [{ ...data, id, created_at: new Date().toISOString() }, ...prev]);
        setSelectedId(id);
        addToast('Résident ajouté', 'success');
      }
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      console.error('[residents] save failed:', err);
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteResident(id);
      setResidents((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) setSelectedId(null);
      addToast('Fiche supprimée', 'success');
    } catch (err) {
      console.error('[residents] delete failed:', err);
      addToast('Erreur lors de la suppression', 'error');
    }
  }

  const editResident = editId ? residents.find((r) => r.id === editId) : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 320px) 1fr',
      gap: 20,
      maxWidth: 1400,
      animation: 'slide-in 0.22s ease-out',
    }}>

      {/* ─── List (master) ─── */}
      <div className="card" style={{
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', maxHeight: 'calc(100vh - 180px)',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', borderRadius: 999, padding: '6px 12px',
          }}>
            <Search size={14} style={{ color: 'var(--ink-3)' }} />
            <input
              type="text" placeholder="Nom, chambre, intérêt…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: 'var(--ink)',
              }}
            />
          </div>
          {/* Filter chips — unités (configurables) + anniv cette sem. */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterUnit('')}
              className={filterUnit === '' ? 'chip creative' : 'chip ghost'}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              Tous · {residents.length}
            </button>
            {units.map((u) => {
              const count = unitCounts.get(u) ?? 0;
              return (
                <button
                  key={u}
                  onClick={() => setFilterUnit(u === filterUnit ? '' : u)}
                  className={filterUnit === u ? 'chip creative' : 'chip ghost'}
                  style={{ border: 'none', cursor: 'pointer' }}
                >
                  {u}{count > 0 && ` · ${count}`}
                </button>
              );
            })}
            <button
              onClick={() => setFilterBirthday((v) => !v)}
              className={filterBirthday ? 'chip creative' : 'chip ghost'}
              style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Résidents fêtant leur anniversaire dans les 7 prochains jours"
            >
              <Cake size={11} /> Anniv. cette sem.
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 28, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              Aucun résultat
            </div>
          ) : filtered.map((r) => {
            const active = r.id === selectedId;
            const days = daysUntilBirthday(r.birthday);
            const showCake = days !== null && days >= 0 && days <= 7;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '12px 14px', textAlign: 'left',
                  background: active ? 'var(--terra-soft)' : 'transparent',
                  borderBottom: '1px solid var(--line)',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(ev) => !active && (ev.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(ev) => !active && (ev.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: active ? 'var(--terra)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13,
                  border: active ? 'none' : '1px solid var(--line)',
                  flexShrink: 0,
                }}>
                  {initials(r.display_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: 600, fontSize: 14,
                    color: active ? 'var(--terra-deep)' : 'var(--ink)',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.display_name}
                    </span>
                    {showCake && (
                      <Cake size={13} style={{ color: 'var(--cat-creative)', flexShrink: 0 }} />
                    )}
                  </div>
                  <div className="num" style={{
                    fontSize: 11.5,
                    color: active ? 'var(--terra-deep)' : 'var(--ink-3)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {(() => {
                      const age = ageFromBirthday(r.birthday);
                      const parts = [
                        age != null ? `${age} ans` : null,
                        `ch. ${r.room_number || '—'}`,
                        r.unit || null,
                      ].filter(Boolean);
                      return parts.join(' · ');
                    })()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setEditId(null); setShowForm(true); }}
          >
            <Plus size={13} strokeWidth={2.5} /> Ajouter un résident
          </button>
        </div>
      </div>

      {/* ─── Detail ─── */}
      {selected ? (
        <div className="card" style={{
          padding: 28, overflow: 'auto', maxHeight: 'calc(100vh - 180px)',
        }}>
          <ResidentDetail
            resident={selected}
            notes={selectedNotes}
            allNotes={journal}
            onEdit={() => { setEditId(selected.id); setShowForm(true); }}
            onDelete={() => handleDelete(selected.id)}
          />
        </div>
      ) : (
        <div className="card" style={{
          padding: 60, display: 'grid', placeItems: 'center',
          color: 'var(--ink-3)', fontSize: 14,
        }}>
          {residents.length === 0
            ? "Aucun résident enregistré pour l'instant."
            : 'Sélectionnez un résident dans la liste.'}
        </div>
      )}

      {/* ─── Modal form ─── */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(35, 29, 24, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}
          onClick={() => { setShowForm(false); setEditId(null); }}
        >
          <div
            className="card"
            style={{ padding: 24, width: 580, maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>
                {editId ? 'Modifier la fiche' : 'Nouveau résident'}
              </h2>
              <div style={{ flex: 1 }} />
              <button
                className="btn ghost"
                onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ padding: 6 }}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Prénom ou surnom" required>
                  <input
                    name="display_name"
                    defaultValue={editResident?.display_name ?? ''}
                    required placeholder="Prénom uniquement"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Chambre" icon={<Home size={11} />}>
                  <input
                    name="room_number"
                    defaultValue={editResident?.room_number ?? ''}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="Unité / Étage" icon={<Layers size={11} />}>
                <select
                  name="unit"
                  defaultValue={editResident?.unit ?? ''}
                  style={inputStyle}
                >
                  <option value="">— Non assigné —</option>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Anniversaire" icon={<Cake size={11} />}>
                  <input
                    name="birthday" type="date"
                    defaultValue={editResident?.birthday ?? ''}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Date d'arrivée">
                  <input
                    name="arrival_date" type="date"
                    defaultValue={editResident?.arrival_date ?? ''}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="Niveau de participation">
                <select
                  name="participation_level"
                  defaultValue={editResident?.participation_level ?? 'moderate'}
                  style={inputStyle}
                >
                  {PARTICIPATION_KEYS.map((k) => (
                    <option key={k} value={k}>{PARTICIPATION[k].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Humeur du jour">
                <select
                  name="mood"
                  defaultValue={editResident?.mood ?? 'calm'}
                  style={inputStyle}
                >
                  {MOOD_KEYS.map((k) => (
                    <option key={k} value={k}>{MOOD_META[k].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Centres d'intérêt (séparés par des virgules)">
                <input
                  name="interests"
                  defaultValue={editResident?.interests ?? ''}
                  placeholder="Peinture, musique, jardinage…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Notes pour l'animation">
                <textarea
                  name="animation_notes" rows={3}
                  defaultValue={editResident?.animation_notes ?? ''}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>
              <Field label="Famille & contacts" icon={<Mail size={11} />}>
                <textarea
                  name="family_contacts" rows={3}
                  defaultValue={editResident?.family_contacts ?? ''}
                  placeholder={"Claire (fille) · 06 12 34 56 78\nThomas (petit-fils) · visite mensuelle"}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </Field>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                Aucune donnée médicale ni personnelle sensible n'est stockée. Utilisez uniquement le prénom.
              </p>
              <button type="submit" className="btn primary" style={{ justifyContent: 'center' }}>
                {editId ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail (right panel) ────────────────────────────────────

interface ResidentDetailProps {
  resident: Resident;
  notes: JournalEntry[];
  allNotes: JournalEntry[];
  onEdit: () => void;
  onDelete: () => void;
}

function ResidentDetail({ resident: r, notes, allNotes, onEdit, onDelete }: ResidentDetailProps) {
  const navigate = useNavigate();
  // Humeur du jour : dérivée de la dernière note de journal qui mentionne
  // le résident (fallback = champ `mood` de la fiche).
  const effectiveMood = residentMoodFromNotes(r.id, allNotes, r.mood);
  const moodMeta = MOOD_META[effectiveMood] ?? MOOD_META.calm;
  const age = ageFromBirthday(r.birthday);
  const days = daysUntilBirthday(r.birthday);
  const cakeChip = days !== null && days >= 0 && days <= 7;
  const interests = r.interests.split(',').map((s) => s.trim()).filter(Boolean);
  const topInterests = interests.slice(0, 3);
  const recentNotes = notes.slice(0, 5);

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'var(--sage-soft)', color: 'var(--sage-deep)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 32,
          border: '1px solid var(--line)', flexShrink: 0,
        }}>
          {initials(r.display_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">
            Résident{r.room_number && ` · chambre ${r.room_number}`}{r.unit && ` · ${r.unit}`}
          </div>
          <div className="serif" style={{
            fontSize: 30, fontWeight: 500, letterSpacing: -0.8,
            lineHeight: 1.05, marginTop: 2,
          }}>
            {r.display_name}
          </div>
          {(age !== null || r.arrival_date) && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
              {age !== null && `${age} ans`}
              {age !== null && r.arrival_date && ' · '}
              {r.arrival_date && `arrivée ${formatArrival(r.arrival_date)}`}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <span className={`chip ${moodMeta.chip}`} style={{ alignItems: 'center' }}>
              <moodMeta.Icon size={10} />
              {moodMeta.label}
            </span>
            <span className={`chip ${PARTICIPATION[r.participation_level].chip}`}>
              {PARTICIPATION[r.participation_level].label}
            </span>
            {topInterests.map((it, i) => (
              <span key={i} className={`chip ${tagChipClass(it)}`}>{it}</span>
            ))}
            {cakeChip && (
              <span className="chip creative" style={{ alignItems: 'center' }}>
                <Cake size={10} />
                {days === 0 ? "anniv. aujourd'hui" : days === 1 ? 'anniv. demain' : `anniv. dans ${days}j`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn sm" onClick={onEdit}>
            <Pencil size={12} /> Modifier
          </button>
          <button className="btn sm" onClick={onDelete} style={{ color: 'var(--danger)' }} title="Supprimer">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Body — 2-col grid + full-width participations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Préférences & anecdotes */}
        <div className="card-soft" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Préférences & anecdotes</div>
          {interests.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {interests.map((it, idx) => (
                <span key={idx} className={`chip ${tagChipClass(it)}`}>{it}</span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            {r.animation_notes || (
              <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>
                Aucune anecdote renseignée.
              </span>
            )}
          </div>
        </div>

        {/* Famille & contacts */}
        <div className="card-soft" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={11} /> Famille & contacts
          </div>
          {r.family_contacts ? (
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {r.family_contacts}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              Aucun contact famille renseigné. Cliquez sur « Modifier » pour les ajouter.
            </div>
          )}
        </div>

        {/* Dernières participations — pleine largeur */}
        <div className="card-soft" style={{ padding: 16, gridColumn: '1 / -1' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Dernières participations</div>
          {recentNotes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              Aucune participation enregistrée (les notes du journal qui mentionnent ce résident apparaîtront ici).
            </div>
          ) : (
            <div>
              {recentNotes.map((n, i) => {
                const d = new Date(n.date);
                const dateLabel = `${DAY_FR_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTH_FR[d.getMonth()].slice(0, 4)}.`;
                const cat = n.category ?? 'prep';
                const firstLine = n.content.split('\n')[0] ?? '';
                const excerpt = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
                return (
                  <button
                    key={n.id}
                    onClick={() => navigate(`/journal?note=${n.id}`)}
                    title="Ouvrir la note dans le journal"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr auto',
                      gap: 12, padding: '10px 4px', fontSize: 13, alignItems: 'center',
                      borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                      background: 'transparent', border: 'none',
                      textAlign: 'left', cursor: 'pointer', width: '100%',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                  >
                    <div className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {dateLabel}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title || excerpt || 'Note'}
                      </span>
                      {n.title && excerpt && (
                        <span style={{ color: 'var(--ink-3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          · {excerpt}
                        </span>
                      )}
                    </div>
                    <span className={`chip ${cat}`} style={{ fontSize: 10.5 }}>
                      {cat === 'memory' ? 'mémoire'
                        : cat === 'creative' ? 'créatif'
                        : cat === 'body' ? 'corps'
                        : cat === 'outing' ? 'sortie'
                        : cat === 'rdv' ? 'admin' : 'prépa'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Form bits ───────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
  color: 'var(--ink)', outline: 'none',
};

function Field({ label, icon, required, children }: {
  label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div className="eyebrow" style={{
        display: 'flex', alignItems: 'center', gap: 5,
        marginBottom: 6, color: 'var(--ink-3)',
      }}>
        {icon}{label}{required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </div>
      {children}
    </label>
  );
}
