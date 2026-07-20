# Sentinelle Pro V5.7.0 — Planning collaborateurs

## Fichiers modifiés

- `app.js`
- `style.css`

Aucune modification de :

- `index.html`
- `push-init.js`
- `service-worker.js`
- `push/onesignal/OneSignalSDKWorker.js`
- `firebase-config.js`
- `worker/onesignal-worker.js`
- `firestore.rules`

La configuration OneSignal validée reste donc intacte.

## Nouveautés côté Agent

- Nouvelle rubrique **Planning** dans le menu.
- Vue **Liste** et vue **Mois**.
- Affichage uniquement des missions de l’agent connecté.
- Totaux mensuels : missions, heures prévues, sites et lectures à confirmer.
- Détail d’une mission : horaires, durée, adresse, consignes, contact d’urgence et itinéraire.
- Bouton **J’ai pris connaissance** avec date et révision du planning.
- Bouton **Prendre poste** lorsque la vacation est dans sa fenêtre de démarrage.
- Téléchargement du planning mensuel au format PDF.
- Ouverture directe de la rubrique Planning depuis les notifications de création, modification ou annulation.

## Nouveautés côté QG

- Nouveau **Planning mensuel collaborateur** inspiré du planning Azzera Protect fourni.
- Sélection du collaborateur et du mois.
- Sites en lignes, jours en colonnes et horaires dans les cases.
- Création rapide d’une vacation en cliquant sur une case vide.
- Modification complète d’une vacation : agent, site, horaires, type, statut et consignes.
- Détection des chevauchements avant création ou modification.
- Toute modification réinitialise la prise de connaissance et prévient l’agent.
- Indicateur de lecture de l’agent.
- Totaux journaliers, hebdomadaires et répartition indicative jour/nuit/dimanche/jour férié.
- Export PDF paysage avec identité du collaborateur, grille mensuelle et synthèses.
- Bouton **Planning** directement depuis la fiche d’un agent.
- Nouveaux champs optionnels du profil agent : adresse, code postal, ville et carte professionnelle.

## Installation

1. Remplacer uniquement `app.js` et `style.css` sur GitHub.
2. Attendre la fin de **Pages build and deployment**.
3. Ouvrir l’application avec :

   `https://security-maker.github.io/AZERRAP/?fresh=570`

4. Fermer puis rouvrir la PWA depuis son icône.

## Tests recommandés

1. QG → **Agents** → bouton **Planning**.
2. Créer une vacation en cliquant sur une case du planning mensuel.
3. Modifier la vacation et vérifier la notification reçue par l’agent.
4. Agent → **Planning** → confirmer la prise de connaissance.
5. Revenir côté QG et vérifier que la mission apparaît comme lue.
6. Télécharger le PDF mensuel.
7. Vérifier qu’un chevauchement déclenche bien une alerte.
