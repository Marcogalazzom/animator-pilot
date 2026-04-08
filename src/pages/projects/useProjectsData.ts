import { useState, useEffect, useCallback } from 'react';
import {
  getProjects,
  getActions,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  createAction as dbCreateAction,
  updateAction as dbUpdateAction,
  deleteAction as dbDeleteAction,
} from '@/db';
import type { Project, Action, ProjectStatus, ActionStatus } from '@/db/types';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'Mise à jour protocole hygiène',
    description: 'Révision complète des protocoles d\'hygiène en accord avec les nouvelles réglementations HAS.',
    owner_role: 'Infirmier coordinateur',
    status: 'in_progress',
    start_date: '2026-01-10',
    due_date: '2026-04-30',
    created_at: '2026-01-10',
  },
  {
    id: 2,
    title: 'Formation gestes barrières',
    description: 'Programme de formation obligatoire pour l\'ensemble du personnel soignant.',
    owner_role: 'Directeur RH',
    status: 'overdue',
    start_date: '2025-10-01',
    due_date: '2026-02-28',
    created_at: '2025-10-01',
  },
  {
    id: 3,
    title: 'Renouvellement matériel médical',
    description: 'Acquisition de nouveaux équipements médicaux conformes aux normes en vigueur.',
    owner_role: 'Directeur administratif',
    status: 'todo',
    start_date: null,
    due_date: '2026-06-30',
    created_at: '2026-02-01',
  },
  {
    id: 4,
    title: 'Bilan qualité annuel',
    description: 'Préparation et soumission du rapport qualité annuel à l\'ARS.',
    owner_role: 'Responsable qualité',
    status: 'done',
    start_date: '2025-12-01',
    due_date: '2026-01-31',
    created_at: '2025-12-01',
  },
];

const MOCK_ACTIONS: Record<number, Action[]> = {
  1: [
    { id: 1, project_id: 1, title: 'Audit des protocoles existants', progress: 100, due_date: '2026-01-31', status: 'done', created_at: '2026-01-10' },
    { id: 2, project_id: 1, title: 'Rédaction des nouveaux protocoles', progress: 60, due_date: '2026-03-15', status: 'in_progress', created_at: '2026-01-15' },
    { id: 3, project_id: 1, title: 'Validation par le médecin coordinateur', progress: 0, due_date: '2026-04-01', status: 'todo', created_at: '2026-01-15' },
    { id: 4, project_id: 1, title: 'Formation du personnel', progress: 0, due_date: '2026-04-20', status: 'todo', created_at: '2026-01-15' },
  ],
  2: [
    { id: 5, project_id: 2, title: 'Identification des formateurs', progress: 100, due_date: '2025-10-31', status: 'done', created_at: '2025-10-01' },
    { id: 6, project_id: 2, title: 'Création du contenu pédagogique', progress: 80, due_date: '2025-12-15', status: 'in_progress', created_at: '2025-10-15' },
    { id: 7, project_id: 2, title: 'Sessions de formation', progress: 20, due_date: '2026-02-15', status: 'in_progress', created_at: '2025-11-01' },
  ],
  3: [
    { id: 8, project_id: 3, title: 'Analyse des besoins', progress: 0, due_date: '2026-03-31', status: 'todo', created_at: '2026-02-01' },
    { id: 9, project_id: 3, title: 'Appel d\'offres fournisseurs', progress: 0, due_date: '2026-04-30', status: 'todo', created_at: '2026-02-01' },
  ],
  4: [
    { id: 10, project_id: 4, title: 'Collecte des données', progress: 100, due_date: '2026-01-10', status: 'done', created_at: '2025-12-01' },
    { id: 11, project_id: 4, title: 'Rédaction du rapport', progress: 100, due_date: '2026-01-20', status: 'done', created_at: '2025-12-10' },
    { id: 12, project_id: 4, title: 'Soumission à l\'ARS', progress: 100, due_date: '2026-01-31', status: 'done', created_at: '2026-01-15' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Project, Action, ProjectStatus, ActionStatus };

export interface ProjectsData {
  projects: Project[];
  loading: boolean;
  error: string | null;
  usingMock: boolean;
  // Selected project & its actions
  selectedProject: Project | null;
  selectedActions: Action[];
  actionsLoading: boolean;
  // Actions
  selectProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (data: Omit<Project, 'id' | 'created_at'>) => Promise<void>;
  updateProject: (id: number, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  createAction: (data: Omit<Action, 'id' | 'created_at'>) => Promise<void>;
  updateAction: (id: number, updates: Partial<Action>) => Promise<void>;
  deleteAction: (id: number) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectsData(): ProjectsData {
  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [usingMock, setUsingMock]     = useState(false);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedActions, setSelectedActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading]   = useState(false);

  // ── Load all projects ──
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      if (data.length === 0) {
        setProjects(MOCK_PROJECTS);
        setUsingMock(true);
      } else {
        setProjects(data);
        setUsingMock(false);
      }
    } catch (err) {
      setError(String(err));
      setProjects(MOCK_PROJECTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load actions for selected project ──
  const loadActions = useCallback(async (project: Project) => {
    setActionsLoading(true);
    try {
      if (MOCK_ACTIONS[project.id] !== undefined && project.id <= 4) {
        // Use mock if we know this is a mock project id
        const data = await getActions(project.id).catch(() => null);
        if (data && data.length > 0) {
          setSelectedActions(data);
        } else {
          setSelectedActions(MOCK_ACTIONS[project.id] ?? []);
        }
      } else {
        const data = await getActions(project.id);
        setSelectedActions(data);
      }
    } catch {
      setSelectedActions(MOCK_ACTIONS[project.id] ?? []);
    } finally {
      setActionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // When selected project changes, load its actions
  useEffect(() => {
    if (selectedProject) {
      loadActions(selectedProject);
    } else {
      setSelectedActions([]);
    }
  }, [selectedProject, loadActions]);

  // ── Select project ──
  const selectProject = useCallback((project: Project | null) => {
    setSelectedProject(project);
  }, []);

  // ── CRUD: Projects ──
  const createProject = useCallback(async (data: Omit<Project, 'id' | 'created_at'>) => {
    await dbCreateProject(data);
    await loadProjects();
  }, [loadProjects]);

  const updateProject = useCallback(async (id: number, updates: Partial<Project>) => {
    await dbUpdateProject(id, updates);
    // Optimistic: update local state
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (selectedProject?.id === id) {
      setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedProject]);

  const deleteProject = useCallback(async (id: number) => {
    await dbDeleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProject?.id === id) {
      setSelectedProject(null);
    }
  }, [selectedProject]);

  // ── CRUD: Actions ──
  const createAction = useCallback(async (data: Omit<Action, 'id' | 'created_at'>) => {
    const newId = await dbCreateAction(data);
    const newAction: Action = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
    };
    setSelectedActions(prev => [...prev, newAction]);
  }, []);

  const updateAction = useCallback(async (id: number, updates: Partial<Action>) => {
    await dbUpdateAction(id, updates);
    setSelectedActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const deleteAction = useCallback(async (id: number) => {
    await dbDeleteAction(id);
    setSelectedActions(prev => prev.filter(a => a.id !== id));
  }, []);

  return {
    projects,
    loading,
    error,
    usingMock,
    selectedProject,
    selectedActions,
    actionsLoading,
    selectProject,
    refreshProjects: loadProjects,
    createProject,
    updateProject,
    deleteProject,
    createAction,
    updateAction,
    deleteAction,
  };
}
