# Décisions

Une ligne par décision. Toutes datées du 09/11/2026.

| # | Choix | Raison |
|---|---|---|
| D1 | Nom unique « Hivora Project » : dépôt `hivora-suite/hivora-project`, dossier `hivora_project` | Identité claire |
| D2 | `CLAUDE.md` versionnés ; préférences personnelles dans `CLAUDE.local.md`, ignoré | Règles relues en PR et présentes à chaque clone |
| D3 | Quatre `CLAUDE.md` modulaires, sans import `@docs/...` | Un import chargerait tout au démarrage |
| D4 | Documentation modulaire, un rôle par document, limites de taille | Lire seulement ce qui est utile |
| D5 | V1 limitée (`roadmap.md`) | Livrer tôt, maintenir peu |
| D6 | Contextes définis avant le code (`bounded-contexts.md`) | Frontières stables |
| D7 | Équipe auto-hébergée, une instance, un conteneur | Besoin visé |
| D8 | Backend FastAPI, SQLAlchemy, Alembic | Réutilise le socle du panel, réduit maintenance et tokens |
| D9 | Front copié du panel puis indépendant ; paquet partagé seulement si une troisième app apparaît | Copie sans tokens, dérive acceptée |
| D10 | Graphe limité au code, sans LLM, créé au lot 1 | Sans coût, inutile sans code |
| D11 | Commits sous `hiidenops`, sans trailer Claude | Règle de l'utilisateur |
| D12 | Reuse First obligatoire | Éviter doublons, dette et tokens |
| D13 | Aucune information sensible dans `CLAUDE.md`, docs métier, graphify, commits ou issues | Limiter toute exposition (`conventions.md`) |
| D14 | V1 = monolithe : aucun microservice, aucun service séparé, aucun découpage distribué avant validation explicite | Simplicité |
| D15 | SQLite WAL en V1, compatibilité PostgreSQL obligatoire (`conventions.md`) | Migration future sans réécriture métier |
| D16 | Tout secret exposé est compromis et doit être remplacé (`conventions.md`) | Une suppression n'annule pas une exposition |
| D17 | TOTP en V1 : activation par utilisateur, codes de secours, réinitialisation par un administrateur, obligatoire pour les instances exposées publiquement | Exposition Internet à prévoir |
| D18 | Dépôt privé jusqu'à la première revue de sécurité : aucune publication avant, aucun secret dedans même privé, ouverture visée après validation | Revue avant exposition |
| D19 | Documentation sécurité dans un dépôt privé séparé : hors du répertoire du projet, non indexée par graphify, non chargée automatiquement, jamais de secret dedans | Isolation structurelle |
| D20 | Licence AGPL-3.0 | Cohérence avec le panel |
| D21 | Vue liste et temps réel en V1.1 | V1 limitée |
| D22 | Rôles : `admin` et `member` pour l'instance ; `manager`, `contributor`, `viewer` par projet (`permissions.md`) | Modèle simple |
| D23 | V1 autonome : déploiement uniquement par image GHCR, documentation d'installation et `deploy/compose.yaml` ; Hivora Panel en lecture seule ; intégration au catalogue réévaluée après la V1 | Aucun impact sur le panel |
