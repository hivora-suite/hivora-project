# Design system

Même DA que Hivora Panel. Source des valeurs : `frontend/app/globals.css`, copié du panel au lot 1. Ce document fixe les règles, sans recopier les valeurs.

## Identité

- Thèmes clair et sombre. Clair : pierre chaude, pas de blanc papier. Sombre : brun très foncé.
- Accent miel (`--primary`), référence à la ruche.
- Mascotte : le chat. Tout logo, icône ou état vide l'utilise : chat sombre `#2a211b`, miel `#df911a` et `#f3c560`. Jamais d'hexagone ni de lettre comme logo.

## Typographie

| Usage | Police |
|---|---|
| Interface | Outfit |
| Technique (identifiants, code) | JetBrains Mono |

## Tokens

| Famille | Tokens |
|---|---|
| Surfaces | `--background`, `--card`, `--muted`, `--sidebar`, `--field` |
| Texte | `--foreground`, `--muted-foreground` |
| Bordures | `--border`, `--input`, `--ring` |
| Action | `--primary`, `--primary-foreground`, `--destructive` |
| États | `--ok`, `--info`, `--warn`, `--danger`, `--idle` |
| Profondeur | `--shadow-color`, `--shadow-strong`, `--highlight` |
| Groupes de navigation | une teinte par groupe, jamais une couleur d'état |

## Règles

- Jamais de couleur en dur : uniquement des tokens. Le thème sombre ne redéfinit que des tokens.
- Contraste du texte d'au moins 4,5:1 (WCAG AA).
- Ombres chaudes et léger reflet sur les surfaces en relief.
- Une seule famille d'animations : `--ease-out`, et `--ease-spring` pour les apparitions.
- Icônes : `lucide-react`.
- Tout élément cliquable affiche le curseur main et un focus visible.

## Spécifique à Hivora Project

Le Kanban réutilise `card`, `badge`, `button` et `dropdown-menu`. Un nouveau composant suit la règle Reuse First de `CLAUDE.md` et n'introduit aucun token sans raison.
