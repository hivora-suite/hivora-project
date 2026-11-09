# Contrat d'API

Conventions uniquement. La liste des routes vient de l'OpenAPI généré. Ce contrat reprend celui du panel, pour que le front copié fonctionne sans adaptation.

## Généralités

- Préfixe : `/api/v1`. Corps en JSON.
- Santé : `GET /api/v1/system/health`, sans authentification.
- Succès sans contenu : `204`.
- Types du front générés depuis l'OpenAPI.

## Authentification

- Cookie de session `HttpOnly`, `SameSite=Strict`, et `Secure` en mode d'accès `public` (en `lan`, l'accès direct se fait en HTTP).
- Seule l'empreinte du jeton de session est stockée.
- Routes reprises du panel : `login`, `logout`, `me`, `password`, `totp/enroll`, `totp/confirm`, `totp/disable`, `sessions`.

## CSRF

`me` et `login` renvoient `csrf_token`. Le front le renvoie dans l'en-tête `X-CSRF-Token` sur toute requête autre que `GET`. Requête sans jeton valide : `403`.

## Erreurs

```json
{ "error": { "code": "not_found", "message": "...", "details": {} } }
```

- `code` est stable et traduisible par le front. `message` n'est pas destiné à l'affichage.
- Une réponse d'erreur ne contient jamais de secret ni de trace d'exécution.

| Statut | Usage |
|---|---|
| `401` | Non authentifié |
| `403` | Rôle insuffisant, CSRF invalide, action bloquée (`totp_setup_required`) |
| `404` | Ressource absente, **ou projet auquel l'utilisateur n'appartient pas** |
| `409` | Conflit d'état (`totp_mandatory`, dernier administrateur) |
| `422` | Validation |
| `429` | Trop de tentatives |

Le `404` sur un projet inaccessible évite de révéler son existence.

## Listes

Le tableau d'un projet est renvoyé en entier. Une pagination n'est ajoutée qu'aux collections qui peuvent croître sans limite.

## Déplacement de tâche

Une seule opération porte la colonne cible et la position, et s'applique dans une transaction.

## WebSocket (V1.1)

Point d'entrée unique `/ws`, authentifié par le cookie. Messages : `{ "op": "subscribe" | "unsubscribe", "channel": "...", "id": ... }`.
