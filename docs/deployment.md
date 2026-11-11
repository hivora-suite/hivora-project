# Déploiement

Ce document décrit des capacités, jamais une infrastructure réelle.

## Image

- Un conteneur : API et front statique, servis par FastAPI sous Uvicorn. Sans Node à l'exécution.
- Construite sur la machine d'installation depuis les sources d'une release GitHub, linux/amd64 et linux/arm64. Aucun paquet publié.
- Images de base figées par digest, dépendances verrouillées (`uv.lock`, `package-lock.json`).
- Jamais `privileged`, aucun accès au socket Docker, un seul volume : `/opt/hivora-project/data`.
- Utilisateur non root, système de fichiers en lecture seule, capacités retirées.
- HTTP sur le port 8080 dans le conteneur ; HTTPS assuré en amont par un reverse proxy.
- `HEALTHCHECK` sur la route de santé.
- Budgets vérifiés en CI : image < 120 Mo sur disque, RAM au repos < 100 Mo (mesuré au lot 2 : 68 Mo et 40 Mo).

## Configuration

Variables d'environnement préfixées `HIVORA_PROJECT_`. Mode d'accès (`lan` ou `public`) lu dans la configuration, jamais stocké en base. En mode `public`, derrière un reverse proxy HTTPS : TOTP obligatoire pour tous, cookies `Secure`, et adresse du proxy dans `HIVORA_PROJECT_TRUSTED_PROXY` pour que la limitation des essais voie la vraie adresse des clients. Sans elle, tous les clients partagent l'adresse du proxy : quelques échecs de n'importe qui bloquent alors toutes les connexions, et un avertissement s'affiche au démarrage. Indiquer l'adresse exacte du proxy, telle que le conteneur la voit, jamais `*` : toute adresse pourrait alors se faire passer pour une autre.

## CI

| Workflow | Contrôle |
|---|---|
| CI | Format, lint, types, tests backend sur SQLite ; migrations sur PostgreSQL ; lint, tests, build et bundle du front ; parcours e2e ; détection de secrets ; taille des documents |
| Image | Construction, santé du conteneur, budgets |
| Release | Tag sur `main`, cohérence des versions, construction amd64 et arm64 sans publication, GitHub Release |

## Versions et release

Le tag `vX.Y.Z` (ou `vX.Y.Z-rc.N`) doit correspondre à la version de `pyproject.toml` et de `package.json`. Les notes viennent de la section de cette version dans `CHANGELOG.md`. Une pré-version est marquée comme telle sur GitHub.

## Installation

En V1, uniquement depuis les sources d'une release GitHub, avec `deploy/compose.yaml`. Hivora Project est autonome : il n'a pas besoin de Hivora Panel pour être installé ou fonctionner.

```sh
git clone --branch v0.1.0 https://github.com/hivora-suite/hivora-project.git
cd hivora-project
HIVORA_PROJECT_BIND=192.0.2.10 docker compose -f deploy/compose.yaml up -d --build
```

L'application écoute uniquement sur l'adresse indiquée, port 8080. Choisir une version publiée. Les données sont dans le volume Docker `hivora-project_data`.

## Premier démarrage et récupération

Au premier démarrage, le compte `admin` reçoit un mot de passe à usage unique, affiché une seule fois dans les journaux du conteneur et à changer à la première connexion. `HIVORA_PROJECT_INITIAL_ADMIN_PASSWORD` permet de le choisir.

Compte perdu : `docker exec hivora-project python -m hivora_project reset-account <utilisateur>` donne un nouveau mot de passe à usage unique, désactive le TOTP et ferme les sessions.

## Sauvegarde et mise à jour

- Avant toute migration, sauvegarde automatique de la base et du fichier de clé.
- Une base plus récente que le code est refusée au démarrage.
- Mise à jour : récupérer la nouvelle release et relancer la construction, les migrations s'appliquent au démarrage.
- Retour en arrière : restaurer la sauvegarde avec la version précédente.

## Conseils de durcissement

- Préférer un accès LAN ou VPN.
- En cas d'exposition à Internet : mode `public`, HTTPS par un reverse proxy.
- Activer le TOTP pour les comptes administrateurs dans tous les cas.
- Sauvegarder le dossier de données hors de la machine et protéger le fichier de clé.
- Appliquer les mises à jour de sécurité sans délai.
