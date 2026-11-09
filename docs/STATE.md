# État du projet

**Lot 1 terminé.**

## Fait

Backend avec route de santé, page d'accueil à la DA, `make check`, `make e2e`, `make gen`, contrôle de secrets avant commit, graphe et hooks.

## Prochaine étape

Lot 2 : déploiement (`roadmap.md`).

## Actions ouvertes (utilisateur)

- Créer le dépôt distant privé `hivora-project-security`, puis y pousser le dépôt local voisin (D19).
- Fournir l'adresse de contact de `SECURITY.md` avant l'ouverture du dépôt.
- Autoriser ou non `gitleaks` : `scripts/check-secrets.sh` n'est qu'un contrôle à motifs.

## Points à fixer

- Lot 2 : port, terminaison TLS, budgets de l'image et de la RAM, détection de secrets en CI.
- Lot 3 : erreurs JSON, `app-shell`, portabilité PostgreSQL des modèles repris du panel, création du premier administrateur sans mot de passe durable dans les logs.
- Lot 6 : bibliothèque de glisser-déposer.
