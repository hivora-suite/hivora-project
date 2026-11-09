# Déploiement

Ce document décrit des capacités, jamais une infrastructure réelle.

## Image

- Un conteneur : API et front statique, servis par FastAPI sous Uvicorn. Sans Node à l'exécution.
- `ghcr.io/hivora-suite/hivora-project`, linux/amd64 et linux/arm64.
- Images de base figées par digest, dépendances verrouillées (`uv.lock`, `package-lock.json`).
- Jamais `privileged`, aucun accès au socket Docker, un seul volume : `/opt/hivora-project/data`.
- `HEALTHCHECK` sur la route de santé.
- Budget de l'image et de la RAM : mesurés au lot 2, puis vérifiés en CI.

## Configuration

Variables d'environnement préfixées `HIVORA_PROJECT_`. Mode d'accès (`lan` ou `public`) lu dans la configuration, jamais stocké en base. En mode `public`, le TOTP est obligatoire pour tous.

## CI

| Workflow | Contrôle |
|---|---|
| CI | Format, lint, types, tests backend sur SQLite ; migrations sur PostgreSQL ; lint, tests, build et bundle du front ; parcours e2e ; détection de secrets ; taille des documents |
| Image | Construction, santé du conteneur, budgets |
| Release | Tag sur `main`, cohérence des versions, publication de l'image, GitHub Release |

## Versions et release

Le tag `vX.Y.Z` (ou `vX.Y.Z-rc.N`) doit correspondre à la version de `pyproject.toml` et de `package.json`. Les notes viennent de la section de cette version dans `CHANGELOG.md`. Une pré-version ne reçoit jamais `latest`.

## Installation

Par `deploy/compose.yaml`, ou depuis le catalogue de Hivora Panel à partir de la V1 : modèle déclaratif, image figée par digest, publication possible seulement après l'ouverture du dépôt.

## Sauvegarde et mise à jour

- Avant toute migration, sauvegarde automatique de la base et du fichier de clé.
- Une base plus récente que le code est refusée au démarrage.
- Mise à jour : changer de version d'image, les migrations s'appliquent au démarrage.
- Retour en arrière : restaurer la sauvegarde avec l'image précédente.

## Dépôt privé jusqu'à la revue de sécurité

L'image GHCR est privée pendant cette période : le pull demande un jeton personnel local, jamais versionné. Les builds multi-architecture consomment les minutes de CI du compte : à surveiller.

## Conseils de durcissement

- Préférer un accès LAN ou VPN.
- En cas d'exposition à Internet : mode `public`, HTTPS par un proxy, par exemple celui du panel.
- Activer le TOTP pour les comptes administrateurs dans tous les cas.
- Sauvegarder le dossier de données hors de la machine et protéger le fichier de clé.
- Appliquer les mises à jour de sécurité sans délai.
