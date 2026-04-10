import { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, Search, Trash2, X, RefreshCw,
  ChevronDown, Phone, Mail, Pencil, UserCheck, UserX,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import {
  getStaffMembers, createStaffMember, updateStaffMember, deleteStaffMember,
} from '@/db/staff';
import type { StaffMember, StaffRole } from '@/db/types';

// ─── Constants ───────────────────────────────────────────────

const ROLES: Record<StaffRole, { label: string; color: string; bg: string }> = {
  animateur:        { label: 'Animateur/trice',  color: '#1E40AF', bg: '#EFF6FF' },
  aide_soignant:    { label: 'Aide-soignant(e)', color: '#059669', bg: '#ECFDF5' },
  infirmier:        { label: 'Infirmier/ère',    color: '#7C3AED', bg: '#F5F3FF' },
  medecin:          { label: 'Médecin',          color: '#DC2626', bg: '#FEF2F2' },
  psychologue:      { label: 'Psychologue',      color: '#D97706', bg: '#FFFBEB' },
  kinesitherapeute: { label: 'Kinésithérapeute', color: '#0F766E', bg: '#F0FDFA' },
  ergotherapeute:   { label: 'Ergothérapeute',   color: '#0EA5E9', bg: '#F0F9FF' },
  ash:              { label: 'ASH',              color: '#8B5CF6', bg: '#F5F3FF' },
  cuisine:          { label: 'Cuisine',          color: '#EA580C', bg: '#FFF7ED' },
  direction:        { label: 'Direction',        color: '#1E293B', bg: '#F1F5F9' },
  administratif:    { label: 'Administratif',    color: '#64748B', bg: '#F8FAFC' },
  benevole:         { label: 'Bénévole',         color: '#EC4899', bg: '#FDF2F8' },
  other:            { label: 'Autre',            color: '#64748B', bg: '#F1F5F9' },
};

const ROLE_KEYS = Object.keys(ROLES) as StaffRole[];

const MOCK_STAFF: StaffMember[] = [
  { id: 1, first_name: 'Marie', last_name: 'Dupont', role: 'animateur', phone: '06 12 34 56 78', email: 'marie.dupont@ehpad.fr', service: 'Animation', is_available: 1, notes: 'Responsable animation', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 2, first_name: 'Jean', last_name: 'Martin', role: 'aide_soignant', phone: '06 23 45 67 89', email: 'jean.martin@ehpad.fr', service: 'Étage 2', is_available: 1, notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 3, first_name: 'Sophie', last_name: 'Bernard', role: 'infirmier', phone: '06 34 56 78 90', email: 'sophie.bernard@ehpad.fr', service: 'Soins', is_available: 1, notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 4, first_name: 'Pierre', last_name: 'Leroy', role: 'psychologue', phone: '06 45 67 89 01', email: 'pierre.leroy@ehpad.fr', service: 'Bien-être', is_available: 0, notes: 'En congé jusqu\'au 15/04', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 5, first_name: 'Claire', last_name: 'Moreau', role: 'kinesitherapeute', phone: '06 56 78 90 12', email: 'claire.moreau@ehpad.fr', service: 'Rééducation', is_available: 1, notes: '', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
  { id: 6, first_name: 'Jacqueline', last_name: 'Petit', role: 'benevole', phone: '06 67 89 01 23', email: '', service: 'Animation', is_available: 1, notes: 'Disponible mardi et jeudi', synced_from: '', last_sync_at: null, created_at: '' },
  { id: 7, first_name: 'Anne', last_name: 'Robert', role: 'direction', phone: '06 78 90 12 34', email: 'anne.robert@ehpad.fr', service: 'Direction', is_available: 1, notes: 'Directrice', synced_from: 'planning-ehpad', last_sync_at: '2026-04-01', created_at: '' },
];

// ─── Component ───────────────────────────────────────────────

export default function Staff() {
  const [members, setMembers] = useState<StaffMember[]>(MOCK_STAFF);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<StaffRole | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getStaffMembers()
      .then((rows) => { if (rows.length > 0) setMembers(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter((m) => {
    if (filterRole && m.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || m.service.toLowerCase().includes(q);
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
      role: fd.get('role') as StaffRole,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      service: fd.get('service') as string,
      is_available: fd.get('is_available') === 'on' ? 1 : 0,
      notes: fd.get('notes') as string,
      synced_from: '',
      last_sync_at: null,
    };

    try {
      if (editId) {
        await updateStaffMember(editId, data).catch(() => {});
        setMembers((prev) => prev.map((m) => m.id === editId ? { ...m, ...data } : m));
        addToast('Fiche mise à jour', 'success');
      } else {
        const id = await createStaffMember(data).catch(() => Date.now());
        setMembers((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() }, ...prev]);
        addToast('Personnel ajouté', 'success');
      }
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteStaffMember(id).catch(() => {});
    setMembers((prev) => prev.filter((m) => m.id !== id));
    addToast('Fiche supprimée', 'success');
  }

  function openEdit(m: StaffMember) {
    setEditId(m.id);
    setShowForm(true);
  }

  const editMember = editId ? members.find((m) => m.id === editId) : null;
  const syncedCount = members.filter((m) => m.synced_from === 'planning-ehpad').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Annuaire personnel
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Équipe et contacts — {syncedCount > 0 && <span style={{ color: 'var(--color-success)' }}>{syncedCount} synchronisés avec planning-ehpad</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => addToast('Synchronisation avec planning-ehpad...', 'info')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', backgroundColor: 'transparent',
              color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)',
              borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Synchroniser
          </button>
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
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher un nom, service..." value={search}
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
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as StaffRole | '')}
            style={{
              padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)',
              borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Tous les rôles</option>
            {ROLE_KEYS.map((k) => <option key={k} value={k}>{ROLES[k].label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
      </div>

      {/* Staff grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucun résultat</p>
        ) : filtered.map((m) => {
          const role = ROLES[m.role];
          return (
            <div key={m.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
              borderLeft: `3px solid ${role.color}`,
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {m.first_name} {m.last_name}
                  </p>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: role.color, backgroundColor: role.bg, padding: '2px 8px', borderRadius: '4px' }}>
                    {role.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {m.is_available ? (
                    <UserCheck size={14} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <UserX size={14} style={{ color: 'var(--color-danger)' }} />
                  )}
                  {m.synced_from && (
                    <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>SYNC</span>
                  )}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Service : {m.service}
              </p>

              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {m.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={11} /> {m.phone}
                  </span>
                )}
                {m.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={11} /> {m.email}
                  </span>
                )}
              </div>

              {m.notes && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{m.notes}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                <button onClick={() => openEdit(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                  <Trash2 size={13} />
                </button>
              </div>
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
                {editId ? 'Modifier la fiche' : 'Nouveau contact'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Prénom
                  <input name="first_name" defaultValue={editMember?.first_name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Nom
                  <input name="last_name" defaultValue={editMember?.last_name ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Rôle
                  <select name="role" defaultValue={editMember?.role ?? 'animateur'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {ROLE_KEYS.map((k) => <option key={k} value={k}>{ROLES[k].label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Service
                  <input name="service" defaultValue={editMember?.service ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Téléphone
                  <input name="phone" defaultValue={editMember?.phone ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Email
                  <input name="email" type="email" defaultValue={editMember?.email ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input name="is_available" type="checkbox" defaultChecked={editMember ? editMember.is_available === 1 : true} />
                Disponible
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes
                <textarea name="notes" rows={2} defaultValue={editMember?.notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
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
