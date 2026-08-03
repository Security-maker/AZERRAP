# Cloudflare Worker — Notifications Sentinelle Pro V5.8.1

Ce Worker envoie les notifications OneSignal sans exposer la clé REST dans l’application.

## Variables et secrets Cloudflare

- `ONESIGNAL_APP_ID` : App ID OneSignal.
- `ONESIGNAL_REST_API_KEY` : REST API Key OneSignal.
- `SENTINELLE_PUSH_SECRET` : secret utilisé par les envois administrateur existants.
- `ALLOWED_ORIGIN` : domaine exact de Sentinelle Pro.
- `FIREBASE_PROJECT_ID` : `azzerap-7b440`.

## Protection de la notification « prise de poste »

L’application agent transmet son jeton Firebase au Worker. Le Worker :

1. vérifie la signature et les informations du jeton ;
2. vérifie que la demande concerne uniquement une prise de poste à destination du QG ;
3. relit la vacation correspondante dans Firestore ;
4. contrôle qu’elle est active et appartient à l’agent connecté ;
5. construit lui-même le titre et le message de la notification ;
6. utilise une clé d’idempotence liée à l’identifiant de la prise de poste.

Une erreur de notification ne bloque pas la prise de poste dans l’application.

## Configuration de l’application

Dans `firebase-config.js`, conserver l’URL du Worker :

```js
export const pushConfig = {
  pushProvider: "onesignal",
  oneSignalAppId: "TON_APP_ID_ONESIGNAL",
  pushWorkerUrl: "https://ton-worker.ton-compte.workers.dev"
};
```

Les notifications Flash QG continuent d’utiliser le secret existant. La notification de prise de poste utilise directement l’identité Firebase de l’agent.
