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

// ─── Mock seed data ───────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

const MOCK_TEMPLATES: Document[] = [
  {
    id: -1,
    title: 'Modèle — Note de service',
    doc_type: 'note_service',
    content: '<h1>Note de service</h1><p><strong>Objet :</strong> </p><p><strong>Destinataires :</strong> Ensemble du personnel</p><p><strong>Date d\'effet :</strong> </p><hr><p>Par la présente, il est porté à la connaissance de l\'ensemble du personnel que :</p><p></p><p><strong>La Direction</strong></p>',
    author_role: 'Direction',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
  {
    id: -2,
    title: "Modèle — CR Animation",
    doc_type: 'cr_animation',
    content: "<h1>Compte-rendu d'animation</h1><p><strong>Activité :</strong> </p><p><strong>Date :</strong> </p><p><strong>Animateur/trice :</strong> </p><p><strong>Nombre de participants :</strong> </p><hr><h2>Déroulement</h2><p></p><h2>Observations</h2><p></p><h2>Retours des résidents</h2><p></p><h2>Points d'amélioration</h2><p></p>",
    author_role: 'Animatrice',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
  {
    id: -3,
    title: "Modèle — CR Réunion d'équipe",
    doc_type: 'cr_equipe',
    content: "<h1>Compte-rendu de réunion d'équipe</h1><p><strong>Date :</strong> </p><p><strong>Animateur :</strong> </p><p><strong>Participants :</strong> </p><hr><h2>Points abordés</h2><h3>1. Point sur les résidents</h3><p></p><h3>2. Organisation du service</h3><p></p><h3>3. Questions diverses</h3><p></p><h2>Actions à mener</h2><ul><li></li></ul><p><strong>Prochaine réunion :</strong> </p>",
    author_role: 'Animatrice',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
  {
    id: -4,
    title: 'Modèle — CR Projet animation',
    doc_type: 'cr_projet',
    content: '<h1>Compte-rendu de projet</h1><p><strong>Projet :</strong> </p><p><strong>Date :</strong> </p><p><strong>Responsable :</strong> </p><hr><h2>Avancement</h2><p></p><h2>Budget</h2><p></p><h2>Prochaines étapes</h2><ul><li></li></ul>',
    author_role: 'Animatrice',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
];

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 1,
    title: 'CR Animation — Atelier peinture Mars 2026',
    doc_type: 'cr_animation',
    content: '<h1>Compte-rendu d\'animation</h1><p><strong>Activité :</strong> Atelier peinture aquarelle</p><p><strong>Date :</strong> 15 mars 2026</p><p><strong>Animatrice :</strong> Marie Dupont</p><p><strong>Participants :</strong> 10 résidents</p><hr><h2>Déroulement</h2><p>Séance de 1h30 autour du thème "Paysages de printemps". Très bonne participation, les résidents ont apprécié le choix des couleurs.</p><h2>Retours</h2><p>Mme Dubois souhaite refaire une séance. M. Moreau a demandé un atelier sculpture.</p>',
    author_role: 'Animatrice',
    date: '2026-03-15',
    tags: 'animation,peinture',
    is_template: 0,
    created_at: '2026-03-15',
  },
  {
    id: 2,
    title: "CR Réunion d'équipe animation — Février 2026",
    doc_type: 'cr_equipe',
    content: "<h1>Compte-rendu de réunion d'équipe</h1><p><strong>Date :</strong> 10 février 2026</p><p><strong>Participants :</strong> Équipe animation + bénévoles</p><hr><h2>Points abordés</h2><p>Planning des animations de mars. Organisation de la fête de printemps. Besoins en matériel.</p>",
    author_role: 'Animatrice',
    date: '2026-02-10',
    tags: 'équipe,planning',
    is_template: 0,
    created_at: '2026-02-10',
  },
  {
    id: 3,
    title: 'Note — Programme animations été 2026',
    doc_type: 'note_service',
    content: '<h1>Programme animations été 2026</h1><p>Proposition de programme estival incluant : sorties en extérieur, ateliers jardinage, concerts en plein air, fête de la musique.</p><p>Budget prévisionnel et planning à valider.</p>',
    author_role: 'Animatrice',
    date: '2026-04-01',
    tags: 'été,programme',
    is_template: 0,
    created_at: '2026-04-01',
  },
];

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

  // Track next mock id for offline mode
  const nextMockId = useRef(100);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, tmpl] = await Promise.all([
        getDocuments(undefined, false),
        getTemplates(),
      ]);
      if (docs.length === 0) {
        setDocuments(MOCK_DOCUMENTS);
      } else {
        setDocuments(docs);
      }
      if (tmpl.length === 0) {
        setTemplates(MOCK_TEMPLATES);
      } else {
        setTemplates(tmpl);
      }
    } catch (err) {
      setError(String(err));
      setDocuments(MOCK_DOCUMENTS);
      setTemplates(MOCK_TEMPLATES);
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
