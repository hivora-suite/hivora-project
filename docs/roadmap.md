# Roadmap

## Versions

| Version | Contenu | Critère de sortie |
|---|---|---|
| **V1** | Projects, Tasks, Kanban, Comments, Members, Roles ; connexion, sessions, CSRF, limitation des essais, TOTP ; image GHCR, documentation d'installation et `deploy/compose.yaml` | Une équipe réelle gère un projet de bout en bout |
| **V1.1** | Vue liste et filtres, temps réel, Notification, Attachment | Plus de rechargement manuel ; notifications et pièces jointes disponibles |
| **V1.2** | Planning (échéances, calendrier), TimeTracking | Dates et temps suivis sur les projets |
| **V2** | Dépendances, Gantt, reporting avancé | Besoin confirmé par l'usage |

Tout ce qui sort de la version en cours est refusé par défaut et signalé avant de coder. Une feature ne change de version que par une ligne dans `decisions.md`.

Après la V1 : réévaluer une éventuelle intégration au catalogue de Hivora Panel.

## Lots de la V1

Une session par lot.

| Lot | Contenu | Pourquoi à cette place |
|---|---|---|
| 1. Outillage | Toolchain, squelette, route de santé, front vide à la DA, commande de vérification, détection de secrets, graphe et hooks | Rien ne peut être vérifié sans cela |
| 2. Déploiement | Image amd64 et arm64, CI, release candidate après accord, installation réelle depuis l'image | Risque le plus élevé, traité quand il n'y a presque rien à casser ; chaque lot suivant passe par la même chaîne |
| 3. Authentification | Connexion, sessions, CSRF, TOTP, comptes, rôles d'instance | Chaque route métier dépend du contrôle d'accès |
| 4. Projects | Projets et appartenance | Racine des données |
| 5. Tasks | Tâches et colonnes | Le Kanban n'est qu'une vue des tâches |
| 6. Kanban | Tableau, déplacement souris et clavier | Exige des tâches réelles |
| 7. Comments | Commentaires | Élément terminal, réductible sans bloquer la V1 |
| 8. Release V1 | Revue de sécurité, mise à jour depuis la RC testée, ouverture du dépôt après accord, release après accord | Seul le produit complet peut être revu puis publié |
