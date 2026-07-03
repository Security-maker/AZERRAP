import { collection } from 'firebase/firestore';
import { AlertTriangle, Building2, ClipboardList, Radio, ShieldCheck, Users } from 'lucide-react';
import { db } from '../../config/firebase';
import { Card, PageHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/qg/StatCard';
import { AgentMap } from '../../components/qg/AgentMap';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import type { Alert, AppUser, Report, Site } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function QgDashboard() {
  const { data: agents } = useRealtimeCollection<AppUser>(collection(db, 'users') as never, []);
  const { data: reports } = useRealtimeCollection<Report>(collection(db, 'reports') as never, []);
  const { data: alerts } = useRealtimeCollection<Alert>(collection(db, 'alerts') as never, []);
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);

  const onDuty = agents.filter((a) => a.statut === 'en_poste' || a.statut === 'alerte').length;
  const activeAlerts = alerts.filter((a) => a.statut === 'active' || a.statut === 'prise_en_charge').length;
  const incidents24 = reports.filter((r) => r.category === 'Incident').length;

  return (
    <div>
      <PageHeader title="Dashboard QG" subtitle="Vue temps réel du dispositif, des alertes et de la main courante." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agents en poste" value={onDuty} icon={Users} tone="green" />
        <StatCard label="Alertes actives" value={activeAlerts} icon={AlertTriangle} tone={activeAlerts ? 'red' : 'blue'} />
        <StatCard label="Incidents 24h" value={incidents24} icon={ClipboardList} tone={incidents24 ? 'orange' : 'blue'} />
        <StatCard label="Sites actifs" value={sites.filter((s) => s.isActive !== false).length} icon={Building2} tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold"><Radio className="mr-2 inline h-5 w-5 text-electric" />Derniers rapports</h2><Badge>Temps réel</Badge></div>
          <div className="space-y-3">
            {reports.slice(0, 8).map((r) => <div key={r.reportId} className="rounded-3xl bg-obsidian p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={r.severity === 'critique' ? 'critique' : r.severity === 'important' ? 'important' : 'info'}>{r.severity}</Badge><p className="text-xs text-metal">{toReadableDate(r.createdAt)}</p></div><p className="mt-2 font-bold">{r.category} · {r.siteNom}</p><p className="mt-1 text-sm text-metal">{r.agentNom} — {r.message}</p></div>)}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-xl font-extrabold"><ShieldCheck className="mr-2 inline h-5 w-5 text-operational" />Carte des agents</h2>
          <AgentMap agents={agents} />
        </Card>
      </div>

      {activeAlerts > 0 && <Card className="mt-4 border-alert/40 bg-alert/10"><h2 className="text-2xl font-extrabold text-alert">Alerte critique active</h2><p className="mt-2 text-metal">Une ou plusieurs alertes PTI/SOS nécessitent une prise en charge immédiate.</p></Card>}
    </div>
  );
}
