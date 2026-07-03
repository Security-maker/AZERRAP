import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { auditLog } from './audit';
import type {
  AppUser,
  FlashMessage,
  GeoPointLite,
  ReportCategory,
  Severity,
  Site
} from '../types';
import { sanitizeText } from '../utils/security';

export async function getActiveShift(agentId: string) {
  const snap = await getDocs(query(collection(db, 'shifts'), where('agentId', '==', agentId), where('status', '==', 'active'), limit(1)));
  return snap.docs[0] ?? null;
}

export async function startShift(params: { agent: AppUser; site: Site; gps: GeoPointLite | null }) {
  const existing = await getActiveShift(params.agent.uid);
  if (existing) throw new Error('Un poste est déjà actif. Termine le poste avant d’en ouvrir un autre.');

  const shiftRef = doc(collection(db, 'shifts'));
  const batch = writeBatch(db);
  batch.set(shiftRef, {
    shiftId: shiftRef.id,
    agentId: params.agent.uid,
    agentNom: `${params.agent.prenom} ${params.agent.nom}`,
    siteId: params.site.siteId,
    siteNom: params.site.name,
    startTime: serverTimestamp(),
    positionGPS: params.gps,
    status: 'active',
    reportsCount: 0,
    roundsCount: 0,
    incidentsCount: 0,
    createdAt: serverTimestamp()
  });
  batch.update(doc(db, 'users', params.agent.uid), {
    statut: 'en_poste',
    siteActuel: params.site.siteId,
    updatedAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  });
  await batch.commit();
  await auditLog({ actorId: params.agent.uid, actorName: `${params.agent.prenom} ${params.agent.nom}`, action: 'SHIFT_START', targetType: 'shift', targetId: shiftRef.id });
  return shiftRef.id;
}

export async function endShift(params: { agent: AppUser; gps: GeoPointLite | null; summary: Record<string, unknown> }) {
  const active = await getActiveShift(params.agent.uid);
  if (!active) throw new Error('Aucun poste actif à terminer.');
  const batch = writeBatch(db);
  batch.update(active.ref, {
    endTime: serverTimestamp(),
    endPositionGPS: params.gps,
    status: 'closed',
    summary: params.summary,
    updatedAt: serverTimestamp()
  });
  batch.update(doc(db, 'users', params.agent.uid), {
    statut: 'hors_poste',
    siteActuel: null,
    updatedAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  });
  await batch.commit();
  await auditLog({ actorId: params.agent.uid, actorName: `${params.agent.prenom} ${params.agent.nom}`, action: 'SHIFT_END', targetType: 'shift', targetId: active.id, meta: params.summary });
}

export async function createReport(params: {
  agent: AppUser;
  site: Site;
  category: ReportCategory;
  severity: Severity;
  message: string;
  gps: GeoPointLite | null;
  photoUrl?: string | null;
}) {
  const active = await getActiveShift(params.agent.uid);
  if (!active) throw new Error('Prends ton poste avant d’envoyer une main courante.');
  const ref = doc(collection(db, 'reports'));
  await setDoc(ref, {
    reportId: ref.id,
    agentId: params.agent.uid,
    agentNom: `${params.agent.prenom} ${params.agent.nom}`,
    siteId: params.site.siteId,
    siteNom: params.site.name,
    category: params.category,
    severity: params.severity,
    message: sanitizeText(params.message),
    photoUrl: params.photoUrl ?? null,
    gps: params.gps,
    createdAt: serverTimestamp(),
    status: 'nouveau',
    isLocked: true
  });
  await auditLog({ actorId: params.agent.uid, actorName: `${params.agent.prenom} ${params.agent.nom}`, action: 'REPORT_CREATE', targetType: 'report', targetId: ref.id });
  return ref.id;
}

export async function triggerSos(params: { agent: AppUser; site?: Site | null; gps: GeoPointLite | null }) {
  const ref = doc(collection(db, 'alerts'));
  await setDoc(ref, {
    alertId: ref.id,
    agentId: params.agent.uid,
    agentNom: `${params.agent.prenom} ${params.agent.nom}`,
    siteActuel: params.agent.siteActuel ?? null,
    siteNom: params.site?.name ?? null,
    positionGPS: params.gps,
    heure: serverTimestamp(),
    typeAlerte: 'SOS/PTI',
    statut: 'active',
    message: 'Alerte PTI déclenchée par l’agent',
    niveau: 'critique'
  });
  await updateDoc(doc(db, 'users', params.agent.uid), { statut: 'alerte', updatedAt: serverTimestamp() });
  await auditLog({ actorId: params.agent.uid, actorName: `${params.agent.prenom} ${params.agent.nom}`, action: 'SOS_TRIGGER', targetType: 'alert', targetId: ref.id });
  return ref.id;
}

