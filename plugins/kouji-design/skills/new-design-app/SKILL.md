---
name: new-design-app
description: Scaffold a new app in the project's design/ folder from the kouji-design template — standalone, or on top of a shared design/design-system/ — and create the design system itself when several apps should share one. Use when starting the first design in a project or adding another app.
---

# Start a design app

The templates ship with this plugin:

- `${CLAUDE_PLUGIN_ROOT}/templates/app/` — a working standalone app: `index.html`, `profile.page.html`, and
  `shared/` with `deps.js`, `base.js`, `store.js`, `tokens.css`, `base.css`, `components.js` and two reference
  components (`button`, `user-card`).
- `${CLAUDE_PLUGIN_ROOT}/templates/design-system/` — the shared level: `deps.js`, `base.js`, tokens, base styles
  and `components/button.*` defining `<ds-button>`.

## Steps

1. **Decide the names** with the person if they haven't said: the app folder (kebab-case, e.g. `shop`) and its tag
   prefix (short, e.g. `shop`). Check `design/` for existing apps and for `design/design-system/`.
2. **Copy the app template** to `design/<app>/`. Replace the `app-` tag prefix with `<prefix>-` in every file
   (`define('app-…'`, `<app-…>` in pages and CSS comments), and `App ·` in page titles with the app's name.
3. **If `design/design-system/` exists** (or the person wants one — copy
   `${CLAUDE_PLUGIN_ROOT}/templates/design-system/` to `design/design-system/` first):
   - Replace `design/<app>/shared/deps.js` and `shared/base.js` with one-line re-exports:
     `export * from '../../design-system/deps.js';` and `export * from '../../design-system/base.js';`
   - Delete the app's `shared/base.css` and its `components/button.*`; use `<ds-button>` instead.
   - Make `shared/tokens.css` hold only overrides, and link `../design-system/tokens.css` and
     `../design-system/base.css` before it in every page head.
   - Start `shared/components.js` with `import '../../design-system/components.js';`.
4. **Keep or replace the examples.** `profile.page.html` and `user-card` show cross-page state; delete them once
   the app has real pages, and remove their links from `index.html`.
5. **Run it:** serve `design/` (`npx serve design` or `python3 -m http.server -d design`), open
   `/<app>/index.html` in Chrome or Edge, check the console is clean, click through every page.

## When a second app arrives

If the existing app has no design system and the new one should share its look: create
`design/design-system/` from the template, move the generic components (button, input, card…) and tokens of the
first app into it (renaming tags to `ds-…` and updating every page), then switch both apps to the re-exports in
step 3. Don't fork the first app's components.
