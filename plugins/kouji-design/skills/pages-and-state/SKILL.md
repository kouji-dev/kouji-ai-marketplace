---
name: pages-and-state
description: How pages, navigation and state work in design/ — index.dc.html plus <name>.page.dc.html artboards that run locally and on a Claude Design canvas, the optional overview page with screenshots (ask first), the design system's own documentation pages, and shared state with ds.provide/ds.use and persisted signals. Use when adding or changing a page, wiring navigation or state.
---

# Pages and state

## First, ask about the overview page

Before creating the pages of an app — a new app, or the first pages in an existing one that has no overview
yet — ask the person, and wait for the answer:

> Do you want an overview page for this app — `overview.page.dc.html`, listing every page as a card with a
> screenshot? It's separate from `index.dc.html`, which stays the app's home page. (On the canvas, the page picker
> already lists every artboard.)

- **Yes:** copy `${CLAUDE_PLUGIN_ROOT}/templates/overview/overview.page.dc.html` into `design/<app>/`, give it
  one card per page (title, file name, `screenshots/<name>.png`), then generate the screenshots (below). Every
  page added later gets a card and a fresh screenshot in the same change.
- **No:** don't create it, and don't ask again for that app unless the person brings it up.

## Extend a page, or add one

Before creating a page, list the app's pages (and the design system's, for a design-system element) and find the
one whose topic the request belongs to (`design-folder`, "Nothing twice"):

- **The topic has a page:** change that page. A new state, variant or alternative goes on it as a section, next to
  what is already there; it doesn't get a file of its own.
- **The topic is new** (a screen, a flow or an element no page shows yet): create
  `<name>.page.dc.html`, named after the topic, never after a version (`-v2`, `-new`, `-alt`).
- If the request would make two pages show the same thing, merge them into one and fix every link to the old one.

## A page

`design/<app>/index.dc.html` always exists: the app's entry page. Every other page is
`design/<app>/<name>.page.dc.html`. Each is a complete document that is also a canvas artboard:

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shop · Checkout</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../design-system/tokens.css">
<link rel="stylesheet" href="shared/tokens.css">
<link rel="stylesheet" href="../base.css">
<script src="../base.js"></script>
<script src="../design-system/components.js"></script>
<script src="shared/store.js"></script>
<script src="shared/components.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<main class="page stack">
<a href="index.dc.html">← Home</a>
<h1>Checkout</h1>
<shop-cart-summary></shop-cart-summary>
<ds-button>Pay</ds-button>
</main>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":900}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
```

- **The head, in this order:** `./support.js` exactly as written (the canvas swaps in its runtime; locally it's
  the stand-in in the folder), tokens, `../base.css`, then `../base.js` and the components. `../base.js` and
  `../base.css` are the same for every page in `design/`. Without a design system, drop the two
  `../design-system/` lines.
- **The body:** static markup inside `<x-dc>` — layout helpers from `base.css` (`.page`, `.stack`, `.row`),
  components, links. Page-only CSS goes in the `<helmet><style>`, using tokens only.
- **No `{{holes}}`, `<sc-if>`, `<sc-for>` or body `<script>`:** they don't run locally. Anything live — text from
  state, a counter, a list — is a component.
- **The `text/x-dc` script stays** as above: the canvas needs it. `$preview` is the artboard's size; its
  `height` is the page's height at that width.
- **Navigation is a plain link** to the file: `<a href="checkout.page.dc.html">`. Locally it opens the page; on
  the canvas it moves Play to that artboard.
- After adding, renaming or removing a page, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design` to
  update `design/canvas.json`.

## State

- **Shared state lives in `shared/store.js`,** provided by name:

```js
(self.DS = self.DS || []).push(function (ds) {
  const cart = ds.persisted('shop:cart', []);
  ds.provide('app', {
    user: ds.persisted('shop:user', { name: 'Ada' }),
    cart,
    total: ds.computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0)),
    filter: ds.signal('all'),                      // resets on each page load
  });
});
```

- **Components read it with `ds.use('app')`** inside `render()`. It's reactive: a component that rendered before
  the store loaded renders again when it arrives.
- **`ds.persisted(key, initial)`** keeps a value in `sessionStorage`: the next page sees it, and on the canvas,
  where every artboard stays loaded, the other artboards update live. Prefix keys with the app name
  (`shop:cart`) so two apps don't share them.
- Update by assigning a new value (`app.cart.value = [...app.cart.value, item]`), never by mutating in place.
- Component-only state is a signal inside the component file, created once in the queue callback.
- Demo data is the store's initial values, or a flat `shared/data.js` when it is large. No network calls.

## Screenshots

`${CLAUDE_PLUGIN_ROOT}/scripts/screenshots.mjs` serves `design/`, opens `index.dc.html` and every `*.page.dc.html`
of one folder (skipping the overview) and writes `<folder>/screenshots/<name>.png`:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/screenshots.mjs design <app>
```

It needs Playwright in the project (`npm i -D playwright && npx playwright install chromium`); if it isn't
installed, ask before installing it. It exits with an error when a page throws — fix the page, then rerun.

## Design-system pages

`design/design-system/` follows the same page rules, as documentation:

- `index.dc.html` lists every element page as a card, grouped: **Foundations** (colors, typography, spacing,
  code…) then **Components** (one page per `ds-` component).
- Each `<element>.page.dc.html` is short: a one-line purpose, the element shown live in each variant and state,
  and the tokens or attributes behind it. Live values (like token colours) come from documentation components
  such as `<ds-swatch>`, so pages stay static markup.
- These pages also link `docs.css`, which only the design system's own pages use.
