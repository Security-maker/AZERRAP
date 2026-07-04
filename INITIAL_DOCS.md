# Collections Firestore utiles — Sentinelle Pro V4.5

Collections principales :

- users
- sites
- missions
- shifts
- reports
- alerts
- rounds
- roundCheckpoints
- roundCheckpointsLogs
- flashMessages
- auditLogs
- settings

## Notes V4.5

- Les documents et photos ne sont pas stockés dans Firebase Storage.
- Les fichiers sensibles peuvent être gérés plus tard via Cloudinary, Supabase, OneDrive/Drive privé, ou Firebase Storage si passage Blaze.
- Le planning s'appuie sur `missions`.
- Les MCI s'appuient sur `reports` et sont regroupées par `missionId`, `shiftId`, ou par agent/site/date en secours.
