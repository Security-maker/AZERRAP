import { useEffect, useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { Search, ExternalLink } from 'lucide-react';
import { db } from '../../config/firebase';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { getDocsBySite } from '../../services/firestoreService';
import type { Site, SiteDocument } from '../../types';

export default function AgentDocsPage() {
  const { profile } = useAuth();
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);
  const [docs, setDocs] = useState<SiteDocument[]>([]);
  const [search, setSearch] = useState('');
  const site = useMemo(() => sites.find((s) => s.siteId === profile?.siteActuel || (s as never as { id: string }).id === profile?.siteActuel), [sites, profile?.siteActuel]);

  useEffect(() => {
    if (!profile?.siteActuel) return;
    getDocsBySite(profile.siteActuel).then((d) => setDocs(d as SiteDocument[])).catch(() => setDocs([]));
  }, [profile?.siteActuel]);

  const haystack = `${site?.instructions} ${site?.fireInstructions} ${site?.intrusionInstructions} ${site?.evacuationInstructions} ${site?.procedures}`.toLowerCase();
  const hasSearch = search.trim() && haystack.includes(search.toLowerCase());

  return (
    <div>
      <PageHeader title="Documentation Site" subtitle="Consignes, contacts, plans et procédures du site sélectionné." />
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-night px-4"><Search className="h-4 w-4 text-metal" /><Input className="border-0 bg-transparent" placeholder="Recherche rapide dans les consignes" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {!site ? <Card>Aucun site actif. Prends ton poste pour charger la documentation.</Card> : (
        <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <Card>
            <h2 className="text-xl font-extrabold">{site.name}</h2>
            <p className="mt-1 text-sm text-metal">{site.address}</p>
            <DocBlock title="Consignes générales" text={site.instructions} highlight={!!hasSearch} />
            <DocBlock title="Consignes incendie" text={site.fireInstructions} />
            <DocBlock title="Consignes intrusion" text={site.intrusionInstructions} />
            <DocBlock title="Consignes évacuation" text={site.evacuationInstructions} />
            <DocBlock title="Procédures spécifiques" text={site.procedures} />
            <div className="mt-4 rounded-3xl bg-obsidian p-4"><p className="text-xs text-metal">Contacts utiles</p><p className="mt-2 font-bold">{site.contactName} · {site.contactPhone}</p><p className="mt-1 text-sm text-alert">Urgence : {site.emergencyContact}</p></div>
          </Card>
          <Card>
            <h2 className="text-xl font-extrabold">Plans et fichiers</h2>
            <p className="mt-2 text-sm text-metal">Les fichiers déjà chargés peuvent rester disponibles en cache selon le navigateur.</p>
            <div className="mt-4 space-y-3">
              {docs.length === 0 && <p className="text-sm text-metal">Aucun document lié à ce site.</p>}
              {docs.map((d) => <a key={d.docId} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-3xl border border-white/10 bg-obsidian p-4"><span><b>{d.title}</b><br /><small className="text-metal">{d.type.toUpperCase()}</small></span><ExternalLink className="h-5 w-5 text-electric" /></a>)}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
function DocBlock({ title, text, highlight = false }: { title: string; text?: string; highlight?: boolean }) { return <div className={`mt-4 rounded-3xl p-4 ${highlight ? 'bg-electric/10 border border-electric/30' : 'bg-obsidian'}`}><p className="text-xs font-bold text-metal">{title}</p><p className="mt-2 text-sm leading-6">{text || 'Non renseigné.'}</p></div>; }
