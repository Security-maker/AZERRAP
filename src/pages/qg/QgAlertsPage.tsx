import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { MapPin, Phone, Siren } from 'lucide-react';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { closeAlert, handleAlert } from '../../services/firestoreService';
import type { Alert } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function QgAlertsPage() {
  const { profile } = useAuth();
  const { data: alerts } = useRealtimeCollection<Alert>(collection(db, 'alerts') as never, []);
  const [reason, setReason] = useState('');
  const active = alerts.filter((a) => a.statut !== 'cloturee');

  return (
    <div>
      <PageHeader title="Alertes PTI / SOS" subtitle="Prise en charge immédiate. Clôture uniquement avec justification." />
      <div className="space-y-4">
        {active.map((a) => <Card key={a.alertId} className="border-alert/50 bg-alert/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-alert px-3 py-1 text-xs font-extrabold text-white">CRITIQUE</p>
              <h2 className="mt-3 text-2xl font-extrabold"><Siren className="mr-2 inline h-6 w-6 text-alert" />{a.agentNom}</h2>
              <p className="mt-2 text-metal">Site : {a.siteNom || a.siteActuel || 'Non renseigné'} · Heure : {toReadableDate(a.heure)}</p>
              <p className="mt-2 text-sm text-metal">Statut : {a.statut}</p>
              {a.positionGPS && <a className="mt-3 inline-flex items-center gap-2 font-bold text-electric" href={`https://maps.google.com/?q=${a.positionGPS.lat},${a.positionGPS.lng}`} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4" /> Ouvrir position GPS</a>}
            </div>
            <div className="grid min-w-[280px] gap-2">
              <Button variant="danger" onClick={() => profile && handleAlert({ alertId: a.alertId, supervisor: profile })}>Prendre en charge</Button>
              <Button variant="secondary"><Phone className="mr-2 inline h-4 w-4" /> Appeler l’agent</Button>
              <Button variant="warning">Contacter les secours</Button>
              <Textarea placeholder="Justification de clôture obligatoire" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="ghost" onClick={() => profile && closeAlert({ alertId: a.alertId, supervisor: profile, reason })}>Clôturer avec justification</Button>
            </div>
          </div>
        </Card>)}
        {active.length === 0 && <Card>Aucune alerte active.</Card>}
      </div>
    </div>
  );
}
