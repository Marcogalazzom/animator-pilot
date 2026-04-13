import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, X, ChevronDown,
  Clock, MapPin, Users, Pencil, Calendar, CheckCircle2,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { getActivities, createActivity, updateActivity, deleteActivity } from '@/db/activities';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import type { Activity, ActivityType, ActivityStatus } from '@/db/types';
import {
  ensureCategoryColors, autoColor, categoryLabel,
  type CategoryColor,
} from '@/db/categoryColors';

// ─── Constants ───────────────────────────────────────────────

const STATUSES: Record<ActivityStatus, { label: string; color: string }> = {
  planned:     { label: 'Planifié',    color: '#1E40AF' },
  in_progress: { label: 'En cours',    color: '#D97706' },
  completed:   { label: 'Terminé',     color: '#059669' },
  cancelled:   { label: 'Annulé',      color: '#DC2626' },
};

const STATUS_KEYS = Object.keys(STATUSES) as ActivityStatus[];

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Component ───────────────────────────────────────────────

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [types, setTypes] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ActivityType | ''>('');
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | ''>('');
  const [filterShared, setFilterShared] = useState<'all' | 'shared' | 'perso'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.add);
  const syncStatus = useSyncStore((s) => s.modules.activities.status);
  const formRef = useRef<HTMLFormElement>(null);

  // Load activities on mount and after sync completes
  useEffect(() => {
    (async () => {
      try {
        const rows = await getActivities();
        setActivities(rows);
        const cats = await ensureCategoryColors('activities', rows.map((r) => r.activity_type));
        setTypes(cats);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [syncStatus]);

  const filtered = activities.filter((a) => {
    if (filterType && a.activity_type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterShared === 'shared' && !a.is_shared) return false;
    if (filterShared === 'perso' && a.is_shared) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const data = {
      title: fd.get('title') as string,
      activity_type: fd.get('activity_type') as ActivityType,
      description: fd.get('description') as string,
      date: fd.get('date') as string,
      time_start: (fd.get('time_start') as string) || null,
      time_end: (fd.get('time_end') as string) || null,
      location: fd.get('location') as string,
      max_participants: parseInt(fd.get('max_participants') as string) || 0,
      actual_participants: parseInt(fd.get('actual_participants') as string) || 0,
      animator_name: fd.get('animator_name') as string,
      status: fd.get('status') as ActivityStatus,
      materials_needed: fd.get('materials_needed') as string,
      notes: fd.get('notes') as string,
      linked_project_id: null,
      is_shared: fd.get('is_shared') === 'on' ? 1 : 0,
      synced_from: '',
      last_sync_at: null,
      external_id: null,
    };

    try {
      if (editId) {
        await updateActivity(editId, data).catch(() => {});
        setActivities((prev) => prev.map((a) => a.id === editId ? { ...a, ...data } : a));
        addToast('Activité mise à jour', 'success');
      } else {
        const id = await createActivity(data).catch(() => Date.now());
        setActivities((prev) => [{ ...data, id: id as number, created_at: new Date().toISOString() } as Activity, ...prev]);
        addToast('Activité créée', 'success');
      }
      const cats = await ensureCategoryColors('activities', [data.activity_type]);
      setTypes(cats);
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }

    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteActivity(id).catch(() => {});
    setActivities((prev) => prev.filter((a) => a.id !== id));
    addToast('Activité supprimée', 'success');
  }

  const editActivity = editId ? activities.find((a) => a.id === editId) : null;

  const upcoming = activities.filter((a) => a.status === 'planned' || a.status === 'in_progress').length;

  const typeMap = new Map(types.map((c) => [c.name, c]));
  function catFor(name: string): CategoryColor {
    const existing = typeMap.get(name);
    if (existing) return existing;
    const { color, bg } = autoColor(name);
    return { module: 'activities', name, color, bg, label: null };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Ateliers & Activités
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0', fontFamily: 'var(--font-sans)' }}>
            Planification et suivi des animations — {upcoming} à venir
          </p>
          <SyncStatus module="activities" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SyncButton module="activities" />
          <button
            onClick={() => { setEditId(null); setShowForm(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', backgroundColor: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Nouvelle activité
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: '6px',
              fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)',
            }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as ActivityType | '')}
            style={{ padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer' }}>
            <option value="">Tous types</option>
            {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ActivityStatus | '')}
            style={{ padding: '8px 28px 8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-sans)', backgroundColor: 'var(--color-surface)', appearance: 'none', cursor: 'pointer' }}>
            <option value="">Tous statuts</option>
            {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUSES[k].label}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-secondary)' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '2px' }}>
          {([['all', 'Toutes'], ['shared', 'Partagées'], ['perso', 'Perso']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilterShared(key)}
              style={{
                padding: '5px 10px', borderRadius: '4px', border: 'none', fontSize: '12px', fontWeight: 500,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
                backgroundColor: filterShared === key ? '#7C3AED' : 'transparent',
                color: filterShared === key ? '#fff' : 'var(--color-text-secondary)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Activities list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Aucune activité trouvée</p>
        ) : filtered.map((a) => {
          const cat = catFor(a.activity_type);
          const status = STATUSES[a.status];
          return (
            <div key={a.id} style={{
              backgroundColor: 'var(--color-surface)', borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px',
              borderLeft: `3px solid ${cat.color}`,
              display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                    {a.title}
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: cat.color, backgroundColor: cat.bg, padding: '1px 6px', borderRadius: '4px' }}>
                    {categoryLabel(cat)}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: status.color }}>
                    {a.status === 'completed' && <CheckCircle2 size={11} style={{ marginRight: '2px', verticalAlign: 'middle' }} />}
                    {status.label}
                  </span>
                  {a.synced_from && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-success)', backgroundColor: 'rgba(5,150,105,0.08)', padding: '1px 5px', borderRadius: '3px' }}>
                      SYNC
                    </span>
                  )}
                  {!a.is_shared && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#D97706', backgroundColor: 'rgba(217,119,6,0.08)', padding: '1px 5px', borderRadius: '3px' }}>
                      PERSO
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Calendar size={11} /> {formatDate(a.date)}
                  </span>
                  {a.time_start && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {a.time_start}{a.time_end ? ` — ${a.time_end}` : ''}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <MapPin size={11} /> {a.location}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Users size={11} /> {a.actual_participants}/{a.max_participants}
                  </span>
                </div>
                {a.description && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{a.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => { setEditId(a.id); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px' }} title="Modifier">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer">
                  <Trash2 size={14} />
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
            padding: '24px', width: '520px', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                {editId ? 'Modifier l\'activité' : 'Nouvelle activité'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Titre
                <input name="title" defaultValue={editActivity?.title ?? ''} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Type
                  <input
                    name="activity_type"
                    list="activity-types"
                    defaultValue={editActivity?.activity_type ?? 'jeux'}
                    placeholder="Tapez ou choisissez..."
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <datalist id="activity-types">
                    {types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
                  </datalist>
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Statut
                  <select name="status" defaultValue={editActivity?.status ?? 'planned'} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUSES[k].label}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Date
                  <input name="date" type="date" defaultValue={editActivity?.date ?? new Date().toISOString().slice(0, 10)} required style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Début
                  <input name="time_start" type="time" defaultValue={editActivity?.time_start ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Fin
                  <input name="time_end" type="time" defaultValue={editActivity?.time_end ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Lieu
                  <input name="location" defaultValue={editActivity?.location ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Max. part.
                  <input name="max_participants" type="number" min="0" defaultValue={editActivity?.max_participants ?? 15} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
                <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                  Présents
                  <input name="actual_participants" type="number" min="0" defaultValue={editActivity?.actual_participants ?? 0} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
                </label>
              </div>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Animateur/trice
                <input name="animator_name" defaultValue={editActivity?.animator_name ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Description
                <textarea name="description" rows={2} defaultValue={editActivity?.description ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Matériel nécessaire
                <input name="materials_needed" defaultValue={editActivity?.materials_needed ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }} placeholder="Pinceaux, papier, enceinte..." />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Notes
                <textarea name="notes" rows={2} defaultValue={editActivity?.notes ?? ''} style={{ width: '100%', padding: '8px 10px', marginTop: '4px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
              </label>
              <label style={{
                fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', borderRadius: '6px',
                backgroundColor: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)',
              }}>
                <input name="is_shared" type="checkbox" defaultChecked={editActivity ? editActivity.is_shared === 1 : true} />
                <span>Activité partagée <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> — visible sur le site planning-ehpad. Décochez pour les réunions ou RDV perso.</span></span>
              </label>
              <button type="submit" style={{
                padding: '10px', backgroundColor: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer', marginTop: '4px',
              }}>
                {editId ? 'Mettre à jour' : 'Créer l\'activité'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
