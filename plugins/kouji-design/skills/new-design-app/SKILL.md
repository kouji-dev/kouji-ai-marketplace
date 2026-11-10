---
name: new-design-app
description: Scaffold a new app in the project's design/ folder from the kouji-design template — its two artboards (the interactive app and its components page) on the project's one design system — and create that design system (tokens.json, README, one bundle.js and bundle.css, a card per component) when the project has none. Use when starting the first design in a project or adding another app.
---

# Start a design app

The templates ship with this plugin, laid out like a `design/` folder:

- `${CLAUDE_PLUGIN_ROOT}/templates/design-system/` — a design system named `Starter`: `design-system.json`,
  `README.md`, `tokens.json`, `components/bundle.js` (the kit plus `ds-button`, `ds-screens`, `ds-user-card`,
  `ds-greeting`), `components/bundle.css`, and a card per component (`components/<Comp>/README.md`, `preview.html`).
- `${CLAUDE_PLUGIN_ROOT}/templates/app/` — an app: `app.dc.html` (two screens, switched by hash),
  `app-components.dc.html` (foundations and components behind a left index), `support.js`, `shared/store.js`.

## Steps

1. **Decide the names** with the person if they haven't said: the app folder (kebab-case, e.g. `shop`) and, for a
   new design system, its name and namespace (a JS identifier, e.g. `Shop`). Check `design/` for existing apps
   and for `design/design-system/`.
2. **The design system, if the project has none:** copy `templates/design-system/` to `design/design-system/`.
   Then:
   - in `design-system.json`: `title` and `namespace` → the project's; `createdOnFiles.at` → now;
   - in `bundle.js`: `DS.expose('Starter')` → the namespace; `tokens.json` `name` → the title;
   - replace the tokens and the README with the brand's real ones when there are any (from code, a brand book,
     a design tool): `tokens.json` as lists, a usage note on every token. Nothing to build from: keep the
     starter's small set and say so.
   - Drop `ds-user-card` and `ds-greeting` (block in `bundle.js` and their card folders) once real components
     exist.
3. **Install it:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/ds-install.mjs design` writes `tokens.css` and copies
   the system to `design/ds/<namespace in lower case>/`.
4. **Copy the app template** to `design/<app>/` and rename `app.dc.html` → `<app>.dc.html`,
   `app-components.dc.html` → `<app>-components.dc.html`. Then, in every file:
   - `../ds/starter/` → `../ds/<folder>/`;
   - storage keys `'app:…'` → `'<app>:…'` in `shared/store.js`;
   - `App` → the app's name in titles; the components link → `<app>-components.dc.html`.
5. **Replace the example screens** with the app's real ones, each a `<section id>` (see `pages-and-state`), and
   the components page's sections with what the app uses.
6. **Index the canvas:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design --title "<Project> design"`
   creates or updates `design/canvas.json` and refuses what a canvas can't hold.
7. **Run it:** serve `design/` (`pnpm dlx serve design` or `python3 -m http.server -d design`), open
   `/<app>/<app>.dc.html` in Chrome or Edge, check the console is clean, click through every screen.
8. **Offer the canvas:** if the person wants it on a Claude Design canvas, continue with `canvas-sync`.

## When a second app arrives

It uses the same design system: new components go into `bundle.js`, the app gets its own two artboards. Never a
second design system or a copy of a component.
