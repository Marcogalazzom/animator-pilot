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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
          Famileo mensuel
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
          Récapitulatif du mois envoyé aux familles — assemblage auto, édition rapide, export PDF
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
        gap: '20px',
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', padding: '20px' }}>Chargement…</p>
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
