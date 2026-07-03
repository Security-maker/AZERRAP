import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import QRCode from 'qrcode';
import { Building2, QrCode } from 'lucide-react';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { upsertSite } from '../../services/firestoreService';
import type { RoundCheckpoint, Site } from '../../types';

export default function QgSitesPage() {
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);
  const { data: checkpoints } = useRealtimeCollection<RoundCheckpoint>(collection(db, 'roundCheckpoints') as never, []);
  const [selected, setSelected] = useState<Site | null>(null);
  const [qr, setQr] = useState('');
  const [form, setForm] = useState({ name: '', clientName: '', address: '', contactName: '', contactPhone: '', emergencyContact: '', whatsappQG: '', instructions: '' });
  const siteCheckpoints = useMemo(() => selected ? checkpoints.filter((c) => c.siteId === selected.siteId) : [], [checkpoints, selected]);

  async function saveSite() {
    const id = await upsertSite({ siteId: selected?.siteId, ...form, isActive: true });
    alert(`Site enregistré : ${id}`);
  }

  async function generateQr(value: string) {
    setQr(await QRCode.toDataURL(value, { margin: 1, width: 300 }));
  }

  function edit(site: Site) { setSelected(site); setForm({ name: site.name, clientName: site.clientName, address: site.address, contactName: site.contactName || '', contactPhone: site.contactPhone || '', emergencyContact: site.emergencyContact || '', whatsappQG: site.whatsappQG || '', instructions: site.instructions || '' }); }

  return (
    <div>
      <PageHeader title="Gestion des sites" subtitle="Consignes, contacts, documents, points de ronde et WhatsApp QG." />
      <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-extrabold"><Building2 className="mr-2 inline h-5 w-5 text-electric" />Ajouter / modifier site</h2>
          <div className="mt-4 grid gap-3">
            <Input placeholder="Nom du site" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="Contact client" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <Input placeholder="Téléphone contact" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            <Input placeholder="Contact urgence" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
            <Input placeholder="WhatsApp QG" value={form.whatsappQG} onChange={(e) => setForm({ ...form, whatsappQG: e.target.value })} />
            <Textarea placeholder="Consignes principales" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            <Button onClick={saveSite}>Enregistrer site</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-extrabold">Sites actifs</h2>
          <div className="mt-4 space-y-3">
            {sites.map((s) => <button key={s.siteId} onClick={() => edit(s)} className="w-full rounded-3xl border border-white/10 bg-obsidian p-4 text-left hover:border-electric/40"><b>{s.name}</b><br /><small className="text-metal">{s.clientName} · {s.address}</small></button>)}
          </div>
          {selected && <div className="mt-5 rounded-3xl border border-electric/20 bg-electric/10 p-4"><h3 className="font-extrabold"><QrCode className="mr-2 inline h-5 w-5" />Points de ronde</h3><div className="mt-3 space-y-2">{siteCheckpoints.map((cp) => <div key={cp.checkpointId} className="flex items-center justify-between rounded-2xl bg-obsidian p-3"><span>{cp.order}. {cp.name}</span><Button variant="ghost" onClick={() => generateQr(cp.qrValue)}>QR</Button></div>)}</div>{qr && <img src={qr} alt="QR Code" className="mt-4 rounded-2xl bg-white p-3" />}</div>}
        </Card>
      </div>
    </div>
  );
}
