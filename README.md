# Sentinelle Pro V5.0 — Facturation & Planning Couleurs

Patch GitHub Pages + Firebase Spark, sans Firebase Storage.

## Nouveautés V5.0

### Facturation réservée au compte admin
- Nouvelle rubrique `Facturation` visible uniquement pour le rôle `admin`.
- Coordonnées de l’entreprise : raison sociale, SIRET, TVA, adresse, email, téléphone, IBAN, BIC et mentions de paiement.
- Génération automatique d’une facture à partir des missions `completed` d’un site et d’une période.
- Calcul des heures depuis les horaires réalisés lorsqu’ils existent, sinon depuis les horaires planifiés.
- Tarif horaire et TVA configurables par site.
- Ajout possible d’un forfait ou complément manuel.
- Numérotation automatique : `SP-ANNÉE-0001`.
- Protection contre la double facturation d’une même mission.
- Statuts : brouillon, envoyée, payée, en retard, annulée.
- Tableau de bord : facturé HT, encaissé TTC, reste à encaisser et retards.
- Impression / enregistrement PDF et export CSV des lignes de facture.
- Collections Firestore : `invoices` et `billingSettings`.

La facturation est un outil de gestion. Vérifie les mentions légales et fiscales applicables à ton entreprise avant d’envoyer une facture définitive.

### Code couleur par site dans le planning
- Chaque site possède une couleur personnalisable dans `Gestion Sites`.
- Les missions utilisent la couleur du site, y compris dans la vue par collaborateurs.
- Les missions multi-jours conservent la même couleur sur toute leur durée.
- Légende automatique des sites au-dessus du planning.
- Bande colorée sur la ligne de chaque site.
- Couleur de secours automatique pour les anciens sites qui n’ont pas encore de couleur enregistrée.

### Nouveaux champs d’un site
- Couleur planning.
- Tarif horaire HT.
- TVA par défaut.
- Email de facturation.
- Adresse de facturation.

## Mise à jour depuis la V4.9

Remplace sur GitHub :

- `app.js`
- `style.css`
- `service-worker.js`
- `firestore.rules`
- `README.md`

Tu peux conserver tous les autres fichiers.

Ne remplace pas `firebase-config.js` si tes clés Firebase, OneSignal et les URL Cloudflare y sont déjà renseignées.

## Règles Firestore obligatoires

Après la mise à jour :

1. Firebase Console.
2. Firestore Database.
3. Règles.
4. Coller le contenu du nouveau fichier `firestore.rules`.
5. Cliquer sur `Publier`.

Les collections de facturation sont strictement réservées au rôle `admin`. Le superviseur et l’agent n’y ont pas accès.

## Première configuration de la facturation

1. Connecte-toi avec le compte admin.
2. Ouvre le menu puis `Facturation`.
3. Clique sur `Coordonnées entreprise`.
4. Renseigne les informations qui doivent apparaître sur les factures.
5. Va dans `Sites` et renseigne le tarif horaire, la TVA et les informations de facturation de chaque client.
6. Termine au moins une mission.
7. Retourne dans `Facturation` puis clique sur `Créer une facture`.

## Actualiser la PWA

Après l’envoi sur GitHub Pages, ouvre :

`https://tonpseudo.github.io/ton-repo/?fresh=50`

Sur iPhone, supprime l’ancienne icône de l’écran d’accueil puis réinstalle la PWA si l’ancien cache reste visible.
