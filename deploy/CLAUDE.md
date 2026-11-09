# deploy/CLAUDE.md

Détail du pipeline : `docs/deployment.md`.

## Règles
- Une image, un conteneur, linux/amd64 et linux/arm64.
- Images de base figées par digest. Exemples d'installation avec une version précise, jamais `latest`.
- Déploiement autonome : aucune dépendance à Hivora Panel, jamais de modification de son dépôt.
- Le conteneur n'est jamais `privileged` et ne monte que son dossier de données.
- Aucune valeur réelle dans ce dossier : ni IP, ni domaine, ni secret. Exemples avec `example.com` et `192.0.2.0/24`.
- Secrets de CI uniquement dans GitHub Actions.

## Exigent un accord explicite
Tag ou release, publication d'image, ouverture du dépôt.

## Reprise du panel
Copier, en lecture seule, `../hivora_panel/Dockerfile`, ses workflows CI, image et release, et `release-check.sh`. Dans la copie, retirer le binaire Compose, le catalogue, `install.sh` et tout accès au socket Docker.
