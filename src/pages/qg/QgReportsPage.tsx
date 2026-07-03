import { useMemo, useState } from 'react';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { Download, FileText, Search } from 'lucide-react';
import { db } from '../../config/firebase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { exportReportsCSV, printReportsPDF } from '../../services/exportService';
import type { Report } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function QgReportsPage() {
  const { data: reports } = useRealtimeCollection<Report>(collection(db, 'reports') as never, []);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const filtered = useMemo(() => reports.filter((r) => (severity === 'all' || r.severity === severity) && `${r.agentNom} ${r.siteNom} ${r.category} ${r.message}`.toLowerCase().includes(search.toLowerCase())), [reports, search, severity]);

  return (
    <div>
      <PageHeader title="Supervision MCI" subtitle="Journal temps réel, filtres, traitement et exports." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => exportReportsCSV(filtered)}><Download className="mr-2 inline h-4 w-4" /> CSV</Button><Button variant="secondary" onClick={() => printReportsPDF(filtered)}><FileText className="mr-2 inline h-4 w-4" /> PDF</Button></div>} />
      <Card className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-metal" /><Input className="border-0 bg-transparent" placeholder="Recherche texte" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="all">Toutes gravités</option><option value="normal">Normal</option><option value="surveillance">À surveiller</option><option value="important">Important</option><option value="critique">Critique</option></Select></Card>
      <div className="space-y-3">
        {filtered.map((r) => <Card key={r.reportId}><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={r.severity === 'critique' ? 'critique' : r.severity === 'important' ? 'important' : 'info'}>{r.severity}</Badge><p className="text-xs text-metal">{toReadableDate(r.createdAt)}</p></div><h2 className="mt-2 text-xl font-extrabold">{r.category} · {r.siteNom}</h2><p className="mt-1 text-sm text-metal">{r.agentNom}</p><p className="mt-3 leading-6">{r.message}</p>{r.photoUrl && <a href={r.photoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-electric">Voir la photo</a>}</div><Button variant={r.status === 'traite' ? 'ghost' : 'success'} onClick={() => updateDoc(doc(db, 'reports', r.reportId), { status: 'traite' })}>{r.status === 'traite' ? 'Traité' : 'Marquer traité'}</Button></div></Card>)}
      </div>
    </div>
  );
}
