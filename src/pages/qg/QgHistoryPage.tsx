import { collection } from 'firebase/firestore';
import { Download, FileText } from 'lucide-react';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { exportReportsCSV, printReportsPDF } from '../../services/exportService';
import type { Alert, Report, Round } from '../../types';

export default function QgHistoryPage() {
  const { data: reports } = useRealtimeCollection<Report>(collection(db, 'reports') as never, []);
  const { data: alerts } = useRealtimeCollection<Alert>(collection(db, 'alerts') as never, []);
  const { data: rounds } = useRealtimeCollection<Round>(collection(db, 'rounds') as never, []);
  return (
    <div>
      <PageHeader title="Historique / exports" subtitle="Rapports, incidents, rondes et alertes avec rendu professionnel." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><h2 className="text-xl font-extrabold">Mains courantes</h2><p className="mt-2 text-4xl font-extrabold">{reports.length}</p><div className="mt-4 flex gap-2"><Button variant="secondary" onClick={() => exportReportsCSV(reports)}><Download className="mr-2 inline h-4 w-4" />CSV</Button><Button variant="secondary" onClick={() => printReportsPDF(reports)}><FileText className="mr-2 inline h-4 w-4" />PDF</Button></div></Card>
        <Card><h2 className="text-xl font-extrabold">Alertes</h2><p className="mt-2 text-4xl font-extrabold">{alerts.length}</p><p className="mt-3 text-sm text-metal">Historique conservé avec justification de clôture.</p></Card>
        <Card><h2 className="text-xl font-extrabold">Rondes</h2><p className="mt-2 text-4xl font-extrabold">{rounds.length}</p><p className="mt-3 text-sm text-metal">Exports détaillés à brancher selon modèle client.</p></Card>
      </div>
    </div>
  );
}
