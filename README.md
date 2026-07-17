# Sentinelle Pro V5.6.2 — Correctif abonnement OneSignal GitHub Pages

Correctif construit directement depuis le ZIP déployé fourni par Nacer.

## Cause corrigée

Le chemin `serviceWorkerPath` envoyé au SDK OneSignal commençait par `/`.
Pour un Worker placé dans un sous-dossier, OneSignal demande un chemin relatif à la racine du domaine, sans slash initial.

Pour cette application, le SDK reçoit désormais :

```text
AZERRAP/push/onesignal/OneSignalSDKWorker.js
```

avec le scope :

```text
/AZERRAP/push/onesignal/
```

## Autres sécurisations

- vérification réseau et MIME du Worker avant l'initialisation OneSignal ;
- le Worker OneSignal n'est plus stocké dans le cache PWA ;
- attente de 30 secondes du token et du Subscription ID ;
- diagnostic visible : Worker attendu, Worker enregistré, scope et abonnement natif.

## Fichiers à remplacer sur GitHub

```text
app.js
service-worker.js
```

Ne pas remplacer `firebase-config.js`.

## Réglages OneSignal obligatoires

Dans OneSignal > Settings > Push & In-App > Web :

```text
Integration : Custom Code
Site URL : https://security-maker.github.io
Path to service worker files : /AZERRAP/push/onesignal/
Service worker filename : OneSignalSDKWorker.js
Service worker registration scope : /AZERRAP/push/onesignal/
```

## Test propre iPhone

1. Publier les deux fichiers et attendre la fin de GitHub Pages.
2. Supprimer l'ancienne icône Sentinelle Pro.
3. Supprimer les données de `security-maker.github.io` dans les réglages Safari.
4. Ouvrir `https://security-maker.github.io/AZERRAP/?fresh=562`.
5. Ajouter l'application à l'écran d'accueil.
6. L'ouvrir depuis l'icône, se connecter en agent et utiliser l'onglet Push.
