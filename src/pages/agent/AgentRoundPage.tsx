import { useMemo, useRef, useState } from 'react';
import { addDoc, arrayUnion, collection, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, Nfc, QrCode, ScanLine } from 'lucide-react';
import { db } from '../../config/firebase';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import type { RoundCheckpoint } from '../../types';
import { canUseNFC } from '../../utils/security';

export default function AgentRoundPage() {
  const { profile } = useAuth();
  const { requestPosition } = useGeolocation();
  const checkpointsQuery = useMemo(() => query(collection(db, 'roundCheckpoints'), where('siteId', '==', profile?.siteActuel || '__none__')), [profile?.siteActuel]);
  const { data: checkpoints } = useRealtimeCollection<RoundCheckpoint>(checkpointsQuery, [profile?.siteActuel]);
  const [validated, setValidated] = useState<string[]>([]);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [roundId, setRoundId] = useState<string>('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<unknown>(null);

  async function ensureRound() {
    if (roundId) return roundId;
    if (!profile?.siteActuel || !profile) throw new Error('Prends ton poste avant la ronde.');
    const ref = await addDoc(collection(db, 'rounds'), {
      agentId: profile.uid,
      siteId: profile.siteActuel,
      startedAt: serverTimestamp(),
      status: 'active',
      checkpointsValidated: []
    });
    await updateDoc(doc(db, 'rounds', ref.id), { roundId: ref.id });
    setRoundId(ref.id);
    return ref.id;
  }

  async function validateCheckpoint(cp: RoundCheckpoint, method: 'QR' | 'NFC') {
    if (!profile || !profile.siteActuel) { alert('Prends ton poste avant la ronde.'); return; }
    const rid = await ensureRound();
    const gps = await requestPosition();
    await addDoc(collection(db, 'roundCheckpointsLogs'), {
      roundId: rid,
      agentId: profile.uid,
      siteId: profile.siteActuel,
      checkpointId: cp.checkpointId,
      checkpointName: cp.name,
      scanMethod: method,
      gps,
      scannedAt: serverTimestamp(),
      isValid: true
    });
    await updateDoc(doc(db, 'rounds', rid), { checkpointsValidated: arrayUnion(cp.checkpointId) });
    setValidated((v) => v.includes(cp.checkpointId) ? v : [...v, cp.checkpointId]);
    setScanLog((v) => [`${new Date().toLocaleTimeString('fr-FR')} · ${cp.name} · ${method} · ${gps ? 'GPS OK' : 'GPS refusé'}`, ...v]);
  }

  async function startScanner() {
    setScannerActive(true);
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, async (decodedText) => {
      const cp = checkpoints.find((item) => item.qrValue === decodedText || item.checkpointId === decodedText);
      if (cp) {
        await validateCheckpoint(cp, 'QR');
        await scanner.stop();
        setScannerActive(false);
      }
    }, () => undefined);
  }

  async function stopScanner() {
    const scanner = scannerRef.current as { stop?: () => Promise<void> } | null;
    if (scanner?.stop) await scanner.stop();
    setScannerActive(false);
  }

  const percent = checkpoints.length ? Math.round((validated.length / checkpoints.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Validation de ronde" subtitle="QR prioritaire. NFC disponible uniquement selon navigateur et appareil." />
      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <Card>
          <h2 className="text-xl font-extrabold">Progression</h2>
          <div className="mt-4 h-4 rounded-full bg-obsidian"><div className="h-4 rounded-full bg-operational" style={{ width: `${percent}%` }} /></div>
          <p className="mt-3 text-sm font-bold text-metal">{validated.length}/{checkpoints.length} points contrôlés · {percent}%</p>
          <div className="mt-5 grid gap-3">
            <Button variant="secondary" onClick={scannerActive ? stopScanner : startScanner}><QrCode className="mr-2 inline h-4 w-4" /> {scannerActive ? 'Fermer scanner' : 'Ouvrir scanner QR'}</Button>
            <Button variant={canUseNFC() ? 'secondary' : 'ghost'} disabled={!canUseNFC()}><Nfc className="mr-2 inline h-4 w-4" /> NFC {canUseNFC() ? 'compatible' : 'indisponible'}</Button>
          </div>
          {scannerActive && <div className="mt-4 rounded-3xl border border-electric/30 bg-obsidian p-3"><div id="qr-reader" className="overflow-hidden rounded-2xl" /></div>}
          <p className="mt-4 text-xs text-metal">Chaque validation écrit un log Firestore horodaté. QR universel, NFC en option selon support navigateur.</p>
        </Card>
        <Card>
          <h2 className="text-xl font-extrabold"><ScanLine className="mr-2 inline h-5 w-5 text-electric" />Points de ronde</h2>
          <div className="mt-4 space-y-3">
            {checkpoints.sort((a, b) => a.order - b.order).map((cp) => <div key={cp.checkpointId} className="flex items-center justify-between gap-3 rounded-3xl bg-obsidian p-4"><div><p className="font-bold">{cp.order}. {cp.name}</p><p className="text-sm text-metal">{cp.zone} · {cp.description}</p></div>{validated.includes(cp.checkpointId) ? <CheckCircle2 className="h-6 w-6 text-operational" /> : <Button variant="secondary" onClick={() => validateCheckpoint(cp, 'QR')}>Valider QR</Button>}</div>)}
            {checkpoints.length === 0 && <p className="text-sm text-metal">Aucun point de ronde configuré sur ce site.</p>}
          </div>
        </Card>
      </div>
      <Card className="mt-4"><h2 className="font-extrabold">Historique des passages</h2><div className="mt-3 space-y-2">{scanLog.map((l) => <p className="rounded-2xl bg-obsidian p-3 text-sm" key={l}>{l}</p>)}</div></Card>
    </div>
  );
}
