# Sentinelle Pro V4.7 — Notifications GitHub Edition

Version GitHub + Firebase Spark + OneSignal + Cloudflare Worker.

## Ce que cette version ajoute

- Notifications écran verrouillé via OneSignal.
- Bouton agent : Activer notifications écran verrouillé.
- Identification OneSignal par UID Firebase.
- Tags OneSignal : rôle, statut, site actuel.
- Flash QG envoyé dans l’application + tentative de notification push.
- Cibles Flash : tous les agents, agents en poste, site précis, agent précis.
- Cloudflare Worker inclus pour envoyer les notifications sans exposer la clé REST OneSignal dans GitHub.

## Ce qui reste inchangé

- GitHub Pages héberge l’application.
- Firebase Spark conserve Auth + Firestore.
- Firebase Storage n’est pas utilisé.
- Firebase Cloud Functions n’est pas obligatoire.

## Fichiers à remplacer sur GitHub

Remplace tout sauf ton fichier `firebase-config.js` si tu as déjà tes clés Firebase dedans.

Si tu remplaces `firebase-config.js`, remets tes clés Firebase puis complète la partie `pushConfig`.

## Configuration Firebase

Dans Firebase, publie uniquement les règles Firestore avec le fichier `firestore.rules`.

Storage n’est pas nécessaire.

## Configuration OneSignal

1. Crée un compte OneSignal.
2. Crée une application Web Push.
3. Renseigne ton URL GitHub Pages.
4. Dans les paramètres Web Push, indique le fichier service worker OneSignal :
   - Path : `/NOM_DU_REPO/push/onesignal/`
   - Filename : `OneSignalSDKWorker.js`
   - Scope : `/NOM_DU_REPO/push/onesignal/`

Exemple si ton app est ici :
`https://nacer.github.io/sentinelle-pro/`

Alors :
- Path : `/sentinelle-pro/push/onesignal/`
- Scope : `/sentinelle-pro/push/onesignal/`

## Configuration firebase-config.js

```js
export const pushConfig = {
  pushProvider: "onesignal",
  oneSignalAppId: "TON_APP_ID_ONESIGNAL",
  pushWorkerUrl: "https://ton-worker.ton-compte.workers.dev"
};
```

## Configuration Cloudflare Worker

Le code du Worker est dans :

`worker/onesignal-worker.js`

Dans Cloudflare Workers, crée ces variables/secrets :

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `SENTINELLE_PUSH_SECRET`
- `ALLOWED_ORIGIN` optionnel, ex: `https://tonpseudo.github.io`

La clé `SENTINELLE_PUSH_SECRET` doit ensuite être collée côté admin dans :

Flash QG > Configurer la clé d’envoi push sur ce PC

## Activation côté agent

Sur iPhone :

1. Ouvrir l’app depuis Safari.
2. Ajouter à l’écran d’accueil.
3. Ouvrir l’app depuis l’icône créée.
4. Se connecter agent.
5. Appuyer sur “Activer notifications écran verrouillé”.
6. Accepter l’autorisation iOS.

Sur Android / ordinateur :

1. Ouvrir l’app.
2. Se connecter agent.
3. Appuyer sur “Activer notifications écran verrouillé”.
4. Accepter l’autorisation navigateur.

## Test

1. Agent : active les notifications.
2. Admin : va dans Flash QG.
3. Envoie un Flash à l’agent ou aux agents en poste.
4. Le Flash apparaît dans l’app.
5. Si OneSignal + Worker sont bien configurés, une notification push est envoyée.

## Important

Sur iPhone, les notifications web exigent une PWA installée sur l’écran d’accueil. Si l’app est ouverte uniquement dans Safari, iOS ne déclenche pas les notifications écran verrouillé.
