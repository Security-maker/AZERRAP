// V5.8.0 — Passerelle de migration progressive Firebase -> Supabase.
// La production reste sur Firebase tant que enabled=false ou mode='firebase'.
export const supabaseConfig = Object.freeze({
  enabled: false,
  mode: 'firebase', // firebase | dual | supabase
  url: 'REMPLACE_MOI_PAR_URL_SUPABASE',
  publishableKey: 'REMPLACE_MOI_PAR_CLE_PUBLIQUE_SUPABASE',
  organizationId: 'REMPLACE_MOI_PAR_UUID_ORGANISATION',
  reportBucket: 'main-courantes',
  autoEmail: true,
  emailFunction: 'send-main-courante'
});
