import { useState, useEffect, useCallback } from 'react';
import {
  getBudgetSections,
  getBudgetLines,
  createBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  getBudgetSummary,
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '@/db';
import type { BudgetSection, BudgetLine, BudgetLineType, Investment } from '@/db/types';

// ─── Template lines for new fiscal years ─────────────────────

interface TemplateLine {
  title_number: number;
  line_type: BudgetLineType;
  line_label: string;
}

const TEMPLATE_LINES: TemplateLine[] = [
  // Charges
  { title_number: 1, line_type: 'charge', line_label: 'Salaires et traitements' },
  { title_number: 1, line_type: 'charge', line_label: 'Charges sociales' },
  { title_number: 1, line_type: 'charge', line_label: 'Personnel intérimaire' },
  { title_number: 1, line_type: 'charge', line_label: 'Formation' },
  { title_number: 2, line_type: 'charge', line_label: 'Médicaments' },
  { title_number: 2, line_type: 'charge', line_label: 'Dispositifs médicaux' },
  { title_number: 2, line_type: 'charge', line_label: 'Laboratoire' },
  { title_number: 3, line_type: 'charge', line_label: 'Alimentation' },
  { title_number: 3, line_type: 'charge', line_label: 'Entretien et réparations' },
  { title_number: 3, line_type: 'charge', line_label: 'Énergie et fluides' },
  { title_number: 3, line_type: 'charge', line_label: 'Assurances' },
  { title_number: 3, line_type: 'charge', line_label: 'Fournitures diverses' },
  { title_number: 4, line_type: 'charge', line_label: 'Amortissements' },
  { title_number: 4, line_type: 'charge', line_label: 'Provisions' },
  { title_number: 4, line_type: 'charge', line_label: 'Charges financières' },
  // Produits
  { title_number: 1, line_type: 'produit', line_label: 'Dotation globale / Tarification' },
  { title_number: 2, line_type: 'produit', line_label: 'Recettes hébergement' },
  { title_number: 2, line_type: 'produit', line_label: 'Participations résidents' },
  { title_number: 3, line_type: 'produit', line_label: 'Produits financiers' },
];

export { TEMPLATE_LINES };

// ─── Title labels ────────────────────────────────────────────

export const CHARGE_TITLES: Record<number, string> = {
  1: 'Titre 1 — Charges de personnel',
  2: 'Titre 2 — Charges à caractère médical',
  3: 'Titre 3 — Charges à caractère hôtelier et général',
  4: 'Titre 4 — Amortissements, provisions, charges financières',
};

export const PRODUIT_TITLES: Record<number, string> = {
  1: 'Titre 1 — Produits de la tarification',
  2: 'Titre 2 — Autres produits relatifs à l\'exploitation',
  3: 'Titre 3 — Produits financiers et non encaissables',
};

// ─── Summary type ────────────────────────────────────────────

export interface SectionSummary {
  section: string;
  label: string;
  totalCharges: number;
  totalProduits: number;
  result: number;
}

// ─── Hook ────────────────────────────────────────────────────

export interface BudgetData {
  sections: BudgetSection[];
  lines: BudgetLine[];
  summary: SectionSummary[];
  caf: number;
  loading: boolean;
  error: string | null;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  selectedSectionId: number | null;
  setSelectedSectionId: (id: number | null) => void;
  refresh: () => void;
  addLine: (line: Omit<BudgetLine, 'id' | 'created_at'>) => Promise<number>;
  editLine: (id: number, updates: Partial<BudgetLine>) => Promise<void>;
  removeLine: (id: number) => Promise<void>;
  initFromTemplate: (sectionId: number, fiscalYear: number) => Promise<void>;
  investments: Investment[];
  addInvestment: (inv: Omit<Investment, 'id' | 'created_at'>) => Promise<number>;
  editInvestment: (id: number, updates: Partial<Investment>) => Promise<void>;
  removeInvestment: (id: number) => Promise<void>;
}

export function useBudgetData(): BudgetData {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [sections, setSections] = useState<BudgetSection[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [summary, setSummary] = useState<SectionSummary[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dbSections, dbSummary] = await Promise.all([
        getBudgetSections().catch(() => [] as BudgetSection[]),
        getBudgetSummary(selectedYear).catch(() => []),
      ]);

      setSections(dbSections);

      // Auto-select first section if none selected
      if (!selectedSectionId && dbSections.length > 0) {
        setSelectedSectionId(dbSections[0].id);
      }

      // Build summary with labels
      const summaryWithLabels: SectionSummary[] = dbSections.map((s) => {
        const match = dbSummary.find((r: { section: string }) => r.section === s.name);
        return {
          section: s.name,
          label: s.label,
          totalCharges: (match as { totalCharges?: number })?.totalCharges ?? 0,
          totalProduits: (match as { totalProduits?: number })?.totalProduits ?? 0,
          result: ((match as { totalProduits?: number })?.totalProduits ?? 0) - ((match as { totalCharges?: number })?.totalCharges ?? 0),
        };
      });
      setSummary(summaryWithLabels);

      // Load lines for selected section
      if (selectedSectionId) {
        const dbLines = await getBudgetLines(selectedSectionId, selectedYear).catch(() => [] as BudgetLine[]);
        setLines(dbLines);
      }

      // Load investments
      const dbInvestments = await getInvestments(selectedYear).catch(() => [] as Investment[]);
      setInvestments(dbInvestments);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // CAF = sum of results + amortissements + provisions (title 4 charges)
  const caf = summary.reduce((acc, s) => acc + s.result, 0)
    + lines
      .filter((l) => l.line_type === 'charge' && l.title_number === 4)
      .reduce((acc, l) => acc + l.amount_previsionnel, 0);

  const addLine = useCallback(async (line: Omit<BudgetLine, 'id' | 'created_at'>) => {
    const id = await createBudgetLine(line);
    await loadData();
    return id;
  }, [loadData]);

  const editLine = useCallback(async (id: number, updates: Partial<BudgetLine>) => {
    await updateBudgetLine(id, updates);
    await loadData();
  }, [loadData]);

  const removeLine = useCallback(async (id: number) => {
    await deleteBudgetLine(id);
    await loadData();
  }, [loadData]);

  const addInvestment = useCallback(async (inv: Omit<Investment, 'id' | 'created_at'>) => {
    const id = await createInvestment(inv);
    await loadData();
    return id;
  }, [loadData]);

  const editInvestment = useCallback(async (id: number, updates: Partial<Investment>) => {
    await updateInvestment(id, updates);
    await loadData();
  }, [loadData]);

  const removeInvestment = useCallback(async (id: number) => {
    await deleteInvestment(id);
    await loadData();
  }, [loadData]);

  const initFromTemplate = useCallback(async (sectionId: number, fiscalYear: number) => {
    for (const tpl of TEMPLATE_LINES) {
      await createBudgetLine({
        section_id: sectionId,
        title_number: tpl.title_number,
        line_label: tpl.line_label,
        line_type: tpl.line_type,
        amount_previsionnel: 0,
        amount_realise: 0,
        fiscal_year: fiscalYear,
        period: null,
      });
    }
    await loadData();
  }, [loadData]);

  return {
    sections,
    lines,
    summary,
    caf,
    loading,
    error,
    selectedYear,
    setSelectedYear,
    selectedSectionId,
    setSelectedSectionId,
    refresh: loadData,
    addLine,
    editLine,
    removeLine,
    initFromTemplate,
    investments,
    addInvestment,
    editInvestment,
    removeInvestment,
  };
}
