# Design system

Même structure visuelle que Hivora Panel, avec son propre accent violet. Source des valeurs : `frontend/app/globals.css`, copié du panel au lot 1. Ce document fixe les règles, sans recopier les valeurs.

## Identité

- Thèmes clair et sombre. Clair : blanc cassé. Sombre : noir, surfaces en gris foncé, texte blanc adouci. Neutres sans aucune teinte.
- Accent violet vif (`--primary`), qui distingue Hivora Project de Hivora Panel.
- Mascotte : le chat. Tout logo, icône ou état vide l'utilise : chat noir, fond violet `#7c38ee`, yeux blancs. Jamais d'hexagone ni de lettre comme logo.

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
- Menus neutres, sans violet : un projet déplié forme un bloc surélevé. Ombres neutres et léger reflet sur les surfaces en relief.
- La grille de fond couvre l'écran, en fondu sous les en-têtes.
- Une seule courbe pour les ouvertures, `--ease-out`, courtes (160 à 320 ms). Ce qui se déplie passe par `Collapse`.
- Icônes : `lucide-react`.
- Tout élément cliquable affiche le curseur main et un focus visible.

## Spécifique à Hivora Project

Le Kanban réutilise `card`, `badge`, `button` et `dropdown-menu`. Un nouveau composant suit la règle Reuse First de `CLAUDE.md` et n'introduit aucun token sans raison.
