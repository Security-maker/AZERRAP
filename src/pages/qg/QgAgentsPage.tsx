import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { Phone, UserPlus } from 'lucide-react';
import { db } from '../../config/firebase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { upsertAgent } from '../../services/firestoreService';
import type { AppUser, Role } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function QgAgentsPage() {
  const { data: agents } = useRealtimeCollection<AppUser>(collection(db, 'users') as never, []);
  const [form, setForm] = useState({ uid: '', nom: '', prenom: '', email: '', telephone: '', role: 'agent' as Role });

  async function save() {
    if (!form.uid || !form.email) { alert('UID Firebase et email obligatoires.'); return; }
    await upsertAgent({ ...form, statut: form.role === 'agent' ? 'hors_poste' : 'actif' });
    setForm({ uid: '', nom: '', prenom: '', email: '', telephone: '', role: 'agent' });
  }

  return (
    <div>
      <PageHeader title="Dispositif agents" subtitle="Liste vivante, statuts, rôles et historique opérationnel." />
      <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
        <Card>
          <h2 className="text-xl font-extrabold"><UserPlus className="mr-2 inline h-5 w-5 text-electric" />Ajouter / modifier agent</h2>
          <div className="mt-4 grid gap-3">
            <Input placeholder="UID Firebase Auth" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} />
            <Input placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            <Input placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="agent">Agent</option><option value="superviseur">Superviseur</option><option value="admin">Admin</option></Select>
            <Button onClick={save}>Enregistrer agent</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-extrabold">Agents connectés</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-metal"><tr><th className="p-3">Agent</th><th>Rôle</th><th>Statut</th><th>Site</th><th>Dernière activité</th><th>Contact</th></tr></thead>
              <tbody>
                {agents.map((a) => <tr key={a.uid} className="border-t border-white/10"><td className="p-3 font-bold">{a.prenom} {a.nom}<br /><small className="font-medium text-metal">{a.email}</small></td><td>{a.role}</td><td><Badge tone={a.statut === 'alerte' ? 'critique' : a.statut === 'en_poste' ? 'normal' : 'info'}>{String(a.statut)}</Badge></td><td>{a.siteActuel || '—'}</td><td>{toReadableDate(a.lastSeen)}</td><td>{a.telephone ? <a className="font-bold text-electric" href={`tel:${a.telephone}`}><Phone className="mr-1 inline h-4 w-4" />Appeler</a> : '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
