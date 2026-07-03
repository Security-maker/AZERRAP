import { FormEvent, useState } from 'react';
import { collection } from 'firebase/firestore';
import { Send } from 'lucide-react';
import { db } from '../../config/firebase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { sendFlash } from '../../services/firestoreService';
import type { FlashMessage } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function QgFlashPage() {
  const { profile } = useAuth();
  const { data: messages } = useRealtimeCollection<FlashMessage>(collection(db, 'flashMessages') as never, []);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<FlashMessage['priority']>('important');
  const [target, setTarget] = useState<FlashMessage['target']>('all');
  const [targetId, setTargetId] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (priority === 'critique' && !confirm('Confirmer l’envoi d’un Flash critique ?')) return;
    await sendFlash({ supervisor: profile, title, message, priority, target, targetId: targetId || null });
    setTitle(''); setMessage(''); setTargetId('');
    alert('Message Flash envoyé.');
  }

  return (
    <div>
      <PageHeader title="Alerte descendante Flash" subtitle="Envoyer un message prioritaire aux agents et suivre les lectures." />
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <form onSubmit={submit} className="grid gap-3">
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea placeholder="Message opérationnel" value={message} onChange={(e) => setMessage(e.target.value)} required />
            <Select value={priority} onChange={(e) => setPriority(e.target.value as FlashMessage['priority'])}><option value="information">Information</option><option value="important">Important</option><option value="urgent">Urgent</option><option value="critique">Critique</option></Select>
            <Select value={target} onChange={(e) => setTarget(e.target.value as FlashMessage['target'])}><option value="all">Tous les agents</option><option value="onDuty">Agents en poste</option><option value="site">Agents d’un site</option><option value="agent">Agent spécifique</option></Select>
            {(target === 'site' || target === 'agent') && <Input placeholder="ID site ou UID agent" value={targetId} onChange={(e) => setTargetId(e.target.value)} />}
            <Button><Send className="mr-2 inline h-4 w-4" /> Envoyer Flash</Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-xl font-extrabold">Historique</h2>
          <div className="mt-4 space-y-3">
            {messages.map((m) => <div key={m.flashId} className="rounded-3xl bg-obsidian p-4"><div className="flex items-center gap-2"><Badge tone={m.priority === 'critique' ? 'critique' : 'info'}>{m.priority}</Badge><small className="text-metal">{toReadableDate(m.sentAt)}</small></div><p className="mt-2 font-bold">{m.title}</p><p className="mt-1 text-sm text-metal">{m.message}</p><p className="mt-2 text-xs text-electric">Lectures : {Object.keys(m.readBy || {}).length}</p></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
