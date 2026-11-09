# Conventions

## Langues

Code et commentaires en anglais. Documentation en français. Interface en français et en anglais.

## Code

- Python : `ruff`, `mypy` strict. TypeScript : `tsc`.
- Un module par contexte métier, nommé comme lui (`bounded-contexts.md`).
- Noms du domaine repris du glossaire (`domain-model.md`).

## Tests

- Une logique non triviale ou un chemin de sécurité : au moins un test qui échoue si la logique casse.
- Une route : test du rôle requis et de l'accès à un projet tiers.
- Un parcours utilisateur critique : un test Playwright.
- Pas de test pour du code trivial.

## Commits

Message court à l'impératif, décrivant le changement. Auteur : `hiidenops`. Aucun trailer Claude ni mention « Generated with ». Une modification fonctionnelle ajoute une ligne sous `## [Non publié]` de `CHANGELOG.md` dans le même commit.

## SQL portable

SQLite WAL en V1, compatibilité PostgreSQL obligatoire.

- Migrations rejouables sur les deux moteurs, vérifiées par un job CI PostgreSQL dès la première migration.
- Interdits : `INSERT OR REPLACE`, `PRAGMA` dans les migrations, `rowid`, typage dynamique, FTS5 et fonctions propres à SQLite.
- Types explicites et portables pour les identifiants, les dates (UTC) et les booléens.
- SQL isolé dans chaque contexte : changer de moteur ne touche pas la logique métier.
- Le mode WAL et l'activation des clés étrangères se règlent à la connexion, jamais dans une migration.

## Classification des informations

| Niveau | Contenu | Règle |
|---|---|---|
| 0. Public | Vision, roadmap, architecture métier, domain model, design system, conventions | Dans le dépôt ; publication possible après la revue de sécurité |
| 1. Secrets | Clés API, tokens, secrets JWT, mots de passe, certificats, clés SSH et privées, secrets Cloudflare, GitHub, GHCR, SMTP, base de données | Interdits dans `CLAUDE.md`, `CLAUDE.local.md`, documentation, graphify, commits, issues, exemples. Uniquement : variables d'environnement, secret manager, fichiers locaux ignorés par git et hors du dépôt quand c'est possible |
| 2. Infrastructure | IP internes, noms réels des serveurs, inventaire, URLs de production, topologie détaillée, configuration SSH | Interdits dans tous les `CLAUDE.md`, `docs/`, graphify, commits, issues, exemples. Décrire des capacités, jamais l'implémentation réelle |
| 3. Documentation sécurité | Modèle de menaces, durcissement, réponse à incident | Dépôt privé séparé, lu sur demande explicite ; jamais de niveau 1, niveau 2 seulement si indispensable |

Valeurs d'exemple : `example.com`, `192.0.2.0/24`.

Une clé par projet : Hivora Project et Hivora Panel ne partagent jamais une clé ni un secret.

## Compromission

Tout élément de niveau 1 exposé dans un chat IA, un commit, une issue, une capture d'écran, un document partagé ou des logs accessibles est compromis.

1. Le remplacer et révoquer l'ancien.
2. Vérifier ses usages.
3. Consigner l'incident sans jamais reproduire la valeur.

Supprimer le message, le commit ou la capture ne suffit pas.

Les refus de lecture de `.claude/settings.json` ne couvrent pas un `cat` lancé par le shell : ils complètent ces règles sans les remplacer.
