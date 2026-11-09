# frontend/CLAUDE.md

Next.js en `output: export`, React, TypeScript, Tailwind, TanStack Query. Copie indépendante du front de Hivora Panel.

## Règles
- Aucune chaîne en dur : clés de traduction FR et EN.
- Couleurs uniquement par tokens (`docs/design-system.md`).
- Parcours : `docs/product-principles.md`. Tout doit fonctionner au clavier.
- Types de l'API générés (`make gen`), jamais écrits à la main.
- Bundle initial < 520 Ko gzip par page ; modules lourds chargés à la demande.
- Exemples professionnels, jamais de référence aux jeux.

## À réutiliser avant de créer
- `components/ui/*` : alert, badge, button, card, dialog, dropdown-menu, input, sheet, skeleton, table.
- `components/` : app-shell (`PageHeader`, `useSession`), brand, code-view, copy, entering-screen, grid-background, providers, shelf-cat.
- `features/account/` : password-form, totp-card. `features/projects/` : `ProjectScreen`, onglets. `features/board/` : tableau.
- Une page de projet est un onglet : `app/(panel)/project/<onglet>/`, déclaré dans `project-nav.tsx`.
- `lib/` : `api/client.ts`, `i18n`, `prefs.ts`, `utils.ts`.

## Copie depuis le panel (lecture seule)
À chaque lot, ne copier que ce qui sert, par shell, jamais lire puis réécrire : `markdown`, `status-badge`, `collapsible-card` restent à reprendre. Exclure CodeMirror, xterm, React Flow, `html-to-image` et tout ce qui concerne Docker, le terminal ou la topologie. `lib/realtime.tsx` et la palette de commandes attendent une version ultérieure.

`make` construit dans `~/.cache/hivora-project`, hors du partage.
