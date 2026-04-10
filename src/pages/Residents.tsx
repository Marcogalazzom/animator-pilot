import { useState, useEffect, useRef } from 'react';
import {
  Heart, Plus, Search, Trash2, X, ChevronDown, Pencil, Home,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { getResidents, createResident, updateResident, deleteResident } from '@/db/residents';
import type { Resident, ResidentAutonomy } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const AUTONOMY_LEVELS: Record<ResidentAutonomy, { label: string; color: string; bg: string }> = {
  gir1: { label: 'GIR 1', color: '#DC2626', bg: '#FEF2F2' },
  gir2: { label: 'GIR 2', color: '#EA580C', bg: '#FFF7ED' },
  gir3: { label: 'GIR 3', color: '#D97706', bg: '#FFFBEB' },
  gir4: { label: 'GIR 4', color: '#1E40AF', bg: '#EFF6FF' },
  gir5: { label: 'GIR 5', color: '#059669', bg: '#ECFDF5' },
  gir6: { label: 'GIR 6', color: '#059669', bg: '#ECFDF5' },
};

const GIR_KEYS = Object.keys(AUTONOMY_LEVELS) as ResidentAutonomy[];

const MOCK_RESIDENTS: Resident[] = [
  { id: 1, first_name: 'Madeleine', last_name: 'Dubois', room_number: '101', autonomy_level: 'gir4', interests: 'Peinture, musique, lecture', notes: 'Aime les activités créatives', arrival_date: '2024-03-15', created_at: '' },
  { id: 2, first_name: 'Georges', last_name: 'Moreau', room_number: '105', autonomy_level: 'gir3', interests: 'Jardinage, jeux de cartes, pétanque', notes: '', arrival_date: '2023-11-01', created_at: '' },
  { id: 3, first_name: 'Yvette', last_name: 'Laurent', room_number: '203', autonomy_level: 'gir5', interests: 'Chant, couture, cuisine', notes: 'Participante très active', arrival_date: '2025-01-10', created_at: '' },
  { id: 4, first_name: 'Henri', last_name: 'Petit', room_number: '112', autonomy_level: 'gir2', interests: 'Musique douce, lecture à voix haute', notes: 'Adapter les activités — mobilité réduite', arrival_date: '2024-06-20', created_at: '' },
  { id: 5, first_name: 'Simone', last_name: 'Garcia', room_number: '210', autonomy_level: 'gir4', interests: 'Loto, mots croisés, promenade', notes: '', arrival_date: '2025-06-01', created_at: '' },
  { id: 6, first_name: 'Marcel', last_name: 'Bernard', room_number: '108', autonomy_level: 'gir3', interests: 'Histoires, films, jeux de société', notes: 'Ancien menuisier — intéressé par le bricolage', arrival_date: '2024-09-15', created_at: '' },
  { id: 7, first_name: 'Jeannine', last_name: 'Thomas', room_number: '215', autonomy_level: 'gir6', interests: 'Yoga doux, jardinage, photographie', notes: 'Très autonome, peut aider lors des ateliers', arrival_date: '2025-09-01', created_at: '' },
  { id: 8, first_name: 'Raymond', last_name: 'Robert', room_number: '104', autonomy_level: 'gir4', interests: 'Musique, chorale, dominos', notes: '', arrival_date: '2025-02-14', created_at: '' },
];

// ─── Component ───────────────────────────────────────────────

export default function Residents() {
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGir, setFilterGir] = useState<ResidentAutonomy | ''>('');
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
    if (filterGir && r.autonomy_level !== filterGir) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(q)
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
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      room_number: fd.get('room_number') as string,
      autonomy_level: fd.get('autonomy_level') as ResidentAutonomy,
      interests: fd.get('interests') as string,
      notes: fd.get('notes') as string,
      arrival_date: (fd.get('arrival_date') as string) || null,
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
            Suivi des résidents pour l'animation — {residents.length} résidents
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
            type="text" placeholder="Rechercher un nom, chambre, intérêt..." value={search}
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
            value={filterGir}
            onChange={(e) => setFilterGir(e.target.value as ResidentAutonomy | '')}
            style={{
              padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)',
              borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Tous les GIR</option>
            {GIR_KEYS.map((k) => <option key={k} value={k}>{AUTONOMY_LEVELS[k].label}</option>)}
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
          const gir = AUTONOMY_LEVELS[r.autonomy_level];
          return (
            <div key={r.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
              borderLeft: `3px solid ${gir.color}`,
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {r.first_name} {r.last_name}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      <Home size={11} /> Ch. {r.room_number}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: gir.color, backgroundColor: gir.bg, padding: '1px 6px', borderRadius: '4px' }}>
                      {gir.label}
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

              {r.notes && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{r.notes}</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Prénom
                  <input name="first_name" defaultValue={editResident?.first_name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Nom
                  <input name="last_name" defaultValue={editResident?.last_name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Chambre
                  <input name="room_number" defaultValue={editResident?.room_number ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  GIR
                  <select name="autonomy_level" defaultValue={editResident?.autonomy_level ?? 'gir4'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {GIR_KEYS.map((k) => <option key={k} value={k}>{AUTONOMY_LEVELS[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Arrivée
                  <input name="arrival_date" type="date" defaultValue={editResident?.arrival_date ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Centres d'intérêt (séparés par des virgules)
                <input name="interests" defaultValue={editResident?.interests ?? ''} placeholder="Peinture, musique, jardinage..." style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes pour l'animation
                <textarea name="notes" rows={2} defaultValue={editResident?.notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
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
