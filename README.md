# Sentinelle Pro V5.5 — Onglet Notifications Push

Patch ciblé : ajout d’un onglet Push dans le menu QG et Agent.

## Remplacer sur GitHub

- app.js
- service-worker.js

Ne pas remplacer :

- firebase-config.js
- index.html
- style.css
- firestore.rules

## Utilisation

1. Ouvrir l’application avec `?fresh=55`.
2. Ouvrir le menu.
3. Aller dans `Push`.
4. Sur le téléphone agent, ouvrir l’app depuis l’icône écran d’accueil.
5. Appuyer sur `Demander l’autorisation sur cet appareil`.

## Important iPhone

La fenêtre iOS ne s’affiche pas si l’application est ouverte dans Safari classique. Elle doit être ouverte depuis l’icône installée sur l’écran d’accueil.
