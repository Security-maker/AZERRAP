# Sentinelle Pro V4.5 — GitHub Edition

Version pensée pour rester compatible avec :

- GitHub Pages
- Firebase Spark
- Firebase Authentication
- Cloud Firestore
- sans Firebase Storage
- sans Firebase Cloud Functions obligatoires

## Nouveautés V4.5

- Planning exploitation renforcé façon logiciel métier type SEKUR.
- Vue planning par sites ou par collaborateurs.
- Vue 7 jours, 14 jours ou mois.
- Recherche site, agent, client.
- Duplication rapide d'une mission depuis le suivi missions.
- Journal MCI avec récupération complète des sites créés depuis Firestore.
- Export MCI renforcé avec plusieurs méthodes : téléchargement CSV, partage, copie CSV, copie rapport texte, page d'export et impression/PDF.
- Responsive verrouillé pour empêcher la page entière de bouger horizontalement sur mobile.
- Version sans Firebase Storage pour rester compatible Spark.

## Mise à jour depuis V4.4

Sur GitHub, remplace les fichiers de ton dépôt par ceux de cette version, mais garde ton fichier :

```text
firebase-config.js
```

Si tu le remplaces par erreur, remets tes clés Firebase dans ce fichier.

## Fichiers principaux à remplacer

```text
index.html
app.js
style.css
service-worker.js
manifest.json
firestore.rules
assets/
```

## Règles Firebase

Dans Firebase Console :

```text
Firestore Database > Règles
```

Colle le contenu de :

```text
firestore.rules
```

Puis clique sur Publier.

Aucun réglage Storage n'est nécessaire dans cette version.

## Export MCI

La V4.5 ne dépend plus d'un seul téléchargement direct, car iPhone/Safari/PWA peut bloquer les téléchargements.

Méthodes disponibles :

- Télécharger CSV
- Partager fichier
- Imprimer / PDF
- Copier CSV
- Copier rapport texte
- Ouvrir page d'export

Sur iPhone, la méthode la plus stable est :

```text
Imprimer / PDF > Partager > Enregistrer dans Fichiers
```

## Notifications écran verrouillé

Les Flash dans l'application fonctionnent avec Firestore.

Pour recevoir de vraies notifications écran verrouillé, GitHub Pages seul ne suffit pas. Il faudra connecter plus tard un service externe comme OneSignal + un petit proxy sécurisé, ou Firebase Cloud Messaging avec un backend. La V4.5 reste volontairement compatible GitHub/Firebase Spark sans obligation de paiement.

## Après publication GitHub

Comme l'application est une PWA, pense à vider l'ancien cache :

1. Attends 2 à 3 minutes après l'upload GitHub.
2. Ouvre ton lien avec `?fresh=45` à la fin.
3. Supprime l'ancienne icône de l'écran d'accueil.
4. Réinstalle l'app depuis Safari.

Exemple :

```text
https://tonpseudo.github.io/sentinelle-pro/?fresh=45
```
