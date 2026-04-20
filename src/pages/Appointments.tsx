import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToastStore } from '@/stores/toastStore';
import AppointmentsToolbar, { type AppointmentsTab } from './appointments/AppointmentsToolbar';
import UpcomingTab from './appointments/UpcomingTab';
import PastTab from './appointments/PastTab';
import AppointmentFormModal from './appointments/AppointmentFormModal';
import { useAppointmentsData } from './appointments/useAppointmentsData';
import { createAppointment, updateAppointment, getAppointment } from '@/db/appointments';
import type { Appointment } from '@/db/types';

export default function Appointments() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as AppointmentsTab) || 'upcoming';
  const setTab = (t: AppointmentsTab) => {
    const next = new URLSearchParams(params); next.set('tab', t); setParams(next, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const addToast = useToastStore((s) => s.add);

  const data = useAppointmentsData();

  const counts = {
    upcoming: data.upcoming.length,
    past: data.past.length,
  };

  const locations = useMemo(() => {
    const set = new Set<string>();
    [...data.upcoming, ...data.past].forEach((a) => { if (a.location) set.add(a.location); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [data.upcoming, data.past]);

  function openCreate() {
    setEditing(null); setShowForm(true);
  }
  function openEdit(a: Appointment) {
    setEditing(a); setShowForm(true);
  }

  // Deep-link from the Calendar: ?edit={id} auto-opens the edit modal.
  useEffect(() => {
    const editId = params.get('edit');
    if (!editId) return;
    const id = Number(editId);
    if (!Number.isFinite(id)) return;
    getAppointment(id).then((a) => {
      if (a) openEdit(a);
    }).catch(() => {}).finally(() => {
      const next = new URLSearchParams(params); next.delete('edit');
      setParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function handleSubmit(values: Omit<Appointment, 'id' | 'created_at'>) {
    try {
      if (editing) {
        await updateAppointment(editing.id, values);
        addToast('Rendez-vous mis à jour', 'success');
      } else {
        await createAppointment(values);
        addToast('Rendez-vous créé', 'success');
      }
      setShowForm(false); setEditing(null);
      await data.refresh();
    } catch {
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, animation: 'slide-in 0.22s ease-out' }}>
      <div className="eyebrow">Réunions, fournisseurs, formations et entretiens</div>

      <AppointmentsToolbar
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
        onCreate={openCreate}
      />

      {data.loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement…</p>
      ) : tab === 'upcoming' ? (
        <UpcomingTab items={data.upcoming} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onEdit={openEdit} onRefresh={data.refresh} />
      ) : (
        <PastTab items={data.past} types={data.types} search={search} typeFilter={typeFilter} locationFilter={locationFilter} onEdit={openEdit} onRefresh={data.refresh} />
      )}

      {showForm && (
        <AppointmentFormModal
          initial={editing}
          types={data.types}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
