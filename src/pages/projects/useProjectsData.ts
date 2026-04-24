import { useState, useEffect, useCallback } from 'react';
import {
  getProjects,
  getActions,
  getProjectsProgress,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  createAction as dbCreateAction,
  updateAction as dbUpdateAction,
  deleteAction as dbDeleteAction,
} from '@/db';
import type { Project, Action, ProjectStatus, ActionStatus } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Project, Action, ProjectStatus, ActionStatus };

export interface ProjectsData {
  projects: Project[];
  loading: boolean;
  error: string | null;
  usingMock: boolean;
  // Ratio done/total (%) par project_id, préchargé pour toute la liste
  progressByProjectId: Map<number, number>;
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
  const [progressByProjectId, setProgressByProjectId] = useState<Map<number, number>>(new Map());

  const refreshProgress = useCallback(async () => {
    try {
      setProgressByProjectId(await getProjectsProgress());
    } catch {
      setProgressByProjectId(new Map());
    }
  }, []);

  // ── Load all projects ──
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data] = await Promise.all([getProjects(), refreshProgress()]);
      setProjects(data);
      setUsingMock(false);
    } catch (err) {
      setError(String(err));
      setProjects([]);
      setUsingMock(false);
    } finally {
      setLoading(false);
    }
  }, [refreshProgress]);

  // ── Load actions for selected project ──
  const loadActions = useCallback(async (project: Project) => {
    setActionsLoading(true);
    try {
      const data = await getActions(project.id);
      setSelectedActions(data);
    } catch {
      setSelectedActions([]);
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
    await refreshProgress();
  }, [refreshProgress]);

  const updateAction = useCallback(async (id: number, updates: Partial<Action>) => {
    await dbUpdateAction(id, updates);
    setSelectedActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    await refreshProgress();
  }, [refreshProgress]);

  const deleteAction = useCallback(async (id: number) => {
    await dbDeleteAction(id);
    setSelectedActions(prev => prev.filter(a => a.id !== id));
    await refreshProgress();
  }, [refreshProgress]);

  return {
    projects,
    loading,
    error,
    usingMock,
    progressByProjectId,
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
