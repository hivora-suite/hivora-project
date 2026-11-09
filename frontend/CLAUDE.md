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
- `components/` : app-shell, brand, shelf-cat, grid-background, entering-screen, providers, copy, markdown, status-badge, collapsible-card, totp-form.
- `lib/` : `api/client.ts`, `i18n`, `prefs.ts`, `utils.ts`.

## Copie depuis le panel (lot 1)
Copier par shell, jamais lire puis réécrire. Exclure CodeMirror, xterm, React Flow, `html-to-image` et tout ce qui concerne Docker, le terminal ou la topologie. Repartir de fichiers de traduction vides. `lib/realtime.tsx` et la palette de commandes attendent une version ultérieure.
