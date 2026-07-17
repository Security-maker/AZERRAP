# Sentinelle Pro V5.6 — Notifications opérationnelles

Ce patch est cumulatif : il contient déjà le correctif V5.5.2 de livraison OneSignal. Il n’est pas nécessaire d’installer V5.5.2 avant.

## Notifications ajoutées

### Planning
- nouvelle mission planifiée ;
- série de missions ;
- mission dupliquée ;
- mission annulée.

La notification est envoyée uniquement à l’agent affecté.

### Flash QG
Le ciblage direct par `subscriptionId` de la V5.5.2 est conservé.

### Consignes
Lorsqu’un site existant est modifié et que ses consignes changent, les agents actuellement ou prochainement affectés à ce site reçoivent une notification.

### Documents
Lorsqu’un rapport de mission est archivé, l’agent de la mission est notifié. Lorsqu’un document est généré pour un site précis, les agents affectés à ce site sont notifiés. Les documents internes « Tous sites » ne déclenchent pas de notification générale.

### Préférences appareil
La rubrique **Push** permet d’activer ou désactiver séparément :
- Planning et missions ;
- Messages Flash ;
- Consignes opérationnelles ;
- Nouveaux documents.

Les préférences sont enregistrées localement et synchronisées dans `pushTokens`.

## GitHub
Remplacer uniquement :
- `app.js`
- `service-worker.js`

Ne pas remplacer :
- `firebase-config.js`
- `index.html`
- `style.css`
- `firestore.rules`

## Cloudflare Worker `sp-push`
Remplacer intégralement le code par :
- `worker/onesignal-worker.js`

Conserver les variables/secrets :
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `SENTINELLE_PUSH_SECRET`
- `ALLOWED_ORIGIN=https://security-maker.github.io`

## Important
Les notifications automatiques sont envoyées depuis le navigateur admin vers le Worker Cloudflare. La clé `SENTINELLE_PUSH_SECRET` doit donc être configurée sur le PC utilisé pour planifier, modifier les consignes ou générer les documents.

## Test recommandé
1. Installer le patch GitHub et le Worker Cloudflare.
2. Ouvrir l’app avec `?fresh=56`.
3. Sur le téléphone agent : Push > autoriser > laisser les 4 catégories cochées > enregistrer.
4. Sur le PC admin : vérifier la clé push.
5. Créer une mission affectée à cet agent.
6. Verrouiller le téléphone et vérifier la notification.
7. Modifier ensuite les consignes du site et générer un rapport de mission pour tester les autres catégories.
