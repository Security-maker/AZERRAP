# Sentinelle Pro Lite Production V4.3

Version corrective et évolutive pour GitHub Pages + Firebase.

## À ne pas écraser

Si ton application est déjà connectée à Firebase, ne remplace pas ton fichier :

```txt
firebase-config.js
```

Sauf si tu veux ajouter la clé `vapidKey` pour les notifications push.

## Fichiers à remplacer sur GitHub

Remplace en priorité :

```txt
index.html
app.js
style.css
service-worker.js
manifest.json
firestore.rules
storage.rules
README.md
assets/
```

Puis publie les nouvelles règles Firestore depuis Firebase Console.

## Nouveautés V4.3

- Planning exploitation côté QG inspiré des logiciels de sécurité.
- Vue planning par Sites ou par Collaborateurs.
- Affichage 7 jours, 14 jours ou Mois.
- Recherche dans le planning.
- Missions visibles sous forme de blocs colorés.
- Export MCI renforcé avec : téléchargement, partage natif si supporté, sauvegarde fichier si supportée, copie CSV.
- Préparation notifications écran verrouillé pour Flash QG.
- Bouton Agent : Activer notifications écran verrouillé.
- Service worker capable d’afficher les notifications push.
- Dossier `functions/` pour envoyer les notifications Flash via Firebase Cloud Functions.

## Important sur les notifications push

Pour recevoir les Flash sur écran verrouillé, il faut :

1. Une PWA installée sur l’écran d’accueil.
2. Un domaine HTTPS, par exemple GitHub Pages.
3. L’autorisation notification acceptée par l’agent.
4. Une clé Web Push VAPID dans `firebase-config.js`.
5. Le déploiement des Cloud Functions Firebase incluses dans `functions/`.

Sans Cloud Function ou serveur d’envoi, l’admin peut créer le Flash en temps réel dans Firestore, mais le téléphone ne peut pas recevoir une vraie notification écran verrouillé.

## Ajouter la clé VAPID

Dans Firebase Console :

```txt
Project settings > Cloud Messaging > Web Push certificates > Generate key pair
```

Puis ajoute la clé dans `firebase-config.js` :

```js
vapidKey: "TA_CLE_VAPID"
```

## Déployer les fonctions push

Depuis un terminal dans le dossier du projet :

```bash
firebase login
firebase use --add
firebase deploy --only functions
```

Attention : Cloud Functions peut nécessiter une configuration Firebase compatible côté facturation.

## Règles Firestore

La V4.3 ajoute la collection :

```txt
pushTokens
```

Elle permet de stocker les appareils autorisés à recevoir les notifications.

## PWA et cache

Après mise à jour sur GitHub :

1. Attendre 2 à 3 minutes.
2. Ouvrir le lien GitHub Pages dans Safari/Chrome.
3. Recharger la page.
4. Supprimer l’ancienne icône de l’écran d’accueil.
5. Réinstaller l’app sur l’écran d’accueil.

Sinon le téléphone peut garder l’ancienne version en cache.
