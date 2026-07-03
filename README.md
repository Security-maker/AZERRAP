# Sentinelle Pro Lite Production

Application PWA premium pour agence de sécurité privée.

Cette version est volontairement simple à installer :
- pas de React
- pas de Vite
- pas de npm install
- pas de terminal obligatoire pour tester l’interface après hébergement
- données réelles dans Firebase uniquement
- aucun mode démo activé

## 1. Ce que contient le dossier

```txt
index.html
style.css
app.js
firebase-config.js
manifest.json
service-worker.js
offline.html
firestore.rules
storage.rules
firebase.json
assets/
```

## 2. Firebase à créer

Dans Firebase Console :

1. Créer un projet.
2. Activer Authentication > Email/Password.
3. Activer Firestore Database.
4. Activer Storage.
5. Ajouter une application Web `</>`.
6. Copier la config Firebase dans `firebase-config.js`.

## 3. Remplir firebase-config.js

Remplacer :

```js
apiKey: "REMPLACE_MOI"
```

par les valeurs données par Firebase.

## 4. Premier compte admin

Créer d’abord le compte admin dans :

Firebase Console > Authentication > Users > Add user

Puis copier son UID.

Ensuite, dans Firestore, créer :

Collection : `users`
Document ID : UID du compte admin

Champs :

```json
{
  "uid": "UID_ADMIN",
  "prenom": "Nacer",
  "nom": "Admin",
  "email": "ton-email@example.com",
  "telephone": "+33600000000",
  "role": "admin",
  "statut": "actif",
  "isOnline": false,
  "siteActuel": null,
  "siteActuelNom": null
}
```

## 5. Créer un agent

Créer le compte agent dans Authentication, puis créer son profil Firestore :

Collection : `users`
Document ID : UID du compte agent

```json
{
  "uid": "UID_AGENT",
  "prenom": "Karim",
  "nom": "Benali",
  "email": "agent@example.com",
  "telephone": "+33600000000",
  "matricule": "AG-001",
  "role": "agent",
  "statut": "hors_poste",
  "isOnline": false,
  "siteActuel": null,
  "siteActuelNom": null
}
```

## 6. Créer un site réel

Collection : `sites`
Document ID : `site_001`

```json
{
  "siteId": "site_001",
  "name": "Nom du site",
  "clientName": "Nom du client",
  "address": "Adresse complète",
  "contactName": "Responsable client",
  "contactPhone": "+33600000000",
  "emergencyContact": "+33600000000",
  "instructions": "Consignes principales du site.",
  "whatsappQG": "+33600000000",
  "isActive": true
}
```

## 7. Règles de sécurité

Les fichiers fournis :

```txt
firestore.rules
storage.rules
```

sont prévus pour une logique production :
- agents limités à leurs données
- rapports verrouillés côté agent
- SOS non supprimables
- audit logs non modifiables
- sites/documents gérés par admin/superviseur

Pour les déployer, le plus propre est Firebase CLI :

```bash
firebase deploy --only firestore:rules,storage
```

Si tu ne veux pas utiliser le terminal, copie/colle le contenu de `firestore.rules` dans Firebase Console > Firestore > Rules, puis `storage.rules` dans Storage > Rules.

## 8. Mise en ligne simple sans terminal

Option facile : Netlify Drop.

1. Va sur Netlify Drop.
2. Glisse le dossier complet `sentinelle-pro-lite-production`.
3. Netlify donne une URL HTTPS.
4. Dans Firebase Console > Authentication > Settings > Authorized domains, ajoute le domaine Netlify.

La PWA devient installable grâce au HTTPS.

## 9. Mise en ligne Firebase Hosting

Avec Firebase CLI :

```bash
firebase login
firebase init hosting
firebase deploy --only hosting
```

## 10. Collections utilisées

```txt
users
sites
shifts
reports
alerts
rounds
roundCheckpoints
roundCheckpointsLogs
flashMessages
documents
auditLogs
settings
```

## 11. Limites techniques assumées

Cette version est plus simple que la version React/TypeScript :
- pas de build moderne
- pas de typage TypeScript
- pas de Cloud Functions intégrées
- création des comptes Auth à faire dans Firebase Console
- notifications push FCM non activées dans cette version

Mais elle est directement exploitable comme PWA métier Firebase, sans mode démo ni données fictives.
