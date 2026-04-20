import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToastStore } from '@/stores/toastStore';
import { useSyncStore } from '@/stores/syncStore';
import { SyncButton, SyncStatus } from '@/components/SyncIndicator';
import ActivitiesToolbar, { type ActivitiesTab } from './activities/ActivitiesToolbar';
import UpcomingTab from './activities/UpcomingTab';
import PastTab from './activities/PastTab';
import LibraryTab from './activities/LibraryTab';
import ActivityFormModal from './activities/ActivityFormModal';
import { useActivitiesData } from './activities/useActivitiesData';
import { createActivity, updateActivity, getActivity } from '@/db/activities';
import type { Activity } from '@/db/types';

export default function Activities() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as ActivitiesTab) || 'upcoming';
  const setTab = (t: ActivitiesTab) => {
    const next = new URLSearchParams(params); next.set('tab', t); setParams(next, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'scheduled' | 'template'>('scheduled');
  const addToast = useToastStore((s) => s.add);
  const syncStatus = useSyncStore((s) => s.modules.activities.status);

  const data = useActivitiesData();
  // refresh only on sync transition (active → idle), pas au mount
  const prevSyncStatus = useRef(syncStatus);
  useEffect(() => {
    if (prevSyncStatus.current !== 'idle' && syncStatus === 'idle') {
      data.refresh().catch(() => {});
    }
    prevSyncStatus.current = syncStatus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  const counts = {
    upcoming: data.upcoming.length,
    past: data.past.length,
    library: data.templates.length,
  };

  const locations = useMemo(() => {
    const set = new Set<string>();
    [...data.upcoming, ...data.past, ...data.templates].forEach((a) => { if (a.location) set.add(a.location); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [data.upcoming, data.past, data.templates]);

  function openCreate(mode: 'scheduled' | 'template' = 'scheduled') {
    setEditing(null); setFormMode(mode); setShowForm(true);
  }
  function openEdit(a: Activity) {
    setEditing(a); setFormMode(a.is_template === 1 ? 'template' : 'scheduled'); setShowForm(true);
  }

  // Auto-open the edit modal when the URL has ?edit={id} (deep-link from the
  // Calendar click). We clear the param after opening so a page reload doesn't
  // keep re-triggering the modal.
  useEffect(() => {
    const editId = params.get('edit');
    if (!editId) return;
    const id = Number(editId);
    if (!Number.isFinite(id)) return;
    getActivity(id).then((a) => {
      if (a) openEdit(a);
    }).catch(() => {}).finally(() => {
      const next = new URLSearchParams(params); next.delete('edit');
      setParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function handleSubmit(values: Omit<Activity, 'id' | 'created_at'>) {
    try {
      if (editing) {
        await updateActivity(editing.id, values);
        addToast(values.is_template ? 'Modèle mis à jour' : 'Activité mise à jour', 'success');
      } else {
        await createActivity(values);
        addToast(values.is_template ? 'Modèle créé' : 'Activité créée', 'success');
      }
      setShowForm(false); setEditing(null);
      await data.refresh();
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, animation: 'slide-in 0.22s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Planification, suivi et bibliothèque de modèles
          <SyncStatus module="activities" />
        </div>
        <SyncButton module="activities" />
      </div>

      <ActivitiesToolbar
        tab={tab}
        onTabChange={setTab}
        counts={counts}
        search={search}
        onSearchChange={setSearch}
        types={data.types}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        locations={locations}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        onCreate={() => openCreate(tab === 'library' ? 'template' : 'scheduled')}
      />

      {data.loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement…</p>
      ) : tab === 'upcoming' ? (
        <UpcomingTab items={data.upcoming} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onEdit={openEdit} onRefresh={data.refresh} />
      ) : tab === 'past' ? (
        <PastTab items={data.past} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onRefresh={data.refresh} />
      ) : (
        <LibraryTab templates={data.templates} types={data.types} search={search} typeFilter={typeFilter} onCreateTemplate={() => openCreate('template')} onEditTemplate={openEdit} onRefresh={data.refresh} />
      )}

      {showForm && (
        <ActivityFormModal
          initial={editing}
          defaultMode={formMode}
          types={data.types}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
