import { useState, useEffect, useRef } from 'react';
import {
  Heart, Plus, Search, Trash2, X, ChevronDown, Pencil, Home,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { getResidents, createResident, updateResident, deleteResident } from '@/db/residents';
import type { Resident } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

type ParticipationLevel = Resident['participation_level'];

const PARTICIPATION: Record<ParticipationLevel, { label: string; color: string; bg: string }> = {
  active:     { label: 'Actif',       color: '#059669', bg: '#ECFDF5' },
  moderate:   { label: 'Modéré',      color: '#1E40AF', bg: '#EFF6FF' },
  occasional: { label: 'Occasionnel', color: '#D97706', bg: '#FFFBEB' },
  observer:   { label: 'Observateur', color: '#64748B', bg: '#F1F5F9' },
};

const PARTICIPATION_KEYS = Object.keys(PARTICIPATION) as ParticipationLevel[];

const MOCK_RESIDENTS: Resident[] = [
  { id: 1, display_name: 'Madeleine', room_number: '101', interests: 'Peinture, musique, lecture', animation_notes: 'Aime les activités créatives', participation_level: 'active', created_at: '' },
  { id: 2, display_name: 'Georges', room_number: '105', interests: 'Jardinage, jeux de cartes, pétanque', animation_notes: '', participation_level: 'active', created_at: '' },
  { id: 3, display_name: 'Yvette', room_number: '203', interests: 'Chant, couture, cuisine', animation_notes: 'Participante très active, peut aider', participation_level: 'active', created_at: '' },
  { id: 4, display_name: 'Henri', room_number: '112', interests: 'Musique douce, lecture à voix haute', animation_notes: 'Adapter les activités — mobilité réduite', participation_level: 'occasional', created_at: '' },
  { id: 5, display_name: 'Simone', room_number: '210', interests: 'Loto, mots croisés, promenade', animation_notes: '', participation_level: 'moderate', created_at: '' },
  { id: 6, display_name: 'Marcel', room_number: '108', interests: 'Histoires, films, jeux de société', animation_notes: 'Ancien menuisier — intéressé par le bricolage', participation_level: 'moderate', created_at: '' },
  { id: 7, display_name: 'Jeannine', room_number: '215', interests: 'Yoga doux, jardinage, photographie', animation_notes: 'Très autonome, peut aider lors des ateliers', participation_level: 'active', created_at: '' },
  { id: 8, display_name: 'Raymond', room_number: '104', interests: 'Musique, chorale, dominos', animation_notes: '', participation_level: 'moderate', created_at: '' },
];

// ─── Component ───────────────────────────────────────────────

export default function Residents() {
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterParticipation, setFilterParticipation] = useState<ParticipationLevel | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getResidents()
      .then((rows) => { if (rows.length > 0) setResidents(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = residents.filter((r) => {
    if (filterParticipation && r.participation_level !== filterParticipation) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.display_name.toLowerCase().includes(q)
        || r.room_number.toLowerCase().includes(q)
        || r.interests.toLowerCase().includes(q);
    }
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      display_name: fd.get('display_name') as string,
      room_number: fd.get('room_number') as string,
      interests: fd.get('interests') as string,
      animation_notes: fd.get('animation_notes') as string,
      participation_level: fd.get('participation_level') as ParticipationLevel,
    };

    try {
      if (editId) {
        await updateResident(editId, data).catch(() => {});
        setResidents((prev) => prev.map((r) => r.id === editId ? { ...r, ...data } : r));
        addToast('Fiche mise à jour', 'success');
      } else {
        const id = await createResident(data).catch(() => Date.now());
        setResidents((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Résident ajouté', 'success');
      }
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteResident(id).catch(() => {});
    setResidents((prev) => prev.filter((r) => r.id !== id));
    addToast('Fiche supprimée', 'success');
  }

  const editResident = editId ? residents.find((r) => r.id === editId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Résidents
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Suivi pour l'animation — {residents.length} résidents (prénoms uniquement, aucune donnée médicale)
          </p>
        </div>
        <button
          onClick={() => { setEditId(null); setShowForm(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', backgroundColor: 'var(--color-primary)',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher un prénom, chambre, intérêt..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)',
            }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={filterParticipation}
            onChange={(e) => setFilterParticipation(e.target.value as ParticipationLevel | '')}
            style={{
              padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)',
              borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Tous niveaux</option>
            {PARTICIPATION_KEYS.map((k) => <option key={k} value={k}>{PARTICIPATION[k].label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
      </div>

      {/* Resident grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucun résultat</p>
        ) : filtered.map((r) => {
          const lvl = PARTICIPATION[r.participation_level];
          return (
            <div key={r.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
              borderLeft: `3px solid ${lvl.color}`,
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {r.display_name}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      <Home size={11} /> Ch. {r.room_number}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: lvl.color, backgroundColor: lvl.bg, padding: '1px 6px', borderRadius: '4px' }}>
                      {lvl.label}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setEditId(r.id); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {r.interests && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {r.interests.split(',').map((interest, i) => (
                    <span key={i} style={{
                      fontSize: '11px', color: 'var(--color-primary)',
                      backgroundColor: 'rgba(30,64,175,0.08)', padding: '2px 6px',
                      borderRadius: '4px', fontWeight: 500,
                    }}>
                      {interest.trim()}
                    </span>
                  ))}
                </div>
              )}

              {r.animation_notes && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{r.animation_notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }} onClick={() => { setShowForm(false); setEditId(null); }}>
          <div style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '12px',
            padding: '24px', width: '480px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier la fiche' : 'Nouveau résident'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Prénom ou surnom
                  <input name="display_name" defaultValue={editResident?.display_name ?? ''} required placeholder="Prénom uniquement" style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Chambre
                  <input name="room_number" defaultValue={editResident?.room_number ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Niveau de participation
                <select name="participation_level" defaultValue={editResident?.participation_level ?? 'moderate'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                  {PARTICIPATION_KEYS.map((k) => <option key={k} value={k}>{PARTICIPATION[k].label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Centres d'intérêt (séparés par des virgules)
                <input name="interests" defaultValue={editResident?.interests ?? ''} placeholder="Peinture, musique, jardinage..." style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes pour l'animation
                <textarea name="animation_notes" rows={2} defaultValue={editResident?.animation_notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                Aucune donnée médicale ni personnelle sensible n'est stockée. Utilisez uniquement le prénom.
              </p>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
