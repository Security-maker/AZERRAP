# Sentinelle Pro V5.6.3 — Enregistrement OneSignal

Correctif ciblé à partir du ZIP GitHub fourni.

## Modifications
- `serviceWorkerPath` OneSignal est désormais relatif à la racine et sans slash initial.
- Le Worker OneSignal est enregistré explicitement sur `/AZERRAP/push/onesignal/` avant `OneSignal.init()`.
- Le Worker PWA ne met plus `OneSignalSDKWorker.js` en cache.
- Aucun changement Firebase, interface, carte, documents ou facturation.

## Fichiers à remplacer
- `app.js`
- `service-worker.js`

Le fichier `push/onesignal/OneSignalSDKWorker.js` est fourni dans le patch uniquement pour vérification ; son contenu doit rester :
`importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");`
