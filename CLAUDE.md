# CLAUDE.md — Hivora Project

Gestion de projet pour équipes auto-hébergées, avec le front et la DA de Hivora Panel.

## Invariants
- Monolithe, un conteneur, une instance par équipe, sans accès au socket Docker.
- FastAPI, SQLAlchemy, Alembic, SQLite WAL, SQL portable PostgreSQL.
- Next.js exporté en statique, servi par le backend.
- Autonome : Hivora Panel est en lecture seule, aucune modification ni dépendance.
- Knowledge-base-first : pas de code sans document validé.
- Hors version en cours : refuser et signaler avant de coder.

## Reuse First
Avant de créer composant, route, page, hook, service, endpoint, table ou type : chercher l'existant (`graphify query`, puis recherche ciblée). Créer seulement si rien d'équivalent n'existe ou si généraliser coûterait plus cher, et dire en une ligne ce qui a été cherché. La duplication est un bug d'architecture.

## Code
Très optimisé, séparé par responsabilité, le moins de lignes possible.

## Output rules
Réponses courtes, sans explication inutile. Montrer uniquement : fichiers modifiés, justification si nécessaire, étapes de validation.

## Interdits
Refactor global non demandé, fichier inutile, dépendance sans justification, TODO silencieux.

## Session
Lire ce fichier, `docs/STATE.md`, puis seulement le document routé. Un lot par session. Pas de sous-agent sauf demande. Sorties de commandes courtes. Fin de lot : vérifications vertes, `STATE.md` réécrit, commit après accord, sans trailer Claude.

## Routage (`docs/`)
| Besoin | Document |
|---|---|
| Utilité d'une demande | `vision.md` |
| Interaction, parcours | `product-principles.md` |
| Prévu ou non | `roadmap.md` |
| Placer du code métier | `bounded-contexts.md` |
| Entités, tables | `domain-model.md` |
| Droits | `permissions.md` |
| Routes | `api-contract.md` |
| UI | `design-system.md` |
| Build, release | `deployment.md` |
| Code, tests, SQL, classification | `conventions.md` |
| Règles IA détaillées | `ai-rules.md` |
| Choix passés | `decisions.md` |

## Sécurité
Jamais de secret (clé, token, mot de passe, certificat) ni d'infrastructure réelle (IP, serveurs, URLs de production, SSH) dans les `CLAUDE.md`, la documentation, graphify, les commits, les issues ou les exemples. Tout secret exposé est compromis et doit être remplacé.

## Commandes
`make check` tout vérifier · `make e2e` parcours navigateur · `make gen` types de l'API · `make run` lancer sur l'adresse de la VM, port 8000 · `make lock` après un changement de `package.json` · `make hooks` poser les hooks git

## Graphify
`graphify query "<question>" --budget 800` avant de parcourir le code ; `path` et `explain` pour les relations ; `graphify update .` après modification. `GRAPH_REPORT.md` : revues d'architecture seulement.
