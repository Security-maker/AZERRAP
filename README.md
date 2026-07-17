# Sentinelle Pro V5.4.1 — Correctif démarrage

Ce patch corrige le blocage sur l’écran de chargement après la V5.4.

## À remplacer sur GitHub

Remplace uniquement :

- `index.html`
- `app.js`
- `service-worker.js`

Ne remplace pas `firebase-config.js`.

## Après upload

Ouvre :

`https://security-maker.github.io/AZERRAP/?fresh=541`

Si l’app reste bloquée, utilise le bouton `Nettoyer et relancer` qui apparaîtra automatiquement après quelques secondes.

## Cause corrigée

Le SDK OneSignal n’est plus chargé au démarrage de l’application. Il se charge seulement quand l’agent active les notifications. Cela évite qu’un script externe bloque tout le portail.
