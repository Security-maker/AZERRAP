# Sentinelle Pro V5.6.5 — OneSignal propre

Fichiers à remplacer/ajouter :
- `index.html`
- `app.js`
- `service-worker.js`
- `push-init.js` (nouveau)
- `push/onesignal/OneSignalSDKWorker.js`

Cette version utilise deux Service Workers avec des scopes distincts :
- PWA : `/AZERRAP/`
- OneSignal : `/AZERRAP/push/onesignal/`

Le SDK OneSignal est chargé une seule fois selon le modèle officiel.
