# Sentinelle Pro V4.6 — GitHub Edition

Version HTML/CSS/JS compatible GitHub Pages + Firebase Spark.

## Nouveautés V4.6

- Planning exploitation PC renforcé.
- Missions multi-jours affichées en barre continue sur tous les jours concernés.
- Création rapide d’une mission en cliquant sur une case vide du planning.
- Vue par sites ou par collaborateurs.
- Vue 7 jours, 14 jours ou mois.
- Filtre par statut : toutes, planifiées, en cours, terminées, annulées.
- Recherche site, agent, client.
- Détail mission depuis le planning.
- Duplication rapide : demain ou +7 jours.
- Création de séries : tous les jours ou chaque semaine.
- Responsive conservé avec défilement horizontal uniquement à l’intérieur du planning.

## Installation GitHub

Remplace les fichiers sur GitHub, mais garde ton fichier :

```txt
firebase-config.js
```

si tes clés Firebase sont déjà dedans.

Après upload, ouvre ton lien avec :

```txt
?fresh=46
```

Exemple :

```txt
https://tonpseudo.github.io/sentinelle-pro/?fresh=46
```

Puis supprime l’ancienne icône de l’écran d’accueil et réinstalle la PWA depuis Safari.

## Firebase

Cette version n’utilise pas Firebase Storage et ne demande pas Firebase Blaze.

Services utilisés :

- Firebase Authentication
- Cloud Firestore
- GitHub Pages

## Important

Le planning PC est optimisé pour un écran large. Sur mobile, le planning reste utilisable avec un défilement horizontal interne, sans faire bouger toute l’application.
