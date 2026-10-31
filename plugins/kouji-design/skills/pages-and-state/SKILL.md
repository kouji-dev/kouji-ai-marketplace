---
name: pages-and-state
description: How pages, navigation and state work in design/ — index.html plus <name>.page.html files, the optional overview page with screenshots (ask first), the design system's own documentation pages, the signals store persisted across pages, and the one pinned CDN dependency. Use when adding or changing a page, wiring navigation or state, or touching deps.js.
---

# Pages and state

## First, ask about the overview page

Before creating the pages of an app — a new app, or the first pages in an existing one that has no overview
yet — ask the person, and wait for the answer:

> Do you want an overview page for this app — `overview.page.html`, listing every page as a card with a
> screenshot? It's separate from `index.html`, which stays the app's home page.

- **Yes:** copy `${CLAUDE_PLUGIN_ROOT}/templates/overview/overview.page.html` into `design/<app>/`, give it
  one card per page (title, file name, `screenshots/<name>.png`), then generate the screenshots (below). Every
  page added later gets a card and a fresh screenshot in the same change. Link it from `index.html` only if the
  person wants it reachable from the app itself.
- **No:** don't create it, and don't ask again for that app unless the person brings it up.

## Pages

- `design/<app>/index.html` always exists. It is the app's entry page — what the real app opens on — and links
  onwards the way the real app would.
- Every other page is `design/<app>/<name>.page.html` (kebab-case): `checkout.page.html`, `order-detail.page.html`.
- A page is a complete HTML document that opens on its own. Navigation is plain `<a href="checkout.page.html">`.
- Every page has the same head, in this order:

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shop · Checkout</title>
  <!-- with a design system: its tokens and base first, then the app's overrides -->
  <link rel="stylesheet" href="../design-system/tokens.css">
  <link rel="stylesheet" href="../design-system/base.css">
  <link rel="stylesheet" href="shared/tokens.css">
  <!-- without one: shared/tokens.css then shared/base.css -->
  <script type="module" src="shared/components.js"></script>
</head>
```

- Page markup uses components and the layout helpers from `base.css` (`.page`, `.stack`, `.row`); page-specific
  CSS goes in a `<style>` in the page head, using tokens only.
- Page logic is one `<script type="module">` at the end of `<body>`, importing from `./shared/…`.

## Screenshots

`${CLAUDE_PLUGIN_ROOT}/scripts/screenshots.mjs` serves `design/`, opens `index.html` and every `*.page.html` of one
folder (skipping the overview) and writes `<folder>/screenshots/<name>.png`:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/screenshots.mjs design <app>
node ${CLAUDE_PLUGIN_ROOT}/scripts/screenshots.mjs design design-system
```

It needs Playwright in the project (`npm i -D playwright && npx playwright install chromium`); if it isn't
installed, ask before installing it. It exits with an error when a page throws — fix the page, then rerun.

## Design-system pages

`design/design-system/` follows the same page rules, as documentation:

- `index.html` lists every element page as a card, grouped: **Foundations** (colors, typography, spacing, code,
  icons…) then **Components** (one page per `ds-` component).
- Each `<element>.page.html` is short: a one-line purpose, the element shown live in each variant and state, and a
  table of the tokens or attributes behind it. Token values are read from the live CSS, not typed in, so the page
  can't drift from `tokens.css`.
- These pages also link `docs.css`, which only the design system's own pages use.

## State

- **Page-only state** lives in the page script: `const step = signal(1)`.
- **State shared by components or pages** lives in `shared/store.js`, one export per piece:

```js
import { signal, computed } from './deps.js';
export const cart = persisted('cart', []);                       // survives navigation (sessionStorage)
export const total = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0));
export const filter = signal('all');                             // resets on each page load
```

- Pages are separate documents, so a plain `signal` resets on navigation. Use `persisted(key, initial)` (in the
  template's `store.js`) for anything the next page must see: the signed-in user, the cart, a draft.
- Update by assigning a new value (`cart.value = [...cart.value, item]`), never by mutating in place —
  signals compare by identity.
- Read state in a component's `render()` and it re-renders by itself. Outside components, wrap DOM updates in
  `effect(() => …)`.
- Demo data for a design lives in `store.js` as the initial values, or in a flat `shared/data.js` when it is
  large. No network calls; a design never depends on a server.

## Dependencies

- `shared/deps.js` (or `design-system/deps.js`) is the only file that imports from a URL. It re-exports what the
  rest of the app uses:

```js
export { signal, computed, effect, batch, untracked } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.4/+esm';
```

- Pin an exact version, at least two weeks old. Upgrading is a one-line change here, then a check of every page.
- Don't add another library. If something seems to need one, write the small helper flat in `shared/` instead.