export async function falseSos(params: { alertId: string; agent: AppUser }) {
  await updateDoc(doc(db, 'alerts', params.alertId), {
    statut: 'fausse_alerte',
    closedAt: serverTimestamp(),
    closureReason: 'Fausse alerte déclarée par l’agent avec confirmation',
    updatedAt: serverTimestamp()
  });
  await auditLog({ actorId: params.agent.uid, actorName: `${params.agent.prenom} ${params.agent.nom}`, action: 'SOS_FALSE_ALERT', targetType: 'alert', targetId: params.alertId });
}

export async function handleAlert(params: { alertId: string; supervisor: AppUser }) {
  await updateDoc(doc(db, 'alerts', params.alertId), {
    statut: 'prise_en_charge',
    handledBy: params.supervisor.uid,
    handledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await auditLog({ actorId: params.supervisor.uid, actorName: `${params.supervisor.prenom} ${params.supervisor.nom}`, action: 'SOS_HANDLE', targetType: 'alert', targetId: params.alertId });
}

export async function closeAlert(params: { alertId: string; supervisor: AppUser; reason: string }) {
  if (params.reason.trim().length < 8) throw new Error('Justification obligatoire pour clôturer.');
  await updateDoc(doc(db, 'alerts', params.alertId), {
    statut: 'cloturee',
    closedBy: params.supervisor.uid,
    closedAt: serverTimestamp(),
    closureReason: sanitizeText(params.reason, 1000),
    updatedAt: serverTimestamp()
  });
  await auditLog({ actorId: params.supervisor.uid, actorName: `${params.supervisor.prenom} ${params.supervisor.nom}`, action: 'SOS_CLOSE', targetType: 'alert', targetId: params.alertId, meta: { reason: params.reason } });
}

export async function sendFlash(params: {
  supervisor: AppUser;
  title: string;
  message: string;
  priority: FlashMessage['priority'];
  target: FlashMessage['target'];
  targetId?: string | null;
}) {
  const ref = doc(collection(db, 'flashMessages'));
  await setDoc(ref, {
    flashId: ref.id,
    title: sanitizeText(params.title, 120),
    message: sanitizeText(params.message, 1200),
    priority: params.priority,
    sentBy: params.supervisor.uid,
    sentAt: serverTimestamp(),
    target: params.target,
    targetId: params.targetId ?? null,
    readBy: {}
  });
  await auditLog({ actorId: params.supervisor.uid, actorName: `${params.supervisor.prenom} ${params.supervisor.nom}`, action: 'FLASH_SEND', targetType: 'flashMessage', targetId: ref.id });
}

export async function markFlashRead(flashId: string, agent: AppUser) {
  await updateDoc(doc(db, 'flashMessages', flashId), {
    [`readBy.${agent.uid}`]: serverTimestamp()
  });
}

export async function upsertAgent(agent: Partial<AppUser> & { uid: string }) {
  await setDoc(doc(db, 'users', agent.uid), { ...agent, updatedAt: serverTimestamp() }, { merge: true });
}

export async function upsertSite(site: Partial<Site> & { siteId?: string }) {
  const ref = site.siteId ? doc(db, 'sites', site.siteId) : doc(collection(db, 'sites'));
  await setDoc(ref, { ...site, siteId: ref.id, updatedAt: serverTimestamp(), createdAt: site.createdAt ?? serverTimestamp() }, { merge: true });
  return ref.id;
}

export const q = {
  sitesActive: () => query(collection(db, 'sites'), where('isActive', '==', true), orderBy('name', 'asc')),
  reportsRecent: () => query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(80)),
  alertsActive: () => query(collection(db, 'alerts'), where('statut', 'in', ['active', 'prise_en_charge']), orderBy('heure', 'desc')),
  agents: () => query(collection(db, 'users'), orderBy('nom', 'asc')),
  flashRecent: () => query(collection(db, 'flashMessages'), orderBy('sentAt', 'desc'), limit(30))
};

export async function getDocsBySite(siteId: string) {
  const snap = await getDocs(query(collection(db, 'documents'), where('siteId', '==', siteId), orderBy('title', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
