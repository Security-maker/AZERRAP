# Sentinelle Pro V5.4.9 — Correctif écran "Démarrage trop long"

Remplacer uniquement :

- index.html
- service-worker.js

Ne pas remplacer :

- app.js
- style.css
- firebase-config.js
- firestore.rules

Ce patch supprime totalement le minuteur qui affichait à tort "Démarrage trop long" alors que l'application était déjà rendue.
