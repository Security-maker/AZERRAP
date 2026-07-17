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
