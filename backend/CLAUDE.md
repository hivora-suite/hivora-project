# backend/CLAUDE.md

Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic. Outils : `uv`, `ruff`, `mypy` strict, `pytest`.

## Structure
Un module par contexte V1 (`member`, `project`, `task`) et un noyau `core`. Frontières et dépendances : `docs/bounded-contexts.md`. Ne créer que les contextes de la version en cours.

## Règles
- Routes fines ; la logique vit dans des services testables sans serveur.
- Seul le contexte propriétaire écrit dans ses tables. Autre contexte : passer par son interface publique.
- Chaque route déclare le rôle requis (`docs/permissions.md`) et vérifie l'accès au projet concerné.
- Erreurs métier : exceptions à code stable, traduites en réponse HTTP à la frontière (`docs/api-contract.md`).
- Secrets : variables d'environnement ou fichier local, jamais dans la base en clair, les logs ou les réponses.
- Aucun appel réseau externe dans une transaction.

## Base
- Toute évolution de schéma passe par Alembic.
- SQL portable : règles dans `docs/conventions.md`, vérifiées sur SQLite et PostgreSQL.
- Après un changement de route : `make gen`.

## Reprise du panel
Copier par shell depuis `../hivora_panel/backend/src/hivora` : `core`, `db`, `auth`, dépendances web, tests associés. Retirer tout ce qui touche à Docker, aux jobs et aux métriques, puis adapter. Vérifier la portabilité des modèles repris.
