---
name: pages-and-state
description: How pages, screens, navigation and state work in design/ — each app is two artboards, <app>.dc.html (the interactive app, every screen a hash-addressed section) and <app>-components.dc.html (every component, a left index), running locally and on a Claude Design canvas, with shared state through ds.provide/ds.use and persisted signals. Use when adding or changing a page or screen, wiring navigation or state.
---

# Pages and state

## The two artboards of an app

| File | What it is |
| :- | :- |
| `design/<app>/<app>.dc.html` | The app, interactive: every screen and state is a `<section>` inside it |
| `design/<app>/<app>-components.dc.html` | Every component and foundation the app uses, one section per topic, a left index |

That's all an app has (the condensed-pages rule in `design-folder`): one components page, one interactive app.
A new screen is a new section, never a new file. A state (empty, loading, error, a dialog open, narrow) that the
demo data can't reach by clicking gets its own section too, so every state is one link away. A new topic of
components is a new section of the components page, never a new page.

## A page

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shop</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="../ds/shop/tokens.css">
<link rel="stylesheet" href="../ds/shop/components/bundle.css">
<script src="../ds/shop/components/bundle.js"></script>
<script src="shared/store.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<nav class="row" aria-label="Main">
<a href="#catalog">Catalog</a>
<a href="#checkout">Checkout</a>
</nav>
<ds-screens>
<section id="catalog" data-title="Catalog" class="page stack">
<h1 class="title">Catalog</h1>
<ds-product-grid></ds-product-grid>
</section>
<section id="checkout" data-title="Checkout" class="page stack">
<h1 class="title">Checkout</h1>
<ds-cart-summary></ds-cart-summary>
<ds-button>Pay</ds-button>
</section>
<section id="checkout-error" data-title="Checkout · card declined" class="page stack">…</section>
</ds-screens>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":800}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
```

- **The head, in this order:** `./support.js` exactly as written (the canvas swaps in its runtime there), the
  design system's `tokens.css` and `components/bundle.css`, its `components/bundle.js`, then `shared/store.js`.
- **The body:** static markup inside `<x-dc>`: layout helpers from `bundle.css` (`.page`, `.stack`, `.row`), type
  classes from `tokens.css` (`.title`, `.body`…), components, links. Page-only CSS in `<helmet><style>`, from
  tokens only.
- **`<ds-screens>`** shows one `<section id>` at a time, picked by the URL hash. With `index=""` it lists every
  section on the left and scrolls the shown one: the components page. Without it, the page's own links switch
  screens: the app.
- **No `{{holes}}`, `<sc-if>`, `<sc-for>` or body `<script>`:** they don't run locally. Anything live is a component.
- **The `text/x-dc` script stays** as above: the canvas needs it. `$preview` is the artboard's size: one screen,
  at most 8000 px a side.
- **Links:** `#section` inside the page; `<app>-components.dc.html` to the other artboard (on the canvas, Play
  moves to it). Never link to another app's page except through its file.
- After adding, renaming or removing a page, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design`.

## The components page

- One page for all of the app's components. One `<section id data-title>` per topic (foundations, actions,
  forms, navigation, feedback…), in that order, inside `<ds-screens index="">`: the index on the left, the shown
  topic scrolling on the right. Not one page per spec or area.
- A topic with many interactive examples (a list in every state, a terminal in every mode) stays one section:
  its examples one under the other, or behind tabs inside the section.
- **Foundations first:** the app's colours as swatches (`style="background: var(--accent)"`), its type styles,
  spacing and radii, read from tokens.
- Each component in every variant and state the app uses, with its tag under it. Design-system cards document a
  component on its own; this page shows what this app uses, together.

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
- **`ds.persisted(key, initial)`** keeps a value in `sessionStorage`: the other artboard sees it, and on the
  canvas, where every artboard stays loaded, it updates live. Prefix keys with the app name (`shop:cart`).
- Update by assigning a new value (`app.cart.value = [...app.cart.value, item]`), never by mutating in place.
- Component-only state is a signal inside the component's block in the bundle.
- Demo data is the store's initial values, or a flat `shared/data.js` when it is large. No network calls.

## Limits

- A section hidden by `<ds-screens>` is still in the file: on the canvas, it shows when its hash is picked in
  Play, and is edited there.
- The hash is per artboard: on the canvas, a link to `other.dc.html#section` opens the artboard, and whether it
  honours the hash depends on the canvas's Play.
- `sessionStorage` is per tab: two browser tabs locally don't share state.
