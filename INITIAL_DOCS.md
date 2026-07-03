# Documents Firestore minimum

## Admin
Collection `users` / Document `UID_ADMIN`

```json
{
  "uid": "UID_ADMIN",
  "prenom": "Nacer",
  "nom": "Admin",
  "email": "admin@example.com",
  "telephone": "+33600000000",
  "role": "admin",
  "statut": "actif",
  "isOnline": false,
  "siteActuel": null,
  "siteActuelNom": null
}
```

## Agent
Collection `users` / Document `UID_AGENT`

```json
{
  "uid": "UID_AGENT",
  "prenom": "Agent",
  "nom": "Terrain",
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

## Site
Collection `sites` / Document `site_001`

```json
{
  "siteId": "site_001",
  "name": "Site principal",
  "clientName": "Client",
  "address": "Adresse du site",
  "contactName": "Responsable",
  "contactPhone": "+33600000000",
  "emergencyContact": "+33600000000",
  "instructions": "Rondes régulières. Signaler toute anomalie au QG.",
  "whatsappQG": "+33600000000",
  "isActive": true
}
```
