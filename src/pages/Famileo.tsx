import { useState } from 'react';
import { updateAlbum } from '@/db/photos';
import { exportFamileoPdf } from '@/utils/pdfExport';
import { useFamileoData } from './famileo/useFamileoData';
import FamileoControls from './famileo/FamileoControls';
import FamileoPreview from './famileo/FamileoPreview';

export default function Famileo() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [cover, setCover] = useState('');
  const [exporting, setExporting] = useState(false);

  const data = useFamileoData(year, month);

  async function handleTextChange(albumId: number, text: string) {
    await updateAlbum(albumId, { description: text }).catch(() => {});
    data.setSections(data.sections.map((s) =>
      s.album.id === albumId ? { ...s, text, album: { ...s.album, description: text } } : s
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, animation: 'slide-in 0.22s ease-out' }}>
      <div className="eyebrow">
        Récapitulatif du mois envoyé aux familles — assemblage auto, édition rapide, export PDF
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
        gap: 20,
        alignItems: 'start',
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
    </div>
  );
}
