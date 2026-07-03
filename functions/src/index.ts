import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

async function requireSupervisor(uid?: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const profile = await db.collection('users').doc(uid).get();
  const role = profile.data()?.role;
  if (!['admin', 'superviseur'].includes(role)) throw new HttpsError('permission-denied', 'Accès QG requis.');
  return profile.data();
}

export const createPortalUser = onCall({ region: 'europe-west1' }, async (request) => {
  await requireSupervisor(request.auth?.uid);
  const { email, password, prenom, nom, telephone, role = 'agent', sitesAutorises = [] } = request.data || {};
  if (!email || !password || !prenom || !nom) throw new HttpsError('invalid-argument', 'Champs obligatoires manquants.');
  if (!['agent', 'superviseur', 'admin'].includes(role)) throw new HttpsError('invalid-argument', 'Rôle invalide.');

  const user = await getAuth().createUser({ email, password, displayName: `${prenom} ${nom}`, phoneNumber: telephone || undefined });
  await getAuth().setCustomUserClaims(user.uid, { role });
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    prenom,
    nom,
    email,
    telephone: telephone || '',
    role,
    statut: role === 'agent' ? 'hors_poste' : 'actif',
    siteActuel: null,
    sitesAutorises,
    isOnline: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.collection('auditLogs').add({ actorId: request.auth?.uid, action: 'USER_CREATE', targetType: 'user', targetId: user.uid, createdAt: FieldValue.serverTimestamp() });
  return { uid: user.uid };
});
