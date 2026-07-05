# Cloudflare Worker — Notifications Sentinelle Pro

Ce Worker sert de mini-backend sécurisé pour envoyer les notifications OneSignal sans exposer la clé REST dans GitHub.

## Variables / Secrets à créer dans Cloudflare

- `ONESIGNAL_APP_ID` : App ID OneSignal
- `ONESIGNAL_REST_API_KEY` : REST API Key OneSignal
- `SENTINELLE_PUSH_SECRET` : clé secrète d'envoi, à choisir toi-même
- `ALLOWED_ORIGIN` : optionnel, ex: `https://tonpseudo.github.io`

## Dans Sentinelle Pro

Dans `firebase-config.js`, renseigne :

```js
export const pushConfig = {
  pushProvider: "onesignal",
  oneSignalAppId: "TON_APP_ID_ONESIGNAL",
  pushWorkerUrl: "https://ton-worker.ton-compte.workers.dev"
};
```

Côté admin, va dans Flash QG > Configurer la clé d’envoi push, puis colle la même valeur que `SENTINELLE_PUSH_SECRET`.
