---
name: web-components
description: How to write a component in design/ — a ds-<name> custom element in the design system's one bundle.js, its shadow CSS beside its class, rendering from attributes and signals, plus its card (README and preview) — so it runs locally and on a Claude Design canvas. Use whenever creating or changing a component under design/.
---

# Writing a component

Read `design-folder` first: every component lives in `design/design-system/components/bundle.js`.

## The shape (copy it)

Add a block to `bundle.js`, after the other components:

```js
// <ds-price-tag amount="12.5" currency="EUR" sale=""> — a price, struck through on sale.
(self.DS = self.DS || []).push(function (ds) {
  class PriceTag extends ds.Base {
    static styles = [ds.css`
      :host { display: inline-flex; align-items: baseline; gap: var(--sp-1); }
      span { font: 600 15px/1 var(--font-ui); color: var(--ink); }
      .sale { color: var(--danger); }
    `];
    static attributes = ['amount', 'currency', 'sale'];           // read with this.attr() / this.flag()

    render() {
      const amount = Number(this.attr('amount') ?? 0);
      const label = new Intl.NumberFormat(undefined, { style: 'currency', currency: this.attr('currency') ?? 'EUR' }).format(amount);
      return ds.html`<span class="${this.flag('sale') ? 'sale' : ''}">${label}</span><slot name="note"></slot>`;
    }

    rendered() {                                   // after every render: wire events on the new nodes
      this.$('span').addEventListener('click', () => this.emit('price-click', { amount: this.attr('amount') }));
    }
  }
  ds.define('ds-price-tag', PriceTag);
});
```

Then:

1. Its card: `components/PriceTag/README.md` (first sentence = what it is; then attributes, content, do and
   don't) and `components/PriceTag/preview.html` (line 1 `<!-- @dsCard group="Commerce" height=88 -->`, then one
   root element showing its states, then one `<script>`, empty or providing demo state).
2. Show it on the components page of every app that uses it (`<app>-components.dc.html`).
3. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/ds-install.mjs design` so pages and the canvas copy get the new bundle.

## Why it looks like this

- **One bundle:** the canvas installs a design system as one script and one stylesheet, and every file counts
  against its 512. No file per component, no build step.
- **CSS beside the class:** a shadow root doesn't see the page's CSS, so a component's styles are its own
  `ds.css\`…\`` sheet, made once and shared by every instance. Tokens (custom properties) still reach inside, so
  the canvas's Theme menu restyles it. Page-level CSS (reset, `.page`, `.stack`, `.row`) goes in `bundle.css`.
- **`(self.DS = self.DS || []).push(…)`** — the kit at the top of the bundle runs each block; an app's
  `shared/store.js`, loaded in any order on the canvas, uses the same queue.
- **`ds.define` also exposes it** as `window.<Namespace>.<PascalName>`, a React component, so a canvas page can
  place it with `<x-import component-from-global-scope="Shop.PriceTag" amount="12.5">`.

## What ds.Base gives you

- `static styles` — sheets adopted by the shadow root: the component's own `ds.css\`…\``.
- `static attributes` — observed attributes. `this.attr(name)` returns the value (or `null`), `this.flag(name)`
  is true when a boolean attribute is present. Reading them in `render()` re-renders on change.
- `render()` returns `` ds.html`…` ``. Values are escaped; arrays are joined; nested `ds.html` and `ds.raw(markup)`
  pass through. Signals and `ds.use(name)` read in `render()` also trigger a re-render.
- `rendered()` — after each render. The markup is rebuilt each time, so attach listeners here.
- `this.emit(type, detail)` — a `CustomEvent` that bubbles out of the shadow root.
- `this.$(selector)` — query inside the shadow root.

## Rules

- **Tag = `ds-` + name**, defined only through `ds.define()`; its card folder is the name in PascalCase.
- **Styles only from tokens:** colours, radii, spacing and fonts come from `var(--…)`, names that exist in
  `tokens.json`. No raw colour values. Style the host with `:host`, states with `:host([attr])`.
- **No literal `</script` or `<!--`** anywhere in the bundle: the canvas inlines it. Write `<\/script`.
- **Inputs are attributes, outputs are events;** shared data comes from the store with `ds.use('app')`. Never reach
  into another component's shadow root.
- **Read state defensively:** the store may load after the bundle on the canvas. `const app = ds.use('app');
  if (!app) return ds.html``;` — the component re-renders when it arrives.
- **Children through `<slot>`;** expose stylable parts with `part="…"`. A component that only arranges page
  markup (like `<ds-screens>`) leaves that markup in the light DOM, so the canvas can still edit it.
- **Accessible by default:** a real `<button>`/`<a>`/`<input>` inside, a visible `:focus-visible` ring, `aria-*`
  where the role isn't native, text alternatives for icons. Check with `design:accessibility-review`.
- **Inputs update on `change`, not `input`:** `render()` rebuilds the shadow DOM, which would interrupt typing.

## Limits

- What a component draws can't be selected or edited on the canvas: keep components small and leave screens and
  copy in the page.
- `render()` replaces the whole shadow DOM: focus and scroll inside it reset on every render.
- One big file: find a component by searching for its tag (`'ds-price-tag'`).
