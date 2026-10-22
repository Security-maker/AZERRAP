Sentinelle Pro V5.10.20 — nettoyage Flash critique côté agent

Base: V5.10.19 production.

Modifications uniquement dans app.js + index.html :
- un Flash supprimé, lu, non ciblé ou désactivé est retiré immédiatement de l'écran agent;
- le bouton « Confirmer lecture » gère le cas où le Flash a déjà été supprimé par le QG;
- le popup ne reste plus bloqué si le document Firestore disparaît;
- nom agent compatible avec first_name/last_name et ancien prenom/nom;
- cache app.js passé à 51020.

Aucun SQL, aucune Edge Function, aucun Service Worker, aucune modification planning/MCI/PDF/prise de poste.

Rollback: dossier ROLLBACK_V5.10.19.
