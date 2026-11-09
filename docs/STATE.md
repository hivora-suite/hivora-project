# État du projet

**Lot 2 validé par la CI**, release candidate en cours.

## Fait

Dockerfile, `deploy/compose.yaml`, workflows CI, Image et Release. Installation réelle de l'image arm64 validée sur la VM.

## Prochaine étape

1. Publication de `v0.1.0-rc.1`, puis installation depuis GHCR.
2. Lot 3 : authentification (`roadmap.md`).

## Actions ouvertes (utilisateur)

- Créer le dépôt distant privé `hivora-project-security`, puis y pousser le dépôt local voisin (D19).
- Activer le signalement privé de GitHub, puis compléter le contact de `SECURITY.md`.

## Points à fixer

- Lot 3 : erreurs JSON, `app-shell`, portabilité PostgreSQL des modèles repris du panel, job CI PostgreSQL, création du premier administrateur sans mot de passe durable dans les logs.
- Lot 6 : bibliothèque de glisser-déposer.
