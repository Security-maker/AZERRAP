# Sentinelle Pro V5.1.1 — Correctif carte opérationnelle

Correctif ciblé pour la carte QG.

## Corrections

- Correction des tuiles Leaflet qui s'affichaient en gros blocs décalés.
- Ajout de règles CSS critiques Leaflet directement dans `style.css`.
- Stabilisation de la carte après chargement, redimensionnement et changement de layout.
- Cache PWA mis à jour en V5.1.1.

## Fichiers à remplacer sur GitHub

Remplace uniquement :

- `style.css`
- `app.js`
- `service-worker.js`

Ne remplace pas `firebase-config.js`.

## Après upload GitHub

Ouvre l'application avec :

`?fresh=511`

Exemple :

`https://security-maker.github.io/AZERRAP/?fresh=511`

Puis recharge la page. Si l'ancienne PWA reste en cache, supprime l'icône de l'écran d'accueil et réinstalle-la depuis Safari.


## V5.2 — Documents premium Azzera Protect

- Nouveau générateur PDF conforme à la charte Azzera Protect.
- Couleurs utilisées : Bleu Obsidian `#141c25`, Bleu Azur `#64d0ff`, blanc et gris métal.
- En-tête Azzera Protect / Sécurité privée, slogan, sections structurées, métriques, tableaux premium.
- Aperçu HTML et PDF harmonisés.
- Toujours sans Firebase Storage : les documents restent archivés en Firestore puis régénérés en PDF à la demande.

## Correctif V5.3 notifications push

Cette version corrige le point critique GitHub Pages / iPhone : les fichiers OneSignal sont maintenant à la racine de la PWA (`OneSignalSDKWorker.js` et `OneSignalSDKUpdaterWorker.js`) et le SDK utilise le scope racine du dépôt.

À remplacer sur GitHub :
- `app.js`
- `service-worker.js`
- `OneSignalSDKWorker.js` (nouveau fichier à la racine)
- `OneSignalSDKUpdaterWorker.js` (nouveau fichier à la racine)

À ne pas remplacer :
- `firebase-config.js`

Dans OneSignal, le chemin Service Worker conseillé pour ton dépôt GitHub Pages `AZERRAP` est :
- Path / scope : `/AZERRAP/`
- Worker file : `/AZERRAP/OneSignalSDKWorker.js`

Ensuite ouvre l'application avec `?fresh=53`, supprime l'ancienne icône écran d'accueil, puis réinstalle la PWA.


## Correctif V5.3.1 — démarrage PWA et OneSignal

Le Worker OneSignal doit rester dans `push/onesignal/` avec le scope `/AZERRAP/push/onesignal/` afin de ne pas remplacer le Worker PWA principal. Les anciens fichiers `OneSignalSDKWorker.js` et `OneSignalSDKUpdaterWorker.js` placés à la racine doivent être supprimés du dépôt GitHub.

Fichiers à remplacer :
- `app.js`
- `service-worker.js`
- `push/onesignal/OneSignalSDKWorker.js`

Dans OneSignal, configure :
- Path : `/AZERRAP/push/onesignal/`
- Filename : `OneSignalSDKWorker.js`
- Scope : `/AZERRAP/push/onesignal/`

Puis supprime l’ancienne PWA de l’écran d’accueil et réinstalle-la.


---

## V5.4 — Prise de poste & Carte QG

- prise de poste en 3 étapes : mission, consignes, photo obligatoire ;
- photo compressée et archivée dans `shiftProofs` (Firestore, sans Firebase Storage) ;
- début et fin de service ajoutés automatiquement à la MCI ;
- suppression des catégories manuelles « Prise de service » et « Fin de service » ;
- fin de poste simplifiée avec note de relève et signature préremplie ;
- popup agent sur la carte : heure de prise de poste, durée, site, type de mission et preuve photo ;
- géocodage automatique des sites depuis l’adresse via le service public IGN Géoplateforme / BAN ;
- consignes opérationnelles renforcées visuellement sur mobile.

### Mise à jour GitHub depuis V5.3.1

Remplacer :

- `app.js`
- `style.css`
- `service-worker.js`
- `firestore.rules`

Conserver `firebase-config.js`.

Publier ensuite les nouvelles règles dans **Firebase > Firestore Database > Règles**. La nouvelle collection `shiftProofs` est nécessaire pour la preuve photo.

Ouvrir ensuite l’application avec `?fresh=54` puis réinstaller la PWA si le cache iPhone conserve l’ancienne version.
