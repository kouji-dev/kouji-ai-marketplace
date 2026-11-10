---
name: import-design
description: Bring a design that exists elsewhere — a Claude Design canvas in another format, a claude.ai artifact, a Google Stitch or Figma export, an HTML mockup or a screenshot — into the project's design/ folder as an interactive app page, a components page and design-system components that run locally and on a canvas. Use when the person shares or points at a design to build from.
---

# Import a design into design/

`design/` is where every design ends up, whatever tool drew it. Importing is a rebuild into the structure from
`design-folder`, not a file copy. (A canvas that already follows that structure isn't imported: use
`canvas-sync`.)

## 1. Get the source

- **A Claude Design canvas or claude.ai artifact:** read it with the artifact tools (a canvas's
  `project/canvas.json` and its `.dc.html` artboards; an artifact's HTML). Never edit the source while importing.
- **Google Stitch, Figma, other tools:** use the exported HTML/CSS when there is one, otherwise the screenshots or
  frames the person shares. Ask for the export before working from pixels.
- List what the source has: screens and states (→ sections), repeated UI (→ components), colours, type and
  spacing (→ tokens), behaviour (→ state). Keep the list: step 4 checks every item made it.

## 2. Map it

| Source | Becomes |
| :- | :- |
| A product or a group of screens | an app: `design/<app>/<app>.dc.html` + `<app>-components.dc.html` |
| One screen, artboard or state | a `<section id>` inside `<app>.dc.html`, reachable by `#id` |
| A components or style-guide board | sections of `<app>-components.dc.html` |
| A repeated element (button, card, row, nav) | a `ds-<name>` block in `design-system/components/bundle.js` + its card |
| Colours, fonts, radii, spacing, shadows | `design-system/tokens.json` (lists); what it can't hold → `bundle.css` |
| Interactions, toggles, filled-in data | signals in `shared/store.js`, read by components |
| A canvas `{{hole}}`, `<sc-if>`, `<sc-for>` or `renderVals()` logic | a component rendering from attributes and state |
| Inline `<svg>` icons | kept inline in the component that uses them |
| Remote images and fonts | files: fonts in `design-system/fonts/`, images in the app folder; or Google Fonts |

## 3. Rebuild

- Scaffold with `new-design-app` if `design/<app>/` doesn't exist yet.
- Tokens first, then components from the smallest up, then the components page, then the app's screens. Follow
  `web-components` and `pages-and-state` exactly: the source's framework, runtime or template syntax doesn't
  come along.
- Keep the source's look: same layout, copy, spacing and colours. Where it uses a font or asset you can't load,
  say so and use the nearest token.
- Use the `frontend-design` skill when the source is rough and the person wants it refined, not only ported.
- Run `ds-install.mjs`, then `canvas-index.mjs`.

## 4. Check it

- Serve `design/` and open both pages in Chrome or Edge. Put each screen next to the source and fix differences
  in layout, spacing and colour.
- Every item of step 1's list is reachable: each screen and state by its hash, each component on the components
  page.
- Console clean, every link and control works, state survives switching screens where the source implies it.
- Run `design:accessibility-review` on the result and fix what it finds.
- Tell the person what was created, and anything from the source that couldn't be reproduced. Offer
  `canvas-sync` if they want it on a canvas.
