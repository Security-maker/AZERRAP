import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { endShift } from '../../services/firestoreService';

export default function ShiftEndPage() {
  const { profile } = useAuth();
  const { requestPosition } = useGeolocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!profile) return;
    if (!confirm('Confirmer la fin de poste ?')) return;
    setLoading(true);
    try {
      const gps = await requestPosition();
      await endShift({ agent: profile, gps, summary: { closedFrom: 'agent_portal' } });
      alert('Poste terminé. Résumé transmis au QG.');
      navigate('/agent');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fin de poste impossible.');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <PageHeader title="Fin de poste" subtitle="Contrôle rapide avant clôture." />
      <Card className="max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Site" value={profile?.siteActuel || 'Aucun'} />
          <Info label="Statut" value={String(profile?.statut || '—')} />
          <Info label="Rapports MCI" value="Calcul côté QG" />
          <Info label="Rondes validées" value="Calcul côté QG" />
        </div>
        <Button variant="danger" disabled={loading} onClick={submit} className="mt-5 w-full">{loading ? 'Clôture...' : 'Terminer Poste'}</Button>
      </Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
