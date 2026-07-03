import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID manquant. Exemple: FIREBASE_PROJECT_ID=mon-projet npm run seed');
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId
});

const db = admin.firestore();
const data = JSON.parse(readFileSync(resolve('demo/firestore-demo.json'), 'utf8'));
const now = admin.firestore.FieldValue.serverTimestamp();

async function setCollection(collectionName: string, rows: Array<Record<string, unknown>>, idField: string) {
  for (const row of rows) {
    const id = String(row[idField]);
    await db.collection(collectionName).doc(id).set({ ...row, createdAt: now, updatedAt: now }, { merge: true });
    console.log(`✓ ${collectionName}/${id}`);
  }
}

await setCollection('users', data.users, 'uid');
await setCollection('sites', data.sites, 'siteId');
await setCollection('roundCheckpoints', data.roundCheckpoints, 'checkpointId');
await setCollection('documents', data.documents, 'docId');
await db.collection('settings').doc('general').set({ ...data.settings.general, updatedAt: now }, { merge: true });
console.log('Données de démonstration installées.');
