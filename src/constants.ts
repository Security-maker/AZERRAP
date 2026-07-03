export const APP_NAME = 'Sentinelle Pro';
export const DEFAULT_TENANT_ID = 'demo-agence';

export const REPORT_CATEGORIES = [
  'Ronde',
  'Anomalie',
  'Incident',
  'Information',
  'Intervention',
  'Consigne reçue',
  'Prise de service',
  'Fin de service'
] as const;

export const SEVERITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'surveillance', label: 'À surveiller' },
  { value: 'important', label: 'Important' },
  { value: 'critique', label: 'Critique' }
] as const;
