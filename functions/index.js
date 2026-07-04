import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

function flashTargetMatches(flash, token, user){
  if (!token?.enabled || !token.token) return false;
  if (!flash?.target || flash.target === 'all') return true;
  if (flash.target === 'working') return user?.statut === 'en_poste';
  if (flash.target.startsWith('agent:')) return flash.target === `agent:${token.userId}`;
  if (flash.target.startsWith('site:')) return flash.target === `site:${user?.siteActuel || token.siteActuel || ''}`;
  return false;
}

function chunk(array, size){
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

export const sendFlashPush = onDocumentCreated('flashMessages/{flashId}', async event => {
  const flash = event.data?.data();
  if (!flash) return;

  const [tokensSnap, usersSnap] = await Promise.all([
    db.collection('pushTokens').where('enabled', '==', true).get(),
    db.collection('users').get()
  ]);

  const users = new Map(usersSnap.docs.map(doc => [doc.id, { id:doc.id, ...doc.data() }]));
  const tokens = tokensSnap.docs
    .map(doc => ({ id:doc.id, ...doc.data() }))
    .filter(token => flashTargetMatches(flash, token, users.get(token.userId)));

  if (!tokens.length) {
    await event.data.ref.set({ pushStatus:{ sent:0, failed:0, updatedAt:new Date(), note:'Aucun appareil enregistré pour cette cible' } }, { merge:true });
    return;
  }

  const title = flash.title || 'Message Flash QG';
  const body = flash.message || 'Nouveau message Sentinelle Pro';
  let sent = 0;
  let failed = 0;

  for (const group of chunk(tokens, 500)) {
    const response = await messaging.sendEachForMulticast({
      tokens: group.map(t => t.token),
      notification: { title, body },
      data: {
        flashId: event.params.flashId,
        priority: String(flash.priority || 'Information'),
        title,
        message: body,
        url: './index.html'
      },
      webpush: {
        notification: {
          title,
          body,
          icon: './assets/icons/icon-192.png',
          badge: './assets/icons/icon-192.png',
          requireInteraction: flash.priority === 'Critique',
          tag: `flash-${event.params.flashId}`
        }
      }
    });
    sent += response.successCount;
    failed += response.failureCount;

    await Promise.all(response.responses.map((r, index) => {
      if (r.success) return null;
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        return db.collection('pushTokens').doc(group[index].id).set({ enabled:false, disabledReason:code, updatedAt:new Date() }, { merge:true });
      }
      return null;
    }).filter(Boolean));
  }

  await event.data.ref.set({ pushStatus:{ sent, failed, updatedAt:new Date() } }, { merge:true });
});
