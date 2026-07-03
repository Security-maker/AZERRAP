# Sentinelle Pro PWA

Application web premium pour agence de sécurité privée : portail Agent terrain, portail Patron/QG, Firebase, PWA, MCI temps réel, rondes QR/NFC, PTI/SOS, messages Flash, exports et logique RGPD.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Firebase Auth, Firestore, Storage, Hosting
- PWA installable sans App Store / Google Play
- Leaflet pour cartographie
- QRCode pour génération QR côté QG
- Architecture `components / pages / services / hooks`

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

Renseigne ensuite tes clés Firebase dans `.env`.

## Configuration Firebase

1. Crée un projet Firebase.
2. Active Authentication > Email/Password.
3. Active Cloud Firestore.
4. Active Storage.
5. Déploie les règles :

```bash
firebase login
firebase use ton-projet
firebase deploy --only firestore:rules,storage
```

6. Crée tes utilisateurs dans Firebase Auth.
7. Ajoute leur profil dans la collection `users` avec le même `uid`.

Exemple `users/{uid}` :

```json
{
  "uid": "UID_AUTH_FIREBASE",
  "prenom": "Karim",
  "nom": "Benali",
  "email": "agent@agence.fr",
  "telephone": "+33600000000",
  "role": "agent",
  "statut": "hors_poste",
  "siteActuel": null,
  "isOnline": false
}
```

## Données de démonstration

Le fichier `demo/firestore-demo.json` contient un jeu de données métier : agents, site, consignes, points de ronde, documents.

Pour injecter les données via Admin SDK :

```bash
export FIREBASE_PROJECT_ID=ton-projet
export GOOGLE_APPLICATION_CREDENTIALS=/chemin/service-account.json
npm run seed
```

## Déploiement PWA

```bash
npm run build
firebase deploy --only hosting
```

La PWA sera installable depuis Safari, Chrome, Edge ou Android. Sur iOS, les capacités de notifications et certains comportements PWA restent dépendants de Safari/iOS.

## Fonctionnalités incluses

### Portail Agent

- Accueil terrain mobile-first
- Prise de poste sécurisée
- Fin de poste
- Main courante intelligente avec catégorie, gravité, photo, GPS et simulation micro
- Documentation site
- Ronde avec points QR/NFC et fallback QR
- Bouton SOS/PTI visible en permanence avec appui long, compte à rebours et sécurité réseau
- Messages Flash avec confirmation de lecture

### Portail QG

- Dashboard temps réel
- Statistiques agents, sites, rapports, incidents, alertes
- Journal MCI avec filtres, recherche, traitement, exports CSV/PDF
- Dispositif agents
- Gestion agents
- Gestion sites
- Génération QR de points de ronde
- Alertes PTI/SOS avec prise en charge et clôture justifiée
- Messages Flash ciblés
- Historique et exports
- Paramètres RGPD

## Sécurité

- Protection de routes par rôle
- Firebase Security Rules strictes
- Rapports verrouillés côté agent
- Alertes non supprimables silencieusement
- Logs d’audit pour actions sensibles
- Aucun secret Firebase côté frontend hors configuration publique Firebase
- Validation et nettoyage basique des saisies côté front
- Horodatage serveur via `serverTimestamp()`

## Limites techniques à valider avant production

- NFC Web : dépend fortement du navigateur et d’Android. iOS ne fournit pas une compatibilité Web NFC universelle.
- Notifications push : prévoir Firebase Cloud Messaging + consentement utilisateur + gestion spécifique iOS.
- SOS hors réseau : l’application refuse d’annoncer une alerte comme envoyée sans confirmation réseau.
- Les exports PDF actuels utilisent `window.print()` pour un rendu simple. Pour un rendu certifié client, prévoir une Cloud Function PDF serveur.
- La création de comptes Auth Firebase ne se fait pas directement depuis le front admin pour éviter d’exposer des droits sensibles. Prévoir une Cloud Function admin.
- La cartographie utilise OpenStreetMap public. Pour un usage client intensif, prévoir Mapbox ou serveur de tuiles dédié.

## Collections Firestore prévues

- `users`
- `sites`
- `shifts`
- `reports`
- `alerts`
- `rounds`
- `roundCheckpoints`
- `roundCheckpointsLogs`
- `flashMessages`
- `documents`
- `auditLogs`
- `settings`

## Charte graphique

- Obsidian `#050A13`
- Bleu Nuit `#081B33`
- Azur `#009CFF`
- Électrique `#00B8FF`
- Blanc Froid `#F4F8FB`
- Gris Métal `#8A96A8`
- Rouge Alerte `#FF2E2E`
- Vert Opérationnel `#00D084`
- Orange Incident `#FF9F1C`

Typographie : Montserrat.

## Cloud Function incluse

Le dossier `functions/` contient une fonction callable `createPortalUser` pour créer un utilisateur Firebase Auth + son profil Firestore depuis un compte QG. C’est la bonne approche pour éviter d’exposer des droits admin côté frontend.

Déploiement :

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```
