import type { Timestamp } from 'firebase/firestore';

export type Role = 'agent' | 'superviseur' | 'admin';
export type AgentStatus = 'en_poste' | 'hors_poste' | 'pause' | 'alerte' | 'inactif';
export type Severity = 'normal' | 'surveillance' | 'important' | 'critique';
export type ReportCategory = 'Ronde' | 'Anomalie' | 'Incident' | 'Information' | 'Intervention' | 'Consigne reçue' | 'Prise de service' | 'Fin de service';
export type FlashPriority = 'information' | 'important' | 'urgent' | 'critique';
export type ScanMethod = 'QR' | 'NFC';
export type FireDate = Timestamp | Date | string | null;

export interface GeoPointLite {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface AppUser {
  uid: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  matricule?: string;
  role: Role;
  statut: AgentStatus | 'actif' | 'desactive';
  siteActuel?: string | null;
  sitesAutorises?: string[];
  lastSeen?: FireDate;
  isOnline?: boolean;
  createdAt?: FireDate;
  updatedAt?: FireDate;
  tenantId?: string;
}

export interface Site {
  siteId: string;
  name: string;
  clientName: string;
  address: string;
  gps?: GeoPointLite | null;
  contactName?: string;
  contactPhone?: string;
  emergencyContact?: string;
  instructions?: string;
  fireInstructions?: string;
  intrusionInstructions?: string;
  evacuationInstructions?: string;
  procedures?: string;
  whatsappQG?: string;
  isActive: boolean;
  createdAt?: FireDate;
  updatedAt?: FireDate;
  tenantId?: string;
}

export interface SiteDocument {
  docId: string;
  siteId: string;
  title: string;
  type: 'pdf' | 'image' | 'text';
  url?: string;
  content?: string;
  isDownloadAllowed?: boolean;
  createdAt?: FireDate;
}

export interface Shift {
  shiftId: string;
  agentId: string;
  agentNom: string;
  siteId: string;
  siteNom: string;
  startTime: FireDate;
  endTime?: FireDate;
  positionGPS?: GeoPointLite | null;
  endPositionGPS?: GeoPointLite | null;
  status: 'active' | 'closed';
  reportsCount?: number;
  roundsCount?: number;
  incidentsCount?: number;
  createdAt?: FireDate;
}

export interface Report {
  reportId: string;
  agentId: string;
  agentNom: string;
  siteId: string;
  siteNom: string;
  category: ReportCategory;
  severity: Severity;
  message: string;
  photoUrl?: string | null;
  gps?: GeoPointLite | null;
  createdAt: FireDate;
  status: 'nouveau' | 'traite' | 'archive';
  isLocked: boolean;
  supervisorNote?: string;
  tenantId?: string;
}

export interface Alert {
  alertId: string;
  agentId: string;
  agentNom: string;
  siteActuel?: string | null;
  siteNom?: string | null;
  positionGPS?: GeoPointLite | null;
  heure: FireDate;
  typeAlerte: 'SOS/PTI';
  statut: 'active' | 'prise_en_charge' | 'cloturee' | 'fausse_alerte';
  message: string;
  niveau: 'critique';
  handledBy?: string;
  handledAt?: FireDate;
  closedBy?: string;
  closedAt?: FireDate;
  closureReason?: string;
  actions?: string[];
  tenantId?: string;
}

export interface RoundCheckpoint {
  checkpointId: string;
  siteId: string;
  name: string;
  description?: string;
  zone?: string;
  order: number;
  qrValue: string;
  nfcId?: string;
  isActive: boolean;
}

export interface Round {
  roundId: string;
  agentId: string;
  siteId: string;
  startedAt: FireDate;
  completedAt?: FireDate;
  status: 'active' | 'completed' | 'abandoned';
  checkpointsValidated: string[];
}

export interface RoundCheckpointLog {
  logId: string;
  roundId: string;
  agentId: string;
  siteId: string;
  checkpointId: string;
  checkpointName: string;
  scanMethod: ScanMethod;
  gps?: GeoPointLite | null;
  scannedAt: FireDate;
  isValid: boolean;
}

export interface FlashMessage {
  flashId: string;
  title: string;
  message: string;
  priority: FlashPriority;
  sentBy: string;
  sentAt: FireDate;
  target: 'all' | 'onDuty' | 'site' | 'agent';
  targetId?: string | null;
  readBy: Record<string, FireDate>;
  tenantId?: string;
}

export interface AuditLog {
  logId: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  createdAt: FireDate;
  meta?: Record<string, unknown>;
}
