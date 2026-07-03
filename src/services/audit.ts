import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function auditLog(params: {
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  await addDoc(collection(db, 'auditLogs'), {
    ...params,
    createdAt: serverTimestamp()
  });
}
