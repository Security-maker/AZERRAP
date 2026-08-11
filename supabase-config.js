// Sentinelle Pro V5.9.0 — Supabase natif PRODUCTION.
// Storage PDF actif. Envoi e-mail automatique laissé désactivé pour le cutover initial.
// Il pourra être activé après validation de la fonction send-main-courante en production.
export const supabaseConfig = Object.freeze({
  enabled: true,
  mode: 'supabase',
  url: 'https://ksoyqtsrhtsfbwmxipqz.supabase.co',
  publishableKey: 'sb_publishable_TaSZX6F0nsEecsHPxjZ8hg_c1cZtQuN',
  organizationId: '43b09366-de36-5b44-97cc-d549eb0d4e53',
  reportBucket: 'main-courantes',
  autoEmail: false,
  emailFunction: 'send-main-courante'
});
