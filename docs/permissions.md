# Permissions

## Rôles

| Portée | Rôle | Sens |
|---|---|---|
| Instance | `admin` | Gère les comptes et accède à tous les projets comme `manager` |
| Instance | `member` | Utilisateur standard, accède à ses projets |
| Projet | `manager` | Gère le projet, ses membres et son tableau |
| Projet | `contributor` | Crée et fait avancer les tâches, commente |
| Projet | `viewer` | Lecture seule |

## Instance

| Action | `admin` | `member` |
|---|---|---|
| Créer, désactiver un compte, changer son rôle | Oui | Non |
| Réinitialiser le TOTP d'un compte | Oui | Non |
| Choisir les projets accessibles à un compte | Oui | Non |
| Créer un projet (le créateur devient `manager`) | Oui | Oui |
| Gérer son propre compte (mot de passe, TOTP, sessions) | Oui | Oui |

## Projet

| Action | `manager` | `contributor` | `viewer` |
|---|---|---|---|
| Voir le projet, le tableau, les commentaires | Oui | Oui | Oui |
| Modifier, archiver ou réactiver le projet | Oui | Non | Non |
| Gérer les membres et leurs rôles | Oui | Non | Non |
| Gérer les colonnes | Oui | Non | Non |
| Créer, modifier, déplacer, assigner une tâche | Oui | Oui | Non |
| Supprimer une tâche | Oui | Non | Non |
| Commenter | Oui | Oui | Non |
| Modifier son commentaire | Oui | Oui | Non |
| Supprimer un commentaire | Tous | Le sien | Non |

## Règles d'application

- Chaque route déclare le rôle requis ; il n'existe pas de route sans contrôle, hors connexion et santé.
- L'accès à une ressource est toujours contrôlé par rapport à son projet.
- Tant que le mot de passe initial n'est pas changé, seuls `me`, `password` et `logout` sont autorisés.
- Une instance publique impose le TOTP à tous ; tant qu'il n'est pas activé, seules les routes nécessaires à son activation répondent.
- La réinitialisation du TOTP par un admin ferme les sessions du compte.
