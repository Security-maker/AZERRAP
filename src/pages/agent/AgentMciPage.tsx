import { FormEvent, useMemo, useState } from 'react';
import { Mic, Send, Camera, MapPin } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Select, Textarea } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { createReport } from '../../services/firestoreService';
import { uploadReportPhoto } from '../../services/storageService';
import { REPORT_CATEGORIES, SEVERITY_OPTIONS } from '../../constants';
import type { ReportCategory, Severity, Site } from '../../types';
import { sanitizeText } from '../../utils/security';

export default function AgentMciPage() {
  const { profile } = useAuth();
  const { requestPosition, status } = useGeolocation();
  const { data: sites } = useRealtimeCollection<Site>(collection(db, 'sites') as never, []);
  const currentSite = useMemo(() => sites.find((s) => s.siteId === profile?.siteActuel || (s as never as { id: string }).id === profile?.siteActuel), [sites, profile?.siteActuel]);
  const [category, setCategory] = useState<ReportCategory>('Information');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [dictating, setDictating] = useState(false);
  const [includeGps, setIncludeGps] = useState(false);
  const [loading, setLoading] = useState(false);

  function simulateDictation() {
    setDictating(true);
    setTimeout(() => {
      setMessage((v) => `${v}${v ? '\n' : ''}Ronde effectuée, aucun élément suspect constaté à ce stade.`);
      setDictating(false);
    }, 1200);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile || !currentSite) { alert('Prends ton poste avant d’envoyer un rapport.'); return; }
    if (sanitizeText(message, 20).length < 5) { alert('Rapport trop court.'); return; }
    setLoading(true);
    try {
      const gps = includeGps ? await requestPosition() : null;
      let photoUrl: string | null = null;
      if (photo) photoUrl = await uploadReportPhoto(photo, `${profile.uid}-${Date.now()}`);
      await createReport({ agent: profile, site: { ...currentSite, siteId: currentSite.siteId || (currentSite as never as { id: string }).id }, category, severity, message, gps, photoUrl });
      setMessage(''); setPhoto(null); setIncludeGps(false);
      alert('Rapport envoyé au QG.');
    } catch (e) { alert(e instanceof Error ? e.message : 'Rapport non envoyé.'); } finally { setLoading(false); }
  }

  return (
    <div>
      <PageHeader title="Main Courante Intelligente" subtitle="Deux clics pour déclarer. Le rapport est verrouillé après envoi." />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_.45fr]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>{REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{REPORT_CATEGORIES.map((c) => <button type="button" key={c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-2 text-xs font-bold ${category === c ? 'border-electric bg-electric/15 text-electric' : 'border-white/10 text-metal'}`}>{c}</button>)}</div>
          <Textarea className="mt-4" placeholder="Saisir le rapport opérationnel..." value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={simulateDictation}><Mic className="mr-2 inline h-4 w-4" /> {dictating ? 'Dictée en cours...' : 'Micro simulation'}</Button>
            <label className="focus-ring inline-flex min-h-12 cursor-pointer items-center rounded-2xl border border-white/10 bg-night px-4 py-3 text-sm font-bold text-cold"><Camera className="mr-2 h-4 w-4" /> Photo<input className="hidden" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
            <Button type="button" variant={includeGps ? 'success' : 'ghost'} onClick={() => setIncludeGps((v) => !v)}><MapPin className="mr-2 inline h-4 w-4" /> GPS</Button>
          </div>
          <Button disabled={loading} className="mt-5 w-full"><Send className="mr-2 inline h-4 w-4" /> {loading ? 'Envoi sécurisé...' : 'Envoyer au QG'}</Button>
        </Card>
        <Card>
          <h2 className="font-extrabold">Contexte</h2>
          <p className="mt-3 text-sm text-metal">Site : <b className="text-cold">{currentSite?.name ?? 'Aucun poste actif'}</b></p>
          <p className="mt-2 text-sm text-metal">GPS : {status}</p>
          <p className="mt-2 text-sm text-metal">Photo : {photo?.name ?? 'Aucune'}</p>
          <p className="mt-5 rounded-2xl bg-obsidian p-3 text-xs font-semibold text-metal">Après envoi, le rapport apparaît instantanément côté QG et reste non modifiable par l’agent.</p>
        </Card>
      </form>
    </div>
  );
}
