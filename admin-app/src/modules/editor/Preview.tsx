// Aperçu plein écran du brouillon (onglet séparé), réservé aux membres connectés.
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
import { mergeContent } from '@cms';
import { usePageDraft } from '../../lib/draft';
import { errorMessage } from '../../lib/supabase';
import { Badge, Notice, Segmented, Spinner } from '../../components/ui';
import { PreviewFrame, type Device } from './PreviewFrame';

export default function Preview() {
  const { slug = 'index' } = useParams();
  const d = usePageDraft(slug);
  const [device, setDevice] = useState<Device>('desktop');
  const merged = useMemo(() => (d.state ? mergeContent(d.state.globalContent, d.state.content) : null), [d.state]);
  if (d.error) return <div className="content"><Notice tone="danger">{errorMessage(d.error)}</Notice></div>;
  if (!d.state || !merged) return <div className="center-screen"><Spinner label="Chargement de l'aperçu…" /></div>;
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-toolbar">
        <Link to={`/editor/${slug}`} className="btn sm ghost"><ArrowLeft size={15} />Éditeur</Link>
        <b>{d.state.page.title}</b>
        <Badge tone="warning" dot>Aperçu du brouillon — non publié</Badge>
        <div style={{ flex: 1 }} />
        <Segmented label="Appareil" value={device} onChange={setDevice} options={[{ value: 'desktop', label: '', icon: <Monitor /> }, { value: 'tablet', label: '', icon: <Tablet /> }, { value: 'mobile', label: '', icon: <Smartphone /> }]} />
      </div>
      <div className="editor-canvas" style={{ background: 'var(--bg-subtle)' }}>
        <PreviewFrame file={d.state.page.file_path || d.state.page.template_path || 'index.html'} content={merged} device={device} mode="view" />
      </div>
    </div>
  );
}
