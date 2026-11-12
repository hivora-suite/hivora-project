# Contextes métier

Le noyau `core` (configuration, erreurs, base, horloge, bus d'événements) reste technique et sans logique métier.

| Contexte | Version | Responsabilités | Données | Dépendances autorisées |
|---|---|---|---|---|
| **Member** | V1 | Comptes, authentification, sessions, appartenance, rôles, contrôle d'accès | `user`, `session`, `project_member` | `core` |
| **Project** | V1 | Créer, modifier, archiver, supprimer, épingler | `project`, `project_pin` | Member |
| **Task** | V1 | Cartes (dates, checklist, étiquettes, assignés, historique), colonnes, déplacement, commentaires | `task`, `task_assignee`, `checklist_item`, `task_event`, `board_column`, `comment` | Project, Member |
| **Notification** | V1.1 | Événements vers notifications, lu/non lu | `notification` | Member, événements via `core` |
| **Attachment** | V1.1 | Stockage, téléchargement, quotas | `attachment` | Task, Member |
| **Planning** | V1, V1.2, V2 | Calendrier et événements (V1), jalons, dépendances, Gantt | `calendar_event`, `milestone`, `task_dependency` | Task, Project, Member |
| **TimeTracking** | V1.2 | Temps estimé et passé, totaux | `time_entry` | Task, Member |

## Frontières

- Dépendances à sens unique, sans cycle : Member ← Project ← Task ← Planning, TimeTracking, Attachment.
- Aucun contexte ne dépend de Notification : les contextes émettent des événements sans connaître leurs consommateurs.
- Appels entre contextes par interface publique uniquement.
- Seul le contexte propriétaire écrit dans ses tables.
- Exception en lecture : jointure sur les colonnes d'identité (`user.username`, `project.name`).
- Une clé étrangère entre contextes est permise : elle ne donne aucun droit d'écriture.
- Quand un contexte amont doit déclencher un effet en aval (colonnes d'un nouveau projet, tâches d'un membre retiré), l'assemblage dans `runtime.py` lui fournit le rappel : il ne dépend pas de l'aval.
- Seuls les contextes de la version en cours sont créés.
- Un nouveau contexte exige une ligne dans `decisions.md`.

## Vérification

En revue, `graphify path "<ContexteA>" "<ContexteB>"` sert à détecter une dépendance interdite.
