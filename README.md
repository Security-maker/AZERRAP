# Sentinelle Pro V5.6.1 — Correctif abonnement OneSignal

Correctif ciblé pour les appareils affichés « Never Subscribed » dans OneSignal.

## Changements
- OneSignal prépare le SDK avant le clic d'autorisation.
- La demande système passe uniquement par OneSignal.
- Le profil utilisateur n'est relié avec `login(uid)` qu'après création d'un vrai abonnement actif.
- Attente du Subscription ID, du token et de `optedIn=true` avant d'enregistrer `pushTokens`.
- Les anciens profils OneSignal « Never Subscribed » ne sont plus réutilisés comme destinataires valides.

## GitHub
Remplacer uniquement :
- `app.js`
- `service-worker.js`

## Nettoyage avant le test
1. Dans Firestore, supprimer les anciens documents de `pushTokens` pour le téléphone concerné.
2. Dans OneSignal > Audience > Subscriptions, supprimer les lignes de test « Never Subscribed » si souhaité.
3. Supprimer puis réinstaller la PWA sur l'iPhone.
4. Ouvrir Menu > Push et attendre que le bouton affiche « Demander l’autorisation sur cet appareil ».
5. Appuyer une seule fois et accepter.

Version fraîche : `?fresh=561`
