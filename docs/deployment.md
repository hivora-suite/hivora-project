# Déploiement

Ce document décrit des capacités, jamais une infrastructure réelle.

## Image

- Un conteneur : API et front statique, servis par FastAPI sous Uvicorn. Sans Node à l'exécution.
- `ghcr.io/hivora-suite/hivora-project`, linux/amd64 et linux/arm64.
- Images de base figées par digest, dépendances verrouillées (`uv.lock`, `package-lock.json`).
- Jamais `privileged`, aucun accès au socket Docker, un seul volume : `/opt/hivora-project/data`.
- Utilisateur non root, système de fichiers en lecture seule, capacités retirées.
- HTTP sur le port 8080 dans le conteneur ; HTTPS assuré en amont par un reverse proxy.
- `HEALTHCHECK` sur la route de santé.
- Budgets vérifiés en CI : image < 120 Mo sur disque, RAM au repos < 100 Mo (mesuré au lot 2 : 68 Mo et 40 Mo).

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

En V1, uniquement par l'image GHCR et `deploy/compose.yaml`. Hivora Project est autonome : il n'a pas besoin de Hivora Panel pour être installé ou fonctionner.

```sh
HIVORA_PROJECT_VERSION=v0.1.0 HIVORA_PROJECT_BIND=192.0.2.10 \
  docker compose -f deploy/compose.yaml up -d
```

L'application écoute uniquement sur l'adresse indiquée, port 8080. Indiquer une version publiée, jamais `latest`. Les données sont dans le volume Docker `hivora-project_data`.

## Sauvegarde et mise à jour

- Avant toute migration, sauvegarde automatique de la base et du fichier de clé.
- Une base plus récente que le code est refusée au démarrage.
- Mise à jour : changer de version d'image, les migrations s'appliquent au démarrage.
- Retour en arrière : restaurer la sauvegarde avec l'image précédente.

## Dépôt privé jusqu'à la revue de sécurité

L'image GHCR est privée pendant cette période : le pull demande un jeton personnel local, jamais versionné. Les builds multi-architecture consomment les minutes de CI du compte : à surveiller.

## Conseils de durcissement

- Préférer un accès LAN ou VPN.
- En cas d'exposition à Internet : mode `public`, HTTPS par un reverse proxy.
- Activer le TOTP pour les comptes administrateurs dans tous les cas.
- Sauvegarder le dossier de données hors de la machine et protéger le fichier de clé.
- Appliquer les mises à jour de sécurité sans délai.
