# Règles de travail avec les assistants IA

Critères et exceptions. La forme courte, toujours chargée, est dans `CLAUDE.md`.

| Règle | Critère | Exception |
|---|---|---|
| Knowledge-base-first | Pas de code sans que le besoin soit couvert par un document validé | Correctif évident sans effet sur le domaine |
| Reuse First | Recherche faite et annoncée en une ligne avant toute création | Aucune |
| Un lot par session | Un objectif de `roadmap.md`, puis `/clear` | Correctif bloquant découvert pendant le lot |
| Pas de refactor global non demandé | Le diff se limite au besoin du lot | Accord explicite |
| Pas de fichier inutile | Chaque fichier a un usage immédiat ; pas de squelette « pour plus tard » | Aucune |
| Pas de dépendance sans justification | Stdlib, plateforme et dépendances installées écartées d'abord, raison en une ligne | Aucune |
| Pas de TODO silencieux | Un manque connu figure dans `STATE.md`, ou dans un commentaire explicite s'il s'agit d'une limite assumée | Aucune |
| Respect du routage | Lire uniquement le document routé | Revue de cohérence demandée |
| Tokens minimaux | Voir ci-dessous | Aucune |

## Minimiser les tokens

- Démarrage : `CLAUDE.md`, `STATE.md`, puis le document routé. Ne pas utiliser d'import `@docs/...`.
- Code : `graphify query --budget 800`, puis lecture ciblée, jamais de lecture exhaustive.
- Copie depuis le panel par shell, jamais lire puis réécrire.
- Conception sur Opus, exécution d'un lot cadré sur Sonnet.
- Pas de sous-agent sauf demande.
- Sorties de commandes courtes : seulement les échecs.

## Discipline documentaire

- Un fait = un seul emplacement ; les autres documents y renvoient.
- Limites : `CLAUDE.md` 3 Ko, `CLAUDE.md` imbriqués 2 Ko, documents 5 Ko, `STATE.md` 1,5 Ko. Un document trop long est découpé.
- `STATE.md` est réécrit, jamais allongé.
- Les décisions d'une version terminée partent dans une archive lue sur demande.

## Actions exigeant un accord explicite

Commit, push, tag, release, publication, suppression de données.

`hivora_panel` est en lecture seule : aucune modification depuis ce projet.

## Sécurité

Classification et compromission : `conventions.md`. En cas de lecture accidentelle d'un secret, le signaler immédiatement.
