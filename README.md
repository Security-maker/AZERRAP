# Sentinelle Pro V4.9 — Command Center

Patch GitHub Pages + Firebase Spark, sans Firebase Storage.

## Nouveautés

### Navigation
- Suppression du menu fixe en bas.
- Nouveau bouton hamburger en haut à gauche.
- Volet latéral déroulant côté Agent et QG.
- Plus d’espace pour le planning et le dashboard sur ordinateur.

### Carte opérationnelle premium
- Fond de carte sombre ou clair.
- Marqueurs distincts pour les agents et les sites.
- Affichage/masquage des calques Agents et Sites.
- Bouton « Ma position ».
- Bouton « Tout afficher ».
- Lien « Ouvrir dans Google Maps » dans chaque fiche de position.
- Les sites peuvent maintenant recevoir une latitude et une longitude depuis Gestion Sites.

### Centre Documents QG
- Nouvelle rubrique `Documents`.
- Génération et archivage de :
  - mains courantes MCI ;
  - rapports de mission ;
  - historiques de rondes ;
  - rapports SOS/PTI.
- Impression / enregistrement PDF.
- Téléchargement CSV.
- Archivage dans Firestore via la collection `generatedDocuments`.
- Bouton « Archiver document » directement depuis une mission du journal MCI.

### Suppressions réservées au rôle admin
- Suppression d’un profil agent.
- Suppression d’un site et de ses points de ronde.
- Suppression d’un rapport MCI.
- Suppression de toutes les MCI d’une mission.
- Suppression de toutes les MCI correspondant aux filtres affichés.
- Suppression d’un document généré.
- Confirmation renforcée : il faut écrire `SUPPRIMER`.

Le rôle `superviseur` peut continuer à exploiter l’interface QG, mais il ne peut pas effectuer ces suppressions.

## Limite importante sur la suppression d’un agent

La version GitHub/Firebase Spark supprime le profil Firestore de l’agent, ses abonnements push et bloque donc son accès à Sentinelle Pro. Son compte reste visible dans Firebase Authentication.

Pour effacer complètement le compte Authentication, il faut le supprimer manuellement dans :

`Firebase > Authentication > Utilisateurs`

Cette limite évite d’exposer des droits Firebase Admin dans le code public GitHub.

## Mise à jour depuis la V4.8

Remplace sur GitHub :

- `app.js`
- `style.css`
- `service-worker.js`
- `firestore.rules`
- `README.md`

Tu peux aussi remplacer `worker/security-intel-worker.js` par celui du ZIP si tu veux conserver la version la plus récente de la veille.

Ne remplace pas `firebase-config.js` si tes clés Firebase, OneSignal et les URL Cloudflare y sont déjà renseignées.

## Règles Firestore obligatoires

Après la mise à jour :

1. Firebase Console.
2. Firestore Database.
3. Règles.
4. Coller le nouveau fichier `firestore.rules`.
5. Cliquer sur Publier.

La V4.9 utilise une nouvelle collection :

`generatedDocuments`

## Carte des sites

Dans `Gestion Sites > Ajouter/Modifier`, renseigne :

- latitude ;
- longitude.

Sans coordonnées, le site reste utilisable dans l’application mais ne sera pas affiché sur la carte.

## Actualiser la PWA

Après l’envoi sur GitHub Pages, ouvre :

`https://tonpseudo.github.io/ton-repo/?fresh=49`

Sur iPhone, supprime l’ancienne icône de l’écran d’accueil puis réinstalle la PWA si l’ancien cache reste visible.
