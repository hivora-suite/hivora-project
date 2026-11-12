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
| D18 | Dépôt public depuis le 09/11/2026 ; revue de sécurité obligatoire avant toute release stable ; aucun secret ni information d'infrastructure dans le dépôt | Code AGPL ouvert, sans publier de version stable non revue |
| D19 | Pas de dépôt ni de documentation dédiés à la sécurité : elle est portée par le code, ses tests, la revue avant release et `SECURITY.md` (révisée le 10/11/2026) | Simplicité, demande de l'utilisateur |
| D20 | Licence AGPL-3.0 | Cohérence avec le panel |
| D21 | Vue liste et temps réel en V1.1 | V1 limitée |
| D22 | Rôles : `admin` et `member` pour l'instance ; `manager`, `contributor`, `viewer` par projet (`permissions.md`) | Modèle simple |
| D23 | V1 autonome : déploiement uniquement par release GitHub, documentation d'installation et `deploy/compose.yaml` ; Hivora Panel en lecture seule ; intégration au catalogue réévaluée après la V1 | Aucun impact sur le panel |
| D24 | Détection de secrets : `gitleaks` en CI ; contrôle local à motifs avant commit | Rien à installer sur la VM |
| D25 | HTTP sur le port 8080 dans le conteneur, HTTPS par un reverse proxy en amont | Pas de gestion de certificats dans l'application |
| D26 | Accent violet vif, neutres noir et blanc sans teinte, blancs adoucis | Identité propre, distincte du panel |
| D27 | Aucun paquet GHCR : uniquement des releases sur le dépôt, image construite à l'installation | Choix de l'utilisateur, rien à publier hors du dépôt |
| D28 | Cookie `Secure` en mode `public` seulement ; en `lan`, accès direct en HTTP | L'application ne gère pas TLS (D25), un cookie `Secure` bloquerait la connexion en HTTP |
| D29 | Compte identifié par un nom d'utilisateur, sans e-mail ; codes de secours stockés sur le compte | Reprise du modèle du panel, pas d'envoi d'e-mail en V1 |
| D30 | Effets d'un contexte sur un autre par rappels fournis à l'assemblage, pas de bus d'événements en V1 | Pas de dépendance inverse, sans mécanisme de plus |
| D31 | Glisser-déposer natif du navigateur, sans bibliothèque ; alternative clavier Alt + flèches | Aucune dépendance, accessible |
| D32 | Projets en blocs ; menu : projets épinglés par compte, dépliables vers leurs onglets ; accès aux projets depuis les comptes | Demande |
| D33 | Dates, checklist, étiquettes et plusieurs assignés avancés en V1, sur la carte (contexte Task) | Demande de l'utilisateur, cartes proches de Trello |
| D34 | L'historique d'une carte note l'ajout, la modification et la suppression d'un commentaire, sans jamais son texte ; une migration efface le texte déjà stocké | Choix de l'utilisateur à la revue de sécurité : un commentaire supprimé ne doit rien laisser |
| D35 | 12 couleurs d'étiquettes en tokens `--label-<nom>`, hors couleurs d'état ; pas de couleur libre | Demande |
| D36 | Planning en V1 : vues jour à année ; événements `calendar_event` (heures `HH:MM` sans fuseau ou journée entière), créés en glissant ; « Mon planning » : mes cartes et mes événements privés | Demande |
