# deploy/CLAUDE.md

Détail du pipeline : `docs/deployment.md`.

## Règles
- Une image, un conteneur, linux/amd64 et linux/arm64.
- Images de base figées par digest. Jamais `latest` dans le modèle du panel.
- Le conteneur n'est jamais `privileged` et ne monte que son dossier de données.
- Aucune valeur réelle dans ce dossier : ni IP, ni domaine, ni secret. Exemples avec `example.com` et `192.0.2.0/24`.
- Secrets de CI uniquement dans GitHub Actions.

## Exigent un accord explicite
Tag ou release, publication d'image, ouverture du dépôt, modification du catalogue de `hivora_panel`.

## Reprise du panel
Partir de `../hivora_panel/Dockerfile` et de ses workflows CI, image et release, ainsi que de `release-check.sh`. Retirer Compose, le catalogue, `install.sh` et tout accès au socket Docker.
