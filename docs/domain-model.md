# Modèle de domaine (V1)

Modèle conceptuel. Le schéma réel vit dans les migrations Alembic, à partir du lot 3. Propriétaire de chaque table : `bounded-contexts.md`.

## Glossaire

| Terme | Sens |
|---|---|
| Instance | Une installation, pour une équipe |
| Utilisateur | Compte de l'instance |
| Membre | Utilisateur rattaché à un projet avec un rôle |
| Projet | Espace de travail contenant un tableau |
| Colonne | Étape ordonnée du Kanban d'un projet |
| Tâche | Unité de travail, placée dans une colonne |
| Commentaire | Message attaché à une tâche |

## Entités

| Entité | Attributs |
|---|---|
| `user` | identifiant, nom d'utilisateur, empreinte du mot de passe, rôle d'instance, désactivé, mot de passe à changer, secret TOTP chiffré, TOTP actif, empreintes des codes de secours |
| `session` | identifiant, utilisateur, empreinte du jeton, jeton CSRF, création, expiration |
| `project` | identifiant, nom, description, créateur, création, archivage (réversible) |
| `project_member` | projet, utilisateur, rôle de projet |
| `board_column` | identifiant, projet, nom, position |
| `task` | identifiant, projet, colonne, titre, description, position, assigné, créateur, création, mise à jour |
| `comment` | identifiant, tâche, auteur, texte, création, modification |

Une tâche V1 n'a ni date, ni estimation, ni dépendance.

## Invariants

**Comptes**

- Il reste toujours au moins un administrateur actif.
- Mots de passe, jetons et codes de secours ne sont stockés que sous forme d'empreinte.

**Projets**

- Un projet actif a toujours au moins un `manager`.
- Un projet archivé est en lecture seule.
- Un nouveau projet reçoit des colonnes par défaut.

**Tâches**

- La colonne d'une tâche appartient au projet de la tâche.
- L'assigné d'une tâche est membre de son projet.
- Retirer un membre d'un projet libère ses tâches assignées.
- Une colonne non vide ne peut pas être supprimée.
- L'ordre des colonnes et des tâches est déterminé par `position`.

**Commentaires**

- Un commentaire ne peut être modifié que par son auteur.
- Un commentaire appartient à une seule tâche et disparaît avec elle.
