---
name: web-components
description: How to write a component in a design/ app — one custom element per <name>.js with its <name>.css beside it, extending the shared Base class, rendering from attributes and signals. Use whenever creating or changing a component under design/.
---

# Writing a component

Read `design-folder` first if you haven't: it says where components live and how the levels work.

## The shape (copy it)

```js
// design/<app>/shared/components/price-tag.js — <shop-price-tag amount="12.5" currency="EUR" sale>
import { Base, html, define } from '../base.js';
import { cart } from '../store.js';                        // only if it reads app state
import sheet from './price-tag.css' with { type: 'css' };

class PriceTag extends Base {
  static styles = [sheet];
  static attributes = ['amount', 'currency', 'sale'];   // read with this.attr() / this.flag()

  render() {
    const amount = Number(this.attr('amount') ?? 0);
    const label = new Intl.NumberFormat(undefined, { style: 'currency', currency: this.attr('currency') ?? 'EUR' }).format(amount);
    return html`<span class="${this.flag('sale') ? 'sale' : ''}">${label}</span><slot name="note"></slot>`;
  }

  rendered() {                                          // runs after every render: wire events on the new nodes
    this.$('span').addEventListener('click', () => this.emit('price-click', { amount: this.attr('amount') }));
  }
}

define('shop-price-tag', PriceTag);
```

```css
/* design/<app>/shared/components/price-tag.css — scoped to the shadow root */
:host { display: inline-flex; align-items: baseline; gap: var(--sp-1); }
span { font: 600 15px/1 var(--font-ui); color: var(--ink); }
.sale { color: var(--danger); }
```

Then add one line to the level's `components.js`: `import './components/price-tag.js';`.

## What Base gives you

- `static styles` — CSSStyleSheets adopted by the shadow root. Always the component's own `.css`, imported as a
  CSS module script. A shared sheet (e.g. a focus ring) can be added from `shared/`, flat, as `focus.css`.
- `static attributes` — observed attributes. `this.attr(name)` returns the value (or `null`), `this.flag(name)`
  is true when a boolean attribute is present. Reading them inside `render()` re-renders on change.
- `render()` returns `html```. Interpolated values are escaped; arrays are joined; nested `html``` and
  `raw(markup)` pass through. Signals read in `render()` (`cart.value`) also trigger a re-render.
- `rendered()` — called after each render. Markup is rebuilt each time, so attach listeners here.
- `this.emit(type, detail)` — a `CustomEvent` that bubbles and crosses the shadow boundary.
- `this.$(selector)` — query inside the shadow root.

## Rules

- **One element per file, flat.** `components/<name>.js` + `components/<name>.css`, nothing else, no sub-folders.
- **Tag = prefix + file name.** `ds-` in `design/design-system/`, the app prefix in an app. A tag is defined
  only through `define()`.
- **Styles only from tokens.** Colours, radii, spacing and fonts come from `var(--…)` in `tokens.css`. No hex
  values in a component's CSS except in `tokens.css`. Style the host with `:host`, states with `:host([attr])`.
- **Inputs are attributes, outputs are events.** Data in through attributes (strings) or a store signal; never
  reach into another component's shadow root. Let the page listen to events.
- **Children through `<slot>`.** Named slots for regions (`<slot name="icon">`); expose stylable parts with
  `part="…"` when a page must restyle them.
- **Accessible by default.** A real `<button>`/`<a>`/`<input>` inside, a visible `:focus-visible` ring,
  `aria-*` where the role isn't native, text alternatives for icons. Check with `design:accessibility-review`.
- **Re-render cost is fine for prototypes.** `render()` rebuilds the shadow DOM; keep focusable inputs updating on
  `change`, not `input`, so typing isn't interrupted.
- **Generic components belong in the design system.** If a second app needs it, move it to
  `design/design-system/components/` and rename the tag to `ds-…`.
