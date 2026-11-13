// Demandes reçues par les formulaires du site (démo, contact, candidature) : alerte du tableau de bord et liste complète.
import { Link } from 'react-router-dom';
import { BellRing, Check, Download, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { ago, dateTime, download, toCsv } from '../../lib/format';
import { leadKind, unseenLeads, useLeadsSeen } from '../../lib/leads';
import type { Lead } from '../../lib/types';
import { useAsync, useInterval } from '../../components/hooks';
import { Badge, Button, Card, Empty, Notice, Skeleton } from '../../components/ui';

const REFRESH_MS = 5 * 60 * 1000;
const KIND_TONE = { 'Démo': 'accent', Candidature: 'info', Contact: undefined } as const;

function exportCsv(leads: Lead[]) {
  download('demandes.csv', toCsv(leads.map((l) => ({ date: l.created_at, type: leadKind(l), nom: l.name, email: l.email, societe: l.company, telephone: l.phone, profil: l.profile, message: l.message, page: l.page }))));
}

function Contact({ l }: { l: Lead }) {
  return <><b>{l.name}</b><div className="small"><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone && ` · ${l.phone}`}</div></>;
}

/** Alerte du tableau de bord : demandes arrivées depuis la dernière consultation sur ce navigateur. */
export function LeadsAlert() {
  const leads = useAsync(() => api.leads(100), []);
  const { seen, markSeen } = useLeadsSeen();
  useInterval(leads.reload, REFRESH_MS);
  if (leads.error) return <Notice tone="danger" title="Demandes du site indisponibles">{errorMessage(leads.error)}</Notice>;
  if (!leads.data) return <Skeleton h={64} />;
  const fresh = unseenLeads(leads.data, seen);
  const last = leads.data[0];
  if (!fresh.length) {
    return (
      <Notice tone="info">
        Aucune nouvelle demande depuis votre dernière consultation.{last ? ` Dernière demande reçue ${ago(last.created_at)}.` : ' Aucune demande reçue pour l\'instant.'}{' '}
        <Link to="/demandes">Voir les demandes</Link>
      </Notice>
    );
  }
  return (
    <Card
      className="card-alert"
      title={<span className="row" style={{ gap: 8 }}><BellRing size={16} aria-hidden />{fresh.length === 1 ? '1 nouvelle demande' : `${fresh.length} nouvelles demandes`}</span>}
      subtitle="Reçues par les formulaires du site depuis votre dernière consultation. Le site promet une réponse sous un jour ouvré."
      actions={<>
        <Link className="btn sm" to="/demandes">Toutes les demandes</Link>
        <Button size="sm" variant="primary" icon={<Check />} onClick={() => markSeen(leads.data || [])}>Marquer comme vues</Button>
      </>}
    >
      <div className="list">
        {fresh.slice(0, 5).map((l) => (
          <div key={l.id} className="list-item" style={{ alignItems: 'flex-start' }}>
            <Badge tone={KIND_TONE[leadKind(l)]}>{leadKind(l)}</Badge>
            <div className="grow">
              <Contact l={l} />
              {(l.company || l.message) && <div className="small muted truncate" title={l.message || undefined}>{[l.company, l.message].filter(Boolean).join(' · ')}</div>}
            </div>
            <span className="small faint" style={{ whiteSpace: 'nowrap' }}>{ago(l.created_at)}</span>
          </div>
        ))}
      </div>
      {fresh.length > 5 && <p className="small muted" style={{ marginTop: 8 }}>et {fresh.length - 5} autre{fresh.length - 5 > 1 ? 's' : ''}.</p>}
    </Card>
  );
}

/** Tableau des demandes, réutilisé par la page Demandes et l'onglet Conversions. */
export function LeadsTable({ leads, seen }: { leads: Lead[]; seen?: number }) {
  const fresh = new Set(seen == null ? [] : unseenLeads(leads, seen).map((l) => l.id));
  return (
    <table className="table responsive">
      <thead><tr><th>Date</th><th>Type</th><th>Contact</th><th>Société</th><th>Message</th></tr></thead>
      <tbody>{leads.map((l) => (
        <tr key={l.id}>
          <td>{dateTime(l.created_at)}{fresh.has(l.id) && <> <Badge tone="success" dot>Nouveau</Badge></>}</td>
          <td><Badge tone={KIND_TONE[leadKind(l)]}>{leadKind(l)}</Badge></td>
          <td><Contact l={l} /></td>
          <td data-hide-mobile>{l.company || '—'}{l.profile && <div className="small muted">{l.profile}</div>}</td>
          <td data-hide-mobile className="small" style={{ maxWidth: 380, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.message || '—'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export default function Leads() {
  const leads = useAsync(() => api.leads(200), []);
  const { seen, markSeen } = useLeadsSeen();
  useInterval(leads.reload, REFRESH_MS);
  const rows = leads.data || [];
  const fresh = unseenLeads(rows, seen);
  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Demandes</h1><p>Démos, messages et candidatures envoyés depuis les formulaires du site.</p></div>
        <div className="row">
          {fresh.length > 0 && <Button size="sm" variant="primary" icon={<Check />} onClick={() => markSeen(rows)}>Marquer comme vues ({fresh.length})</Button>}
          <Button size="sm" icon={<Download />} disabled={!rows.length} onClick={() => exportCsv(rows)}>CSV</Button>
        </div>
      </div>
      {leads.error && <Notice tone="danger" title="Demandes indisponibles">{errorMessage(leads.error)}</Notice>}
      <Notice tone="info">Aucun e-mail n'est envoyé à la réception d'une demande : cette page et l'alerte du tableau de bord sont le seul signal. Le repère « vu » est propre à votre navigateur.</Notice>
      <Card bodyClass="table-wrap">
        {leads.loading && !leads.data ? <div className="card-body"><Skeleton h={120} /></div>
          : rows.length ? <LeadsTable leads={rows} seen={seen} />
          : <Empty icon={<Inbox />} title="Aucune demande pour l'instant">Les demandes de démo, les messages de contact et les candidatures apparaîtront ici dès leur envoi.</Empty>}
      </Card>
    </div>
  );
}
