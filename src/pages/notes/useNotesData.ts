import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDocuments,
  getTemplates,
  createDocument,
  updateDocument,
  deleteDocument,
} from '@/db';
import type { Document, DocType } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { Document, DocType };

export interface NotesFilters {
  docType: DocType | '';
  search: string;
}

export interface NotesData {
  documents: Document[];
  filteredDocuments: Document[];
  templates: Document[];
  loading: boolean;
  error: string | null;
  filters: NotesFilters;
  setFilters: (f: NotesFilters) => void;
  selectedDoc: Document | null;
  selectDoc: (doc: Document | null) => void;
  refresh: () => Promise<void>;
  createFromTemplate: (template: Document) => Promise<Document>;
  createBlankDocument: () => Promise<Document>;
  saveDocument: (id: number, updates: Partial<Document>) => Promise<void>;
  removeDocument: (id: number) => Promise<void>;
}

// ─── Filter helper ────────────────────────────────────────────────────────────

function applyFilters(docs: Document[], filters: NotesFilters): Document[] {
  return docs.filter((d) => {
    if (filters.docType && d.doc_type !== filters.docType) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!d.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotesData(): NotesData {
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [templates, setTemplates]   = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [filters, setFilters]       = useState<NotesFilters>({ docType: '', search: '' });

  const nextMockId = useRef(100);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, tmpl] = await Promise.all([
        getDocuments(undefined, false),
        getTemplates(),
      ]);
      setDocuments(docs);
      setTemplates(tmpl);
    } catch (err) {
      setError(String(err));
      setDocuments([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDocuments = applyFilters(documents, filters);

  const selectDoc = useCallback((doc: Document | null) => {
    setSelectedDoc(doc);
  }, []);

  const createFromTemplate = useCallback(async (template: Document): Promise<Document> => {
    const today = new Date().toISOString().split('T')[0];
    const newDoc: Omit<Document, 'id' | 'created_at'> = {
      title: template.title.replace(/^Modèle — /, '').replace(/^Modèle – /, '') + ` — ${today}`,
      doc_type: template.doc_type,
      content: template.content,
      author_role: template.author_role,
      date: today,
      tags: '',
      is_template: 0,
    };
    try {
      const id = await createDocument(newDoc);
      const created: Document = { ...newDoc, id, created_at: today };
      setDocuments((prev) => [created, ...prev]);
      setSelectedDoc(created);
      return created;
    } catch {
      // Offline fallback
      const id = nextMockId.current++;
      const created: Document = { ...newDoc, id, created_at: today };
      setDocuments((prev) => [created, ...prev]);
      setSelectedDoc(created);
      return created;
    }
  }, []);

  const createBlankDocument = useCallback(async (): Promise<Document> => {
    const today = new Date().toISOString().split('T')[0];
    const newDoc: Omit<Document, 'id' | 'created_at'> = {
      title: 'Nouveau document',
      doc_type: 'note_service',
      content: '',
      author_role: '',
      date: today,
      tags: '',
      is_template: 0,
    };
    try {
      const id = await createDocument(newDoc);
      const created: Document = { ...newDoc, id, created_at: today };
      setDocuments((prev) => [created, ...prev]);
      setSelectedDoc(created);
      return created;
    } catch {
      const id = nextMockId.current++;
      const created: Document = { ...newDoc, id, created_at: today };
      setDocuments((prev) => [created, ...prev]);
      setSelectedDoc(created);
      return created;
    }
  }, []);

  const saveDocument = useCallback(async (id: number, updates: Partial<Document>) => {
    try {
      await updateDocument(id, updates);
    } catch {
      // Offline: just update state
    }
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    setSelectedDoc((prev) =>
      prev?.id === id ? { ...prev, ...updates } : prev
    );
  }, []);

  const removeDocument = useCallback(async (id: number) => {
    try {
      await deleteDocument(id);
    } catch {
      // Offline fallback
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedDoc((prev) => (prev?.id === id ? null : prev));
  }, []);

  return {
    documents,
    filteredDocuments,
    templates,
    loading,
    error,
    filters,
    setFilters,
    selectedDoc,
    selectDoc,
    refresh: loadData,
    createFromTemplate,
    createBlankDocument,
    saveDocument,
    removeDocument,
  };
}
