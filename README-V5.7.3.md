# Sentinelle Pro V5.7.3 — Photo MCI compatible Firebase Spark

## Correctif
- Le bouton Photo de la main courante est réactivé sur mobile.
- Prise de vue avec la caméra arrière ou sélection depuis la photothèque.
- Compression JPEG automatique avant enregistrement.
- Une photo maximum par rapport MCI.
- Photo archivée directement dans le document Firestore du rapport, sans Firebase Storage et sans passage au forfait Blaze.
- Aperçu et suppression avant envoi.
- Indicateur « Photo jointe » dans le flux.
- Affichage de la photo dans le détail QG déjà existant.
- En mode hors ligne, la MCI est placée dans la file Firestore locale puis synchronisée au retour du réseau.

## Limite technique
La photo est volontairement compressée à environ 180 Ko afin de rester très en dessous de la limite Firestore d'un document. Cette solution convient à une preuve opérationnelle, mais pas à l'archivage de photos haute définition en grand volume.

## Installation
Remplacer uniquement :
- `app.js`
- `service-worker.js`

Aucune modification de OneSignal, `push-init.js`, du Worker OneSignal, de Firebase Config ou des règles Firestore.
