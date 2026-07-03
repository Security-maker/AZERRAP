import { collection } from 'firebase/firestore';
import { BellRing } from 'lucide-react';
import { db } from '../../config/firebase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeCollection } from '../../hooks/useRealtimeCollection';
import { markFlashRead } from '../../services/firestoreService';
import type { FlashMessage } from '../../types';
import { toReadableDate } from '../../utils/date';

export default function AgentFlashPage() {
  const { profile } = useAuth();
  const { data: messages } = useRealtimeCollection<FlashMessage>(collection(db, 'flashMessages') as never, []);
  const filtered = messages.filter((m) => m.target === 'all' || m.target === 'onDuty' || (m.target === 'agent' && m.targetId === profile?.uid) || (m.target === 'site' && m.targetId === profile?.siteActuel));

  return (
    <div>
      <PageHeader title="Messages Flash" subtitle="Confirme la lecture des messages opérationnels." />
      <div className="space-y-3">
        {filtered.map((m) => {
          const isRead = !!(profile && m.readBy?.[profile.uid]);
          return <Card key={m.flashId} className={m.priority === 'critique' ? 'border-alert/40 bg-alert/10' : ''}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><Badge tone={m.priority === 'critique' ? 'critique' : 'info'}>{m.priority}</Badge><h2 className="mt-3 text-xl font-extrabold"><BellRing className="mr-2 inline h-5 w-5 text-electric" />{m.title}</h2><p className="mt-2 text-sm leading-6 text-metal">{m.message}</p><p className="mt-3 text-xs text-metal">Envoyé : {toReadableDate(m.sentAt)}</p></div>
              <Button variant={isRead ? 'ghost' : 'primary'} disabled={isRead} onClick={() => profile && markFlashRead(m.flashId, profile)}>{isRead ? 'Lecture confirmée' : 'Confirmer lecture'}</Button>
            </div>
          </Card>;
        })}
        {filtered.length === 0 && <Card>Aucun message flash.</Card>}
      </div>
    </div>
  );
}
