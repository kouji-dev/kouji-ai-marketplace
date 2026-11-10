Starter is a quiet, dark-first interface: a near-black ground, one violet accent, system fonts.

## Content

- Sentence case everywhere: buttons, titles, menu items.
- Say what happens: "Save changes", not "Submit". Errors say what to do next.
- No emoji in the interface.

## Visual foundations

- Ground `bg`, raised surfaces `panel`, hover and selection `panel-2`, borders `line`.
- Text `ink` on every surface; `ink-2` for secondary text, `ink-3` for captions. Links and accent text `accent-ink`.
- One primary action per view, in `accent` with `on-accent` text. Everything else is `ghost`.
- `danger` only for errors and destructive actions, `ok` only for success, always with a word, never colour alone.
- Type: `title` for page titles, `body` for copy, `small` for captions, all in the `ui` family; code in `mono`.
- Spacing steps `sp-1` to `sp-8`; cards pad `sp-4`, pages `sp-8`. Radii: `r-md` for controls, `r-lg` for cards.
- Motion eases on `--ease` and stays under 200 ms; reduced motion turns it off.
- The focus ring is a solid 2 px `accent` outline, offset 2 px, on every control.

## Using it

- Every component is a custom element named `ds-…`, defined in `components/bundle.js`.
- Pages load `tokens.css`, `components/bundle.css`, then `components/bundle.js`.
- On a canvas, a component also mounts as `<x-import component-from-global-scope="Starter.Button">`: attributes
  become props, children stay children.
- Shared state comes from the app's `shared/store.js`, provided as `app`.
