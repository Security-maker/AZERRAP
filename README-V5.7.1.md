# Sentinelle Pro V5.7.1 — Conformité, PTI tactile et mode hors ligne

## Installation

Remplacer sur GitHub :

- `index.html`
- `app.js`
- `style.css`
- `service-worker.js`

Ne pas modifier :

- `push-init.js`
- `push/onesignal/OneSignalSDKWorker.js`
- `firebase-config.js`
- `firestore.rules`
- les Workers Cloudflare

## Facturation sécurité privée

Dans **QG > Facturation > Coordonnées légales**, compléter notamment :

- raison sociale, forme juridique et capital ;
- SIREN, SIRET, RCS et TVA ;
- adresse, téléphone et email ;
- numéro d’autorisation d’exercice CNAPS ;
- activité autorisée ;
- conditions de règlement, escompte et pénalités ;
- IBAN et BIC.

Les nouvelles factures intègrent l’identité du client, l’adresse de facturation, le lieu et la période de prestation, les conditions de règlement, l’indemnité forfaitaire de 40 €, l’autorisation CNAPS et la mention de l’article L612-14 du CSI.

## PTI / SOS

- appui continu de 3 secondes ;
- blocage de la sélection de texte, du copier-coller et du menu tactile iOS ;
- compte à rebours visible ;
- aucune confirmation supplémentaire après les 3 secondes ;
- en mode hors ligne, l’alerte est mise en attente localement et l’app demande d’appeler immédiatement le QG ou le 112.

## Mode hors ligne

Après une première préparation en ligne sur l’appareil :

- la session Firebase est conservée localement ;
- le profil, les missions, les sites, les consignes, les documents et les points de ronde sont mis en cache ;
- le shell PWA et les dépendances déjà chargées sont conservés ;
- les écritures Firestore sont synchronisées au retour du réseau.

La toute première authentification sur un appareil neuf nécessite toujours une connexion réseau. Ne pas déconnecter le compte et ne pas effacer les données du site avant une mission hors couverture.
