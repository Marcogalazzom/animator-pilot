import { describe, it, expect } from 'vitest';
import type {
  KpiCategory,
  KpiSource,
  ThresholdDirection,
  ProjectStatus,
  ActionStatus,
  ImportStatus,
  KpiEntry,
  KpiThreshold,
  Project,
  Action,
  ImportRecord,
} from '@/db/types';

describe('DB Types', () => {
  describe('KpiCategory', () => {
    it('accepts valid category values', () => {
      const categories: KpiCategory[] = ['occupation', 'finance', 'rh', 'qualite'];
      expect(categories).toHaveLength(4);
      expect(categories).toContain('occupation');
      expect(categories).toContain('finance');
      expect(categories).toContain('rh');
      expect(categories).toContain('qualite');
    });
  });

  describe('ProjectStatus', () => {
    it('accepts valid project status values', () => {
      const statuses: ProjectStatus[] = ['todo', 'in_progress', 'done', 'overdue'];
      expect(statuses).toHaveLength(4);
      expect(statuses).toContain('todo');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('done');
      expect(statuses).toContain('overdue');
    });
  });

  describe('ActionStatus', () => {
    it('accepts valid action status values', () => {
      const statuses: ActionStatus[] = ['todo', 'in_progress', 'done'];
      expect(statuses).toHaveLength(3);
    });
  });

  describe('KpiSource', () => {
    it('accepts valid source values', () => {
      const sources: KpiSource[] = ['manual', 'import'];
      expect(sources).toHaveLength(2);
    });
  });

  describe('ThresholdDirection', () => {
    it('accepts valid direction values', () => {
      const directions: ThresholdDirection[] = ['above', 'below'];
      expect(directions).toHaveLength(2);
    });
  });

  describe('ImportStatus', () => {
    it('accepts valid import status values', () => {
      const statuses: ImportStatus[] = ['success', 'error'];
      expect(statuses).toHaveLength(2);
    });
  });

  describe('KpiEntry shape', () => {
    it('can be constructed with all required fields', () => {
      const entry: KpiEntry = {
        id: 1,
        category: 'occupation',
        indicator: 'taux_occupation',
        value: 95.5,
        period: '2025-01',
        source: 'manual',
        created_at: '2025-01-01T00:00:00.000Z',
      };
      expect(entry.id).toBe(1);
      expect(entry.category).toBe('occupation');
      expect(entry.indicator).toBe('taux_occupation');
      expect(entry.value).toBe(95.5);
      expect(entry.period).toBe('2025-01');
    });
  });

  describe('KpiThreshold shape', () => {
    it('can be constructed with nullable warning/critical', () => {
      const threshold: KpiThreshold = {
        id: 1,
        indicator: 'taux_occupation',
        warning: 85,
        critical: null,
        direction: 'below',
      };
      expect(threshold.warning).toBe(85);
      expect(threshold.critical).toBeNull();
    });
  });

  describe('Project shape', () => {
    it('can be constructed with nullable dates', () => {
      const project: Project = {
        id: 1,
        title: 'Test Project',
        description: 'A test project',
        owner_role: 'directeur',
        status: 'todo',
        start_date: null,
        due_date: '2025-12-31',
        category: '',
        next_action: '',
        created_at: '2025-01-01T00:00:00.000Z',
      };
      expect(project.start_date).toBeNull();
      expect(project.due_date).toBe('2025-12-31');
    });
  });

  describe('Action shape', () => {
    it('can be constructed with correct fields', () => {
      const action: Action = {
        id: 1,
        project_id: 2,
        title: 'Test Action',
        progress: 50,
        due_date: null,
        status: 'in_progress',
        created_at: '2025-01-01T00:00:00.000Z',
      };
      expect(action.progress).toBe(50);
      expect(action.status).toBe('in_progress');
    });
  });

  describe('ImportRecord shape', () => {
    it('can be constructed with correct fields', () => {
      const record: ImportRecord = {
        id: 1,
        filename: 'data.csv',
        imported_at: '2025-01-01T00:00:00.000Z',
        row_count: 42,
        status: 'success',
      };
      expect(record.filename).toBe('data.csv');
      expect(record.row_count).toBe(42);
      expect(record.status).toBe('success');
    });
  });
});
