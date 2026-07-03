import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Select } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { startShift } from '../../services/firestoreService';
import type { Site } from '../../types';

export default function ShiftStartPage() {
  const { profile } = useAuth();
  const { requestPosition, status } = useGeolocation();
  const navigate = useNavigate();
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(false);
  const site = useMemo(() => sites.find((s) => s.siteId === siteId || (s as never as { id: string }).id === siteId), [siteId, sites]);

  async function submit() {
    if (!profile || !site) return;
    setLoading(true);
    try {
      const gps = await requestPosition();
      await startShift({ agent: profile, site: { ...site, siteId: site.siteId || (site as never as { id: string }).id }, gps });
      alert('Poste démarré. QG notifié.');
      navigate('/agent');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de prendre le poste.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Prise de poste" subtitle="Sélectionne ton site. Le poste sera horodaté et transmis au QG." />
      <Card className="max-w-3xl">
        <label className="text-sm font-bold text-metal">Site disponible</label>
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-2">
          <option value="">Choisir un site</option>
          {sites.filter((s) => s.isActive !== false).map((s) => <option key={(s as never as { id: string }).id ?? s.siteId} value={s.siteId ?? (s as never as { id: string }).id}>{s.name}</option>)}
        </Select>

        {site && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info label="Nom du site" value={site.name} />
            <Info label="Client" value={site.clientName} />
            <Info label="Adresse" value={site.address} />
            <Info label="Contact urgence" value={site.emergencyContact || site.contactPhone || 'Non renseigné'} />
            <div className="sm:col-span-2 rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">Consignes principales</p><p className="mt-2 text-sm leading-6">{site.instructions || 'Aucune consigne chargée.'}</p></div>
          </div>
        )}
        <p className="mt-4 text-xs font-semibold text-electric">GPS : {status === 'idle' ? 'sera demandé au démarrage' : status}</p>
        <Button disabled={!site || loading} onClick={submit} className="mt-5 w-full">{loading ? 'Transmission...' : 'Prendre Poste'}</Button>
      </Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
