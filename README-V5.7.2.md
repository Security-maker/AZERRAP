# Sentinelle Pro — V5.7.2 Badge professionnel employeur

## Objectif
Ajout d'une carte professionnelle employeur dématérialisée pour les agents, consultable côté agent et administrable côté QG.

## Côté agent
- Nouvelle rubrique `Badge`.
- Carte recto/verso inspirée du modèle Azzera Protect.
- Affichage de la photo, identité, carte professionnelle CNAPS, NUB, activités autorisées, spécialités, autorisation d'exercice de l'entreprise et mention L612-14.
- Export PDF et impression.
- Compatible consultation hors ligne après synchronisation du profil.

## Côté QG
- Fiche agent enrichie : photo, naissance, NUB, carte professionnelle, dates, spécialités, badge interne, vérification CNAPS, informations employeur.
- Bouton `Badge` dans la table Agents.
- Aperçu recto/verso, impression et PDF depuis le QG.

## Fichiers modifiés
- `index.html` : version des fichiers app/style passée en 572 uniquement.
- `app.js` : fonctions badge, champs agent, route agent, export PDF.
- `style.css` : design badge responsive et imprimable.
- `service-worker.js` : cache V5.7.2 et fichiers `?v=572`.

## Fichiers non modifiés
- `push-init.js`
- `push/onesignal/OneSignalSDKWorker.js`
- `firebase-config.js`
- `firestore.rules`
- `worker/onesignal-worker.js`
