---
name: web-components
description: How to write a component in design/ — one custom element per <name>.js (a classic script on the kit's queue) with its <name>.css beside it, rendering from attributes and signals, so it runs locally and on a Claude Design canvas. Use whenever creating or changing a component under design/.
---

# Writing a component

Read `design-folder` first: it says where components live and why they are classic scripts.

## The shape (copy it)

```js
// design/shop/shared/components/price-tag.js — <shop-price-tag amount="12.5" currency="EUR" sale="">
(self.KOUJI = self.KOUJI || []).push(function (K) {
  class PriceTag extends K.Base {
    static styles = [K.css('shared/components/price-tag.css')];   // relative to the PAGE
    static attributes = ['amount', 'currency', 'sale'];           // read with this.attr() / this.flag()

    render() {
      const amount = Number(this.attr('amount') ?? 0);
      const label = new Intl.NumberFormat(undefined, { style: 'currency', currency: this.attr('currency') ?? 'EUR' }).format(amount);
      return K.html`<span class="${this.flag('sale') ? 'sale' : ''}">${label}</span><slot name="note"></slot>`;
    }

    rendered() {                                   // after every render: wire events on the new nodes
      this.$('span').addEventListener('click', () => this.emit('price-click', { amount: this.attr('amount') }));
    }
  }
  K.define('shop-price-tag', PriceTag);
});
```

```css
/* design/shop/shared/components/price-tag.css — scoped to the shadow root */
:host { display: inline-flex; align-items: baseline; gap: var(--sp-1); }
span { font: 600 15px/1 var(--font-ui); color: var(--ink); }
.sale { color: var(--danger); }
```

Then add its path to the level's `components.js`:

```js
(self.KOUJI = self.KOUJI || []).push(function (K) {
  K.load(['shared/components/price-tag.js', /* … */]);
});
```

A design-system component is the same, with `ds-` and paths that start `../design-system/`:
`K.css('../design-system/components/button.css')`, listed in `design/design-system/components.js`.

## Why it looks like this

- **`(self.KOUJI = self.KOUJI || []).push(…)`** — on the canvas, scripts run in any order. Every file queues its
  code; `base.js` runs the queue once it has loaded. Never touch `K` outside the queue.
- **Classic script, no `import`** — the canvas can't resolve ES module imports or CSS module scripts.
  `K.load` fetches each listed file and runs it.
- **`K.css(path)`** — returns a stylesheet at once and fills it when the file arrives; one fetch per path, shared
  by every instance.
- **Paths relative to the page** — every page is one level under `design/`, so `shared/…` (the page's app) and
  `../design-system/…` work from every page, locally and on the canvas.

## What K.Base gives you

- `static styles` — stylesheets adopted by the shadow root: the component's own `.css`, plus a shared flat sheet
  from `shared/` if needed.
- `static attributes` — observed attributes. `this.attr(name)` returns the value (or `null`), `this.flag(name)`
  is true when a boolean attribute is present. Reading them in `render()` re-renders on change.
- `render()` returns `` K.html`…` ``. Values are escaped; arrays are joined; nested `K.html` and `K.raw(markup)`
  pass through. Signals and `K.use(name)` read in `render()` also trigger a re-render.
- `rendered()` — after each render. The markup is rebuilt each time, so attach listeners here.
- `this.emit(type, detail)` — a `CustomEvent` that bubbles out of the shadow root.
- `this.$(selector)` — query inside the shadow root.

## Rules

- **One element per file, flat:** `components/<name>.js` + `components/<name>.css`, no sub-folders.
- **Tag = prefix + file name**, defined only through `K.define()`.
- **Styles only from tokens:** colours, radii, spacing and fonts come from `var(--…)`. No raw colour values in a
  component's CSS. Style the host with `:host`, states with `:host([attr])`.
- **Inputs are attributes, outputs are events;** shared data comes from the store with `K.use('app')`. Never reach
  into another component's shadow root.
- **Read state defensively:** the store may load after the component on the canvas. `const app = K.use('app');
  if (!app) return K.html``;` — the component re-renders when it arrives.
- **Children through `<slot>`;** expose stylable parts with `part="…"`.
- **Accessible by default:** a real `<button>`/`<a>`/`<input>` inside, a visible `:focus-visible` ring, `aria-*`
  where the role isn't native, text alternatives for icons. Check with `design:accessibility-review`.
- **Inputs update on `change`, not `input`:** `render()` rebuilds the shadow DOM, which would interrupt typing.
- **Generic components belong in the design system:** if a second app needs it, move it to
  `design/design-system/components/` and rename it `ds-…`.
