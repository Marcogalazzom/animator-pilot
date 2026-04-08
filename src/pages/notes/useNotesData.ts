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
    content: '<h1>Note de service</h1><p><strong>Objet :</strong> </p><p><strong>Destinataires :</strong> Ensemble du personnel</p><p><strong>Date d\'effet :</strong> </p><hr><p>Par la présente, il est porté à la connaissance de l\'ensemble du personnel que :</p><p></p><p>Cette note entre en vigueur immédiatement et annule et remplace toute disposition contraire antérieure.</p><p><strong>La Direction</strong></p>',
    author_role: 'Direction',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
  {
    id: -2,
    title: 'Modèle — CR CVS',
    doc_type: 'cr_cvs',
    content: '<h1>Compte-rendu du Conseil de la Vie Sociale</h1><p><strong>Date :</strong> </p><p><strong>Lieu :</strong> Salle de réunion</p><p><strong>Présidents de séance :</strong> </p><hr><h2>Membres présents</h2><ul><li>Représentants des résidents : </li><li>Représentants des familles : </li><li>Représentants du personnel : </li><li>Direction : </li></ul><h2>Ordre du jour</h2><ol><li>Approbation du compte-rendu précédent</li><li>Questions diverses</li></ol><h2>Déroulement de la séance</h2><h3>1. Approbation du compte-rendu précédent</h3><p></p><h3>2. Questions diverses</h3><p></p><h2>Décisions prises</h2><p></p><p><strong>Le secrétaire de séance</strong></p>',
    author_role: 'Secrétaire CVS',
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
    author_role: 'Cadre de santé',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
  {
    id: -4,
    title: 'Modèle — CR Direction',
    doc_type: 'cr_direction',
    content: '<h1>Compte-rendu de réunion de direction</h1><p><strong>Date :</strong> </p><p><strong>Participants :</strong> </p><hr><h2>Ordre du jour</h2><ol><li>Bilan d\'activité</li><li>Points financiers</li><li>Ressources humaines</li><li>Qualité / Projets en cours</li><li>Divers</li></ol><h2>1. Bilan d\'activité</h2><p></p><h2>2. Points financiers</h2><p></p><h2>3. Ressources humaines</h2><p></p><h2>4. Qualité / Projets</h2><p></p><h2>5. Divers</h2><p></p><h2>Décisions</h2><p></p>',
    author_role: 'Direction',
    date: TODAY,
    tags: '',
    is_template: 1,
    created_at: TODAY,
  },
];

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 1,
    title: 'Note de service — Protocole entrées/sorties résidents',
    doc_type: 'note_service',
    content: '<h1>Note de service</h1><p><strong>Objet :</strong> Nouveau protocole entrées et sorties des résidents</p><p><strong>Destinataires :</strong> Ensemble du personnel soignant et administratif</p><p><strong>Date d\'effet :</strong> 01/04/2026</p><hr><p>Par la présente, il est porté à la connaissance de l\'ensemble du personnel que le protocole d\'accueil des nouveaux résidents et de gestion des sorties temporaires est révisé à compter de la date indiquée ci-dessus.</p><p>Les nouvelles procédures sont disponibles dans le classeur qualité.</p><p><strong>La Direction</strong></p>',
    author_role: 'Direction',
    date: '2026-04-01',
    tags: 'protocole,résidents',
    is_template: 0,
    created_at: '2026-04-01',
  },
  {
    id: 2,
    title: 'CR CVS — Mars 2026',
    doc_type: 'cr_cvs',
    content: '<h1>Compte-rendu du Conseil de la Vie Sociale</h1><p><strong>Date :</strong> 15 mars 2026</p><p><strong>Lieu :</strong> Salle de réunion</p><hr><h2>Membres présents</h2><ul><li>3 représentants des résidents</li><li>2 représentants des familles</li><li>Direction et cadre de santé</li></ul><h2>Points abordés</h2><p>Présentation du programme d\'animations du second trimestre. Discussion sur la qualité des repas et retours positifs du groupe.</p>',
    author_role: 'Secrétaire CVS',
    date: '2026-03-15',
    tags: 'cvs,mars',
    is_template: 0,
    created_at: '2026-03-15',
  },
  {
    id: 3,
    title: "CR Réunion d'équipe soignante — Février 2026",
    doc_type: 'cr_equipe',
    content: "<h1>Compte-rendu de réunion d'équipe</h1><p><strong>Date :</strong> 10 février 2026</p><p><strong>Animateur :</strong> Cadre de santé</p><p><strong>Participants :</strong> 12 soignants</p><hr><h2>Points abordés</h2><h3>Organisation du service</h3><p>Révision des plannings de nuit pour le mois de mars. Nouveau protocole de gestion des chutes.</p>",
    author_role: 'Cadre de santé',
    date: '2026-02-10',
    tags: 'équipe,soins',
    is_template: 0,
    created_at: '2026-02-10',
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
