import { useState, useMemo } from 'react';
import {
  Plus, Mail, Image as ImageIcon, BookOpen, Cake, Users, Sparkles,
  Check, ChevronRight, Download,
} from 'lucide-react';
import { updateAlbum } from '@/db/photos';
import { exportFamileoPdf } from '@/utils/pdfExport';
import { useFamileoData, type UIFamileoSection } from './famileo/useFamileoData';
import FamileoControls from './famileo/FamileoControls';
import FamileoPreview from './famileo/FamileoPreview';

type FamileoTab = 'list' | 'editor' | 'wizard';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function Famileo() {
  const now = new Date();
  const [tab, setTab] = useState<FamileoTab>('list');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [cover, setCover] = useState('');
  const [exporting, setExporting] = useState(false);

  const data = useFamileoData(year, month);

  async function handleTextChange(albumId: number, text: string) {
    await updateAlbum(albumId, { description: text }).catch(() => {});
    data.setSections(data.sections.map((s) =>
      s.album.id === albumId ? { ...s, text, album: { ...s.album, description: text } } : s,
    ));
  }

  async function handleExport() {
    if (exporting) return;
    const included = data.sections.filter((s) => s.included).sort((a, b) => a.order - b.order);
    if (included.length === 0) return;
    setExporting(true);
    try {
      await exportFamileoPdf({ year, month, cover, sections: included });
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const tabs: Array<[FamileoTab, string]> = [
    ['list', 'Archive des journaux'],
    ['editor', 'Éditeur par sections'],
    ['wizard', 'Assistant pas-à-pas'],
  ];

  return (
    <div style={{ maxWidth: 1400, display: 'flex', flexDirection: 'column', gap: 20, animation: 'slide-in 0.22s ease-out' }}>
      {/* Pill tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--surface-2)',
        padding: 4, borderRadius: 10, width: 'fit-content',
      }}>
        {tabs.map(([k, l]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                border: 'none', cursor: 'pointer',
              }}
            >
              {l}
            </button>
          );
        })}
      </div>

      {tab === 'list' && (
        <FamileoList
          currentYear={year}
          currentMonth={month}
          onOpenMonth={(y, m) => { setYear(y); setMonth(m); setTab('editor'); }}
          onStartWizard={() => setTab('wizard')}
          onExport={handleExport}
          exporting={exporting}
          draftCount={data.sections.filter((s) => s.included).length}
        />
      )}

      {tab === 'editor' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: 20, alignItems: 'start',
        }}>
          <FamileoControls
            year={year}
            month={month}
            onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
            sections={data.sections}
            onSectionsChange={data.setSections}
            onExport={handleExport}
            exporting={exporting}
          />
          {data.loading ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 13, padding: 20 }}>Chargement…</p>
          ) : (
            <FamileoPreview
              year={year}
              month={month}
              sections={data.sections}
              cover={cover}
              onCoverChange={setCover}
              onTextChange={handleTextChange}
            />
          )}
        </div>
      )}

      {tab === 'wizard' && (
        <FamileoWizard
          year={year}
          month={month}
          sections={data.sections}
          cover={cover}
          onCoverChange={setCover}
          onExport={handleExport}
          exporting={exporting}
          onBackToList={() => setTab('list')}
          onOpenEditor={() => setTab('editor')}
        />
      )}
    </div>
  );
}

/* ─── Archive list tab ──────────────────────────────────────── */

interface FamileoListProps {
  currentYear: number;
  currentMonth: number;
  onOpenMonth: (year: number, month: number) => void;
  onStartWizard: () => void;
  onExport: () => Promise<void>;
  exporting: boolean;
  draftCount: number;
}

function FamileoList({ currentYear, currentMonth, onOpenMonth, onStartWizard, onExport, exporting, draftCount }: FamileoListProps) {
  // Build a list of months: current month (draft) + 5 previous (sent).
  const items = useMemo(() => {
    const out: Array<{ year: number; month: number; label: string; state: 'draft' | 'sent'; subtitle: string }> = [];
    for (let i = 0; i < 6; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      while (m < 1) { m += 12; y -= 1; }
      out.push({
        year: y,
        month: m,
        label: `${MONTHS_FR[m - 1]} ${y}`,
        state: i === 0 ? 'draft' : 'sent',
        subtitle: i === 0
          ? `${draftCount} section${draftCount > 1 ? 's' : ''} prête${draftCount > 1 ? 's' : ''}`
          : 'envoyé aux familles',
      });
    }
    return out;
  }, [currentYear, currentMonth, draftCount]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: -0.6 }}>
            Journaux mensuels
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>
            envoyés par PDF aux familles
          </div>
        </div>
        <button className="btn primary" onClick={onStartWizard}>
          <Plus size={14} /> Commencer {MONTHS_FR[currentMonth - 1].toLowerCase()}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div
            key={`${it.year}-${it.month}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr auto auto 140px',
              gap: 16, padding: '16px 20px', alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div style={{
              width: 44, height: 58,
              background: it.state === 'draft' ? 'var(--terra-soft)' : 'var(--surface-2)',
              border: '1px solid var(--line)', borderRadius: 4,
              display: 'grid', placeItems: 'center',
              color: it.state === 'draft' ? 'var(--terra-deep)' : 'var(--ink-3)',
            }}>
              <Mail size={20} />
            </div>
            <div>
              <div className="serif" style={{ fontSize: 17, fontWeight: 500, letterSpacing: -0.2 }}>
                {it.label}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {it.subtitle}
              </div>
            </div>
            <div>
              <span className={`chip ${it.state === 'draft' ? 'warn' : 'done'}`}>
                {it.state === 'draft' ? 'en cours' : 'envoyé'}
              </span>
            </div>
            <div style={{ width: 100 }}>
              {it.state === 'draft' && (
                <div style={{
                  height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, Math.round((draftCount / 6) * 100))}%`,
                    height: '100%', background: 'var(--terra)',
                  }} />
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {it.state === 'draft' ? (
                <button
                  className="btn primary sm"
                  onClick={() => onOpenMonth(it.year, it.month)}
                >
                  Continuer <ChevronRight size={12} />
                </button>
              ) : (
                <button
                  className="btn sm"
                  onClick={() => { onOpenMonth(it.year, it.month); onExport(); }}
                  disabled={exporting}
                >
                  <Download size={12} /> PDF
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Wizard tab ────────────────────────────────────────────── */

interface FamileoWizardProps {
  year: number;
  month: number;
  sections: UIFamileoSection[];
  cover: string;
  onCoverChange: (v: string) => void;
  onExport: () => Promise<void>;
  exporting: boolean;
  onBackToList: () => void;
  onOpenEditor: () => void;
}

const WIZARD_STEPS = ['Photos', 'Comptes rendus', 'Édito', 'Aperçu', 'Envoi'] as const;

function FamileoWizard({ year, month, sections, cover, onCoverChange, onExport, exporting, onBackToList, onOpenEditor }: FamileoWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const totalPhotos = sections.reduce((n, s) => n + s.photos.length, 0);
  const reportsCount = sections.filter((s) => s.included && s.text.trim()).length;

  const stepper = WIZARD_STEPS.map((n, i) => ({
    n,
    done: i < stepIdx,
    active: i === stepIdx,
  }));

  function next() { setStepIdx((i) => Math.min(i + 1, WIZARD_STEPS.length - 1)); }
  function prev() { setStepIdx((i) => Math.max(i - 1, 0)); }

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {stepper.map((s, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                background: s.done ? 'var(--terra)' : s.active ? 'var(--terra-soft)' : 'var(--surface-2)',
                color: s.done ? '#fff' : s.active ? 'var(--terra-deep)' : 'var(--ink-4)',
                border: `2px solid ${s.done || s.active ? 'var(--terra)' : 'var(--line)'}`,
                fontSize: 14, fontWeight: 600,
              }}>
                {s.done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: s.active ? 600 : 500,
                color: s.done || s.active ? 'var(--ink)' : 'var(--ink-3)',
              }}>
                {s.n}
              </div>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: s.done ? 'var(--terra)' : 'var(--line)',
                margin: '0 14px',
              }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Étape {stepIdx + 1} sur {WIZARD_STEPS.length}
          </div>
          <h2 className="serif" style={{
            fontSize: 32, fontWeight: 500, letterSpacing: -0.8,
            margin: '4px 0 6px',
          }}>
            {WIZARD_STEPS[stepIdx]}
          </h2>

          {stepIdx === 0 && (
            <WizardStepPhotos totalPhotos={totalPhotos} onOpenEditor={onOpenEditor} />
          )}
          {stepIdx === 1 && (
            <WizardStepReports reportsCount={reportsCount} onOpenEditor={onOpenEditor} />
          )}
          {stepIdx === 2 && (
            <WizardStepCover cover={cover} onCoverChange={onCoverChange} />
          )}
          {stepIdx === 3 && (
            <WizardStepPreview onOpenEditor={onOpenEditor} />
          )}
          {stepIdx === 4 && (
            <WizardStepExport onExport={onExport} exporting={exporting} />
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn sm" onClick={onBackToList}>← Retour à l'archive</button>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={prev} disabled={stepIdx === 0}>
              ← Précédent
            </button>
            {stepIdx < WIZARD_STEPS.length - 1 ? (
              <button className="btn primary" onClick={next}>
                Suivant →
              </button>
            ) : (
              <button className="btn primary" onClick={onExport} disabled={exporting}>
                {exporting ? 'Export PDF…' : 'Générer le PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="card-soft" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 16 }}>
          <div className="eyebrow">Votre journal</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.5, marginTop: 4 }}>
            {MONTHS_FR[month - 1]} {year}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 }}>
            envoi prévu ce mois-ci
          </div>
          {[
            { icon: <ImageIcon size={14} style={{ color: 'var(--ink-3)' }} />, label: 'Photos', value: `${totalPhotos} cliché${totalPhotos > 1 ? 's' : ''}` },
            { icon: <BookOpen size={14} style={{ color: 'var(--ink-3)' }} />, label: 'Comptes rendus', value: `${reportsCount} activité${reportsCount > 1 ? 's' : ''}` },
            { icon: <Cake size={14} style={{ color: 'var(--ink-3)' }} />, label: 'Anniversaires', value: '—' },
            { icon: <Users size={14} style={{ color: 'var(--ink-3)' }} />, label: 'Foyers destinataires', value: '—' },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderTop: i > 0 ? '1px solid var(--line)' : 'none',
              }}
            >
              {row.icon}
              <div style={{ flex: 1, fontSize: 13 }}>{row.label}</div>
              <div className="num" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WizardStepPhotos({ totalPhotos, onOpenEditor }: { totalPhotos: number; onOpenEditor: () => void }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Passez par vos albums du mois pour sélectionner les photos à joindre au journal.
        Vous en avez actuellement <strong style={{ color: 'var(--ink)' }}>{totalPhotos}</strong> prêtes.
      </p>
      <button className="btn" onClick={onOpenEditor}>
        <ImageIcon size={13} /> Ouvrir l'éditeur par sections
      </button>
    </div>
  );
}

function WizardStepReports({ reportsCount, onOpenEditor }: { reportsCount: number; onOpenEditor: () => void }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Chaque activité marquante peut recevoir un petit compte rendu. Pour l'instant,
        vous en avez <strong style={{ color: 'var(--ink)' }}>{reportsCount}</strong> rédigé{reportsCount > 1 ? 's' : ''}.
      </p>
      <button className="btn" onClick={onOpenEditor}>
        <BookOpen size={13} /> Rédiger les CR dans l'éditeur
      </button>
    </div>
  );
}

function WizardStepCover({ cover, onCoverChange }: { cover: string; onCoverChange: (v: string) => void }) {
  return (
    <div className="card" style={{ padding: 20, minHeight: 220, position: 'relative' }}>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 10px', lineHeight: 1.6 }}>
        Un petit mot chaleureux pour ouvrir le journal. 2–3 phrases suffisent — les familles aiment l'authentique.
      </p>
      <textarea
        value={cover}
        onChange={(e) => onCoverChange(e.target.value)}
        placeholder="Chères familles, …"
        rows={8}
        style={{
          width: '100%', padding: 12, borderRadius: 8,
          border: '1px solid var(--line)', background: 'var(--surface)',
          fontSize: 15, fontFamily: 'var(--font-serif)', lineHeight: 1.7,
          color: 'var(--ink-2)', outline: 'none', resize: 'vertical',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 12, right: 24,
        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)',
      }}>
        {cover.length} / 400
      </div>
    </div>
  );
}

function WizardStepPreview({ onOpenEditor }: { onOpenEditor: () => void }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Vérifiez le rendu final avant envoi. Vous pouvez corriger les légendes et les CR depuis l'éditeur.
      </p>
      <button className="btn" onClick={onOpenEditor}>
        <Sparkles size={13} /> Ouvrir l'aperçu dans l'éditeur
      </button>
    </div>
  );
}

function WizardStepExport({ onExport, exporting }: { onExport: () => Promise<void>; exporting: boolean }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Prêt ? Générez le PDF du journal pour l'envoyer aux familles.
      </p>
      <button className="btn primary" onClick={onExport} disabled={exporting}>
        <Download size={13} /> {exporting ? 'Export…' : 'Générer le PDF'}
      </button>
    </div>
  );
}
