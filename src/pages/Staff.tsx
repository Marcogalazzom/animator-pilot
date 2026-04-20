import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, X,
  ChevronDown, Phone, Mail, Pencil, UserCheck, UserX,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import {
  getStaffMembers, createStaffMember, updateStaffMember, deleteStaffMember,
} from '@/db/staff';
import {
  ensureCategoryColors, autoColor, categoryLabel,
  type CategoryColor,
} from '@/db/categoryColors';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import type { StaffMember, StaffRole } from '@/db/types';

function formatMoney(v: number | null | undefined): string | null {
  if (v == null) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

// ─── Component ───────────────────────────────────────────────

export default function Staff() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<StaffRole | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.add);
  const syncStatus = useSyncStore((s) => s.modules.staff.status);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getStaffMembers();
        setMembers(rows);
        const cats = await ensureCategoryColors('staff', rows.map((r) => r.role));
        setRoles(cats);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [syncStatus]);

  const roleMap = new Map(roles.map((c) => [c.name, c]));
  function roleFor(name: string): CategoryColor {
    const existing = roleMap.get(name);
    if (existing) return existing;
    const { color, bg } = autoColor(name);
    return { module: 'staff', name, color, bg, label: null };
  }

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

    const num = (k: string): number | null => {
      const v = fd.get(k);
      if (!v) return null;
      const n = parseFloat(v as string);
      return Number.isFinite(n) ? n : null;
    };

    const data = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      role: (fd.get('role') as string) || 'other',
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      service: fd.get('service') as string,
      is_available: fd.get('is_available') === 'on' ? 1 : 0,
      notes: fd.get('notes') as string,
      hourly_rate: num('hourly_rate'),
      session_rate: num('session_rate'),
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    };

    try {
      if (editId) {
        await updateStaffMember(editId, data).catch(() => {});
        setMembers((prev) => prev.map((m) => m.id === editId ? { ...m, ...data } : m));
        addToast('Fiche mise à jour', 'success');
      } else {
        const id = await createStaffMember(data).catch(() => Date.now());
        setMembers((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() } as StaffMember, ...prev]);
        addToast('Personnel ajouté', 'success');
      }
      const cats = await ensureCategoryColors('staff', [data.role]);
      setRoles(cats);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, animation: 'slide-in 0.22s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Équipe et contacts
          {syncedCount > 0 && <span className="chip done">{syncedCount} sync.</span>}
          <SyncStatus module="staff" />
        </div>
        <div style={{ flex: 1 }} />
        <SyncButton module="staff" />
        <button
          className="btn primary"
          onClick={() => { setEditId(null); setShowForm(true); }}
        >
          <Plus size={13} strokeWidth={2.5} /> Ajouter
        </button>
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
            {roles.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
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
          const role = roleFor(m.role);
          const hourly = formatMoney(m.hourly_rate);
          const session = formatMoney(m.session_rate);
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
                    {categoryLabel(role)}
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

              {(hourly || session) && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {hourly && <span><strong style={{ color: 'var(--color-text-primary)' }}>{hourly}</strong> /h</span>}
                  {session && <span><strong style={{ color: 'var(--color-text-primary)' }}>{session}</strong> /séance</span>}
                </div>
              )}

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
                  <input
                    name="role"
                    list="staff-roles"
                    defaultValue={editMember?.role ?? 'animateur'}
                    placeholder="Tapez ou choisissez..."
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <datalist id="staff-roles">
                    {roles.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
                  </datalist>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Tarif horaire (€)
                  <input name="hourly_rate" type="number" step="0.01" min="0" defaultValue={editMember?.hourly_rate ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Tarif séance (€)
                  <input name="session_rate" type="number" step="0.01" min="0" defaultValue={editMember?.session_rate ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
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
