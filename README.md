# Sentinelle Pro Lite Production V4

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


## Version v3

- Vue Patron / QG : journal MCI répertorié par mission avec détails et export par mission.
- Vue Patron / QG : filtres Agent, Site, Catégorie, Gravité et recherche globale.
- Mobile : logo Azzera/Sentinelle Pro ajouté en haut des écrans après connexion.
- Service worker passé en cache v3 pour forcer la mise à jour sur smartphone.


## Nouveautés V4 — Sentinelle Pro Mission Control

Cette version ajoute les modules validés :

- Missions planifiées côté QG : agent, site, début prévu, fin prévue, type et consignes.
- Prise de poste agent liée à une mission planifiée, avec fallback prise de poste libre.
- Fin de poste renforcée : résumé, nombre de rapports, rondes, événements, score de conformité, note de relève et signature agent.
- Main courante avec modèles rapides pour accélérer la saisie terrain.
- Vue Patron/QG des mains courantes par mission avec export CSV et rapport mission imprimable/enregistrable en PDF.
- Centre de notifications QG : SOS actifs, retards de prise de poste, missions non clôturées, agent inactif, rapport critique non traité et Flash critique non lu.
- Mode relève agent : l’agent en poste voit la dernière note de relève du site et peut confirmer la prise en compte.

## Fichiers à remplacer si tu mets à jour depuis la V3

Pour garder tes clés Firebase, ne remplace pas `firebase-config.js` si tu l’as déjà rempli.

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

Puis publie les nouvelles règles Firestore dans :

```txt
Firebase Console > Firestore Database > Rules
```

Important : la V4 utilise une nouvelle collection Firestore :

```txt
missions
```

## Structure mission Firestore

```json
{
  "agentId": "UID_AGENT",
  "agentNom": "Nom Agent",
  "siteId": "ID_SITE",
  "siteNom": "Nom du site",
  "scheduledStart": "Timestamp",
  "scheduledEnd": "Timestamp",
  "type": "Surveillance",
  "instructions": "Consignes spécifiques",
  "status": "planned",
  "createdAt": "Timestamp",
  "createdBy": "UID_ADMIN"
}
```

## Rapport PDF

Le bouton `Rapport PDF` ouvre une page imprimable. Sur Mac/iPhone, choisis `Imprimer` puis `Enregistrer en PDF` si tu veux un fichier PDF.

## Mise à jour PWA iPhone

Après publication GitHub Pages :

1. Supprime l’ancienne icône de l’écran d’accueil.
2. Ouvre le lien GitHub Pages dans Safari.
3. Recharge la page.
4. Fais Partager > Sur l’écran d’accueil.

Le cache PWA est passé en version 4.
