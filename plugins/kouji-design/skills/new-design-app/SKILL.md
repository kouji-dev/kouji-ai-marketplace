---
name: new-design-app
description: Scaffold a new app in the project's design/ folder from the kouji-design template — standalone, or on top of a shared design/design-system/ — and create the design system itself (with its documentation pages) when several apps should share one. Use when starting the first design in a project or adding another app.
---

# Start a design app

The templates ship with this plugin:

The templates folder is itself a `design/` folder, so the copies land at the same paths:

- `${CLAUDE_PLUGIN_ROOT}/templates/base.js` and `base.css` — the kit and the base styles, shared by every page.
  They go to `design/base.js` and `design/base.css` once per project.
- `${CLAUDE_PLUGIN_ROOT}/templates/app/` — a working standalone app: `index.dc.html`, `profile.page.dc.html`,
  `support.js`, and `shared/` with `tokens.css`, `store.js`, `components.js` and three reference components
  (`button`, `user-card`, `greeting`).
- `${CLAUDE_PLUGIN_ROOT}/templates/design-system/` — the shared level: tokens, `docs.css`,
  `components/` (`button` as `<ds-button>`, plus `swatch` and `theme-toggle` for its own pages), and its pages:
  `index.dc.html` listing `colors`, `typography`, `code` and `buttons`.
- `${CLAUDE_PLUGIN_ROOT}/templates/overview/overview.page.dc.html` — the optional page listing every page of an
  app with screenshots.

## Steps

1. **Decide the names** with the person if they haven't said: the app folder (kebab-case, e.g. `shop`) and its tag
   prefix (short, e.g. `shop`). Check `design/` for existing apps and for `design/design-system/`.
   If an existing app already covers what the person describes, add pages to it instead of starting a new app
   (`design-folder`, "Nothing twice").
   **In the same question, ask whether they want an overview page** (see `pages-and-state`) and wait for the
   answer before creating any page.
2. **Copy the runtime once:** if `design/base.js` or `design/base.css` doesn't exist yet, copy it from the
   templates. Never put a copy inside a folder.
3. **Copy the app template** to `design/<app>/`. Then, in every file:
   - tags `app-…` → `<prefix>-…` (`ds.define('app-…'`, `<app-…>` in pages, the prefix comment in `components.js`);
   - storage keys `'app:…'` → `'<app>:…'` in `shared/store.js`;
   - `App ·` → the app's name in page titles.
4. **If `design/design-system/` exists** (or the person wants one — copy
   `${CLAUDE_PLUGIN_ROOT}/templates/design-system/` to `design/design-system/` first):
   - delete the app's `shared/components/button.*` and its line in `shared/components.js`; use `<ds-button>` in
     the pages;
   - reduce `shared/tokens.css` to the app's overrides only;
   - in every page head, add `../design-system/tokens.css` before `shared/tokens.css`, and
     `../design-system/components.js` after `../base.js`.
   - Keep the design system's pages in step: a new `ds-` component or token family gets its
     `<element>.page.dc.html` and a card in `design/design-system/index.dc.html`.
5. **Keep or replace the examples.** `profile.page.dc.html`, `user-card` and `greeting` show state shared across
   pages; delete them once the app has real pages, and remove their links and `components.js` lines.
6. **Overview, if they said yes:** copy the overview template into `design/<app>/`, one card per page, then run
   the screenshot script (see `pages-and-state`). Give its head the same lines as the app's other pages.
7. **Index the canvas:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design --title "<Project> design"`
   creates or updates `design/canvas.json` (one canvas page per folder, one artboard per page).
8. **Run it:** serve `design/` (`npx serve design` or `python3 -m http.server -d design`), open
   `/<app>/index.dc.html` in Chrome or Edge, check the console is clean, click through every page.
9. **Offer the canvas:** if the person wants it on a Claude Design canvas too, continue with `canvas-sync`.

## When a second app arrives

If the existing app has no design system and the new one should share its look: create
`design/design-system/` from the template, move the generic components (button, input, card…) and tokens of the
first app into it (renaming tags to `ds-…`, CSS paths to `../design-system/components/…`, and updating every
page), then switch both apps to step 4. Don't fork the first app's components.
