# Sentinelle Pro V5.6.4 — Worker OneSignal combiné

Ce patch remplace l’approche à deux Service Workers par un seul Worker principal partagé par la PWA et OneSignal.

## À remplacer sur GitHub
- `app.js`
- `service-worker.js`

Ne remplace pas `firebase-config.js`, `index.html`, `style.css` ni les règles Firestore.

## Après publication
1. Attendre que GitHub Pages ait fini le déploiement.
2. Supprimer l’ancienne icône Sentinelle Pro de l’iPhone.
3. Supprimer les données Safari de `security-maker.github.io`.
4. Ouvrir `https://security-maker.github.io/AZERRAP/?fresh=564`.
5. Ajouter l’app à l’écran d’accueil et l’ouvrir depuis l’icône.
6. Se connecter en agent, puis ouvrir `Push`.
7. Appuyer sur `Demander l’autorisation sur cet appareil`.

## Résultat attendu
Le Worker enregistré doit être :
`https://security-maker.github.io/AZERRAP/service-worker.js`

L’abonnement doit afficher un ID et un token, puis apparaître `Subscribed` dans OneSignal.
