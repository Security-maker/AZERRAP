# Sentinelle Pro V5.7.4 — Photos dans les PDF

## Fichiers à remplacer
- `app.js`
- `index.html`
- `service-worker.js`

## Évolution
- Les photos jointes aux rapports MCI sont conservées dans les documents archivés.
- Une colonne « Photo » signale les rapports concernés dans le tableau principal.
- Les PDF de main courante et de mission contiennent une section « Annexes photographiques ».
- Chaque annexe affiche la photo en grand, la date, l’agent, le site, la catégorie, la gravité, le GPS éventuel et le numéro du rapport.
- La pagination place chaque preuve photographique sur une page dédiée afin d’éviter toute coupure.
- Les aperçus imprimables affichent également les annexes.
- Le cache PWA est passé en V5.7.4 pour forcer le chargement du nouveau code.
