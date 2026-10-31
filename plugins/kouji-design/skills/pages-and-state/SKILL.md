---
name: pages-and-state
description: How pages, navigation and state work in design/ — index.dc.html plus <name>.page.dc.html artboards that run locally and on a Claude Design canvas, the optional overview page with screenshots (ask first), the design system's own documentation pages, and shared state with K.provide/K.use and persisted signals. Use when adding or changing a page, wiring navigation or state.
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
<link rel="stylesheet" href="../design-system/base.css">
<link rel="stylesheet" href="shared/tokens.css">
<script src="../design-system/base.js"></script>
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
  the stand-in in the folder), stylesheets, then scripts. Without a design system, the app's own
  `shared/tokens.css`, `shared/base.css` and `shared/base.js` take the design system's lines.
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
(self.KOUJI = self.KOUJI || []).push(function (K) {
  const cart = K.persisted('shop:cart', []);
  K.provide('app', {
    user: K.persisted('shop:user', { name: 'Ada' }),
    cart,
    total: K.computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0)),
    filter: K.signal('all'),                      // resets on each page load
  });
});
```

- **Components read it with `K.use('app')`** inside `render()`. It's reactive: a component that rendered before
  the store loaded renders again when it arrives.
- **`K.persisted(key, initial)`** keeps a value in `sessionStorage`: the next page sees it, and on the canvas,
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
