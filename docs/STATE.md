# État du projet

**Lot 8 en cours : revue de sécurité faite et corrigée.**

## Fait

Comptes, rôles, projets, Kanban, cartes (dates, checklist, étiquettes, membres, historique), commentaires.

Planning (D36, migrations 0010-0012) : vues jour, semaine, mois, année ; cartes datées et événements du projet, avec heures ou sur la journée, créés en glissant ou sur plusieurs jours choisis (Ctrl + clic) ; « Mon planning » : mes cartes de tous mes projets et mes événements privés.

Projets épinglés dans le menu (migration 0009), suppression d'un projet, 12 couleurs d'étiquettes (D35), confirmations intégrées.

Revue de sécurité (lot 8) :
- Corrigé : essais en parallèle qui contournaient la limitation ; mot de passe et codes devinables sans limite depuis une session ; TOTP désactivé sans fermer les autres sessions ; en-têtes anti-cadre, `nosniff`, `Referrer-Policy` ; avertissement en mode `public` sans proxy de confiance ; texte des commentaires retiré de l'historique (D34, migration 0008).
- Assumé et documenté dans `SECURITY.md` : blocage par nom d'utilisateur, Argon2 dans le processus principal, documentation de l'API publique.

## Prochaine étape

Lot 8, suite : mise à jour depuis `v0.1.0-rc.1` vers la nouvelle version (migration 0008 incluse), puis release V1 après accord.

## Actions ouvertes (utilisateur)

- Activer le signalement privé de GitHub, puis compléter le contact de `SECURITY.md`.
