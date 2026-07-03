import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { BookOpen, ClipboardList, Clock, LogIn, LogOut, MessageCircle, QrCode, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { db } from '../../config/firebase';
import type { Site } from '../../types';

const actions = [
  { to: '/agent/start', label: 'Prendre poste', icon: LogIn, tone: 'primary' as const },
  { to: '/agent/mci', label: 'Main courante', icon: ClipboardList, tone: 'secondary' as const },
  { to: '/agent/ronde', label: 'Ronde', icon: QrCode, tone: 'secondary' as const },
  { to: '/agent/docs', label: 'Documentation', icon: BookOpen, tone: 'secondary' as const }
];

export default function AgentHome() {
  const { profile } = useAuth();
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);
  const currentSite = useMemo(() => sites.find((s) => s.siteId === profile?.siteActuel || (s as never as { id: string }).id === profile?.siteActuel), [sites, profile?.siteActuel]);
  const whatsAppNumber = currentSite?.whatsappQG;
  const whatsAppUrl = whatsAppNumber ? `https://wa.me/${whatsAppNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour QG, ici ${profile?.prenom} ${profile?.nom}, site ${currentSite?.name}, je vous contacte concernant :`)}` : '';
  const isOnDuty = profile?.statut === 'en_poste' || profile?.statut === 'alerte';

  return (
    <div>
      <PageHeader title={`Bonjour ${profile?.prenom ?? ''}`} subtitle="Interface terrain rapide. SOS accessible en permanence." />
      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-metal">Statut actuel</p>
              <p className="mt-2 text-3xl font-extrabold">{isOnDuty ? 'En poste' : 'Hors poste'}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-extrabold ${isOnDuty ? 'bg-operational/15 text-operational' : 'bg-white/10 text-metal'}`}>{isOnDuty ? 'OPÉRATIONNEL' : 'INACTIF'}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">Site actuel</p><p className="mt-1 font-bold">{profile?.siteActuel ?? 'Aucun site'}</p></div>
            <div className="rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">Heure locale</p><p className="mt-1 flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-electric" /> {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p></div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {actions.map((a) => <Link key={a.to} to={a.to}><Button variant={a.tone} className="w-full justify-start"><a.icon className="mr-2 inline h-5 w-5" /> {a.label}</Button></Link>)}
          </div>
          {isOnDuty && <div className="mt-4 grid gap-3 sm:grid-cols-2"><Link to="/agent/end"><Button variant="ghost" className="w-full"><LogOut className="mr-2 inline h-5 w-5" /> Terminer poste</Button></Link>{whatsAppUrl && <a href={whatsAppUrl} target="_blank" rel="noreferrer"><Button variant="success" className="w-full"><MessageCircle className="mr-2 inline h-5 w-5" /> Contacter QG</Button></a>}</div>}
        </Card>

        <Card className="border-alert/30 bg-alert/10 p-6">
          <ShieldAlert className="h-10 w-10 text-alert" />
          <h2 className="mt-4 text-xl font-extrabold">SOS / PTI</h2>
          <p className="mt-2 text-sm leading-6 text-metal">Maintiens le bouton rouge 2 secondes. Un compte à rebours permet d’annuler avant transmission.</p>
          <p className="mt-4 rounded-2xl bg-obsidian p-3 text-sm font-bold text-alert">En urgence réelle : déclenche SOS. WhatsApp reste non critique.</p>
        </Card>
      </section>
    </div>
  );
}
