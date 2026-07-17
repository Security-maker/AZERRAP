# Sentinelle Pro V5.1 — Documents PDF & Dashboard propre

Cette version corrige les points remontés après la V5.0.

## Nouveautés V5.1

### Dashboard QG allégé
- La carte opérationnelle passe en pleine largeur.
- Le bloc “Missions à venir” est retiré du Dashboard pour ne plus polluer l’accueil.
- Le Dashboard garde uniquement : statistiques, carte, notifications QG, SOS/PTI et derniers rapports MCI.

### Suivi missions moins polluant
Dans la page Missions, le bloc “Suivi missions” devient “Suivi prioritaire”. Il affiche uniquement :
- missions en cours ;
- missions en retard ;
- missions du jour non terminées.

Le planning complet reste disponible dans la grille PC.

### Carte plus lisible
- Carte claire par défaut.
- Carte plus grande.
- Marqueurs plus visibles.
- Couleur du site utilisée sur les marqueurs.
- Message d’aide si aucun site n’a encore latitude/longitude.
- Accès Google Maps depuis les marqueurs.

### Documents PDF
Le générateur de Documents archive maintenant les documents comme des documents PDF dans la rubrique Documents.

Types gérés :
- MCI ;
- rapports de mission ;
- rondes ;
- SOS/PTI ;
- factures.

Chaque document peut être :
- aperçu ;
- téléchargé en PDF ;
- imprimé depuis l’aperçu ;
- exporté en CSV si besoin ;
- supprimé par l’admin.

Important : cette version n’utilise toujours pas Firebase Storage. Les documents sont archivés comme données structurées dans Firestore puis régénérés en PDF à la demande via le navigateur. C’est le meilleur compromis sans plan Blaze.

### Factures PDF
Le bouton PDF des factures télécharge un PDF et archive une copie dans Documents > Factures.

## Mise à jour GitHub depuis V5.0

Remplace :

```text
app.js
style.css
index.html
service-worker.js
README.md
```

Ne remplace pas :

```text
firebase-config.js
```

Si tu utilises encore l’ancien cache PWA, ouvre ensuite :

```text
https://security-maker.github.io/AZERRAP/?fresh=51
```

Puis supprime/réinstalle l’icône de l’écran d’accueil si besoin.

## Firebase
Les règles V5.0 restent compatibles avec la V5.1. Tu peux republier `firestore.rules` si besoin, mais aucune nouvelle collection n’est nécessaire.
