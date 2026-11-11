# Politique de sécurité

## Signaler une vulnérabilité

Signalez toute vulnérabilité **en privé**, à l'adresse suivante : `<adresse-de-contact-securite>`.

**Ne publiez jamais une faille dans une issue, une discussion ou une pull request publique.**

Indiquez :

- la version concernée ;
- le problème constaté et son impact ;
- les étapes pour le reproduire.

N'incluez aucun secret réel, aucune donnée personnelle et aucune information sur une infrastructure de production.

## Traitement

1. Accusé de réception du signalement.
2. Analyse et évaluation de la gravité.
3. Correctif, puis publication d'une version.
4. Publication d'un avis de sécurité une fois le correctif disponible.

## Divulgation responsable

Merci de laisser le temps de publier un correctif avant toute divulgation, de vous limiter à ce qui est nécessaire pour démontrer le problème, et de ne pas accéder aux données d'autrui ni perturber un service. Les signalements faits de bonne foi selon ces règles sont les bienvenus, et leurs auteurs seront crédités s'ils le souhaitent.

## Protections et limites connues

Protections en place :

- Toute vérification d'un mot de passe ou d'un code est limitée : à la connexion, mais aussi depuis une session ouverte (changement de mot de passe, activation et désactivation du TOTP). Après 5 échecs, un délai croissant s'applique, jusqu'à 15 minutes. Les essais envoyés en parallèle comptent aussi.
- Désactiver le TOTP ferme les autres sessions du compte.
- Réponses marquées pour n'être jamais affichées dans un cadre (`frame-ancestors 'none'`, `X-Frame-Options`), sans détection du type de contenu (`nosniff`), avec `Referrer-Policy: same-origin`.
- L'historique d'une carte ne conserve jamais le texte des commentaires : un commentaire supprimé ne laisse aucun contenu.

Limites assumées :

- Le blocage vaut aussi par nom d'utilisateur : n'importe qui peut retarder la connexion d'un compte connu, jusqu'à 15 minutes à la fois. C'est le prix d'une protection contre les essais venant de nombreuses adresses.
- Le hachage des mots de passe (Argon2id) se fait dans le processus principal : pendant une connexion, les autres requêtes attendent quelques centaines de millisecondes, davantage sur un Raspberry Pi.
- La documentation de l'API (`/api/v1/docs`) est publique. Elle ne décrit que le code, déjà public.

## Versions prises en charge

Les correctifs sont apportés à la dernière version publiée.
