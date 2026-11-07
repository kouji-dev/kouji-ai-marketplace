---
name: import-design
description: Bring a design that exists elsewhere — a Claude Design canvas in another format, a claude.ai artifact, a Google Stitch or Figma export, an HTML mockup or a screenshot — into the project's design/<app>/ folder as .dc.html pages and web components that run locally and on a canvas. Use when the person shares or points at a design to build from.
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
- Note what the source has: screens (→ pages), repeated UI (→ components), colours, type and spacing (→ tokens),
  behaviour (→ state).

## 2. Map it

| Source | Becomes |
| :- | :- |
| A canvas page, or a group of screens | an app folder `design/<app>/` |
| One screen or artboard | `design/<app>/<screen-name>.page.dc.html` (the main one is `index.dc.html`) |
| A repeated element (button, card, row, nav) | a component: `shared/components/<name>.js` + `.css` |
| A generic element shared with another app | `design/design-system/components/<name>.*` as `ds-<name>` |
| Colours, fonts, radii, spacing, shadows | custom properties in `tokens.css` (design-system or app level) |
| Interactions, toggles, filled-in data | signals in `shared/store.js`, read by components |
| A canvas `{{hole}}`, `<sc-if>`, `<sc-for>` or `renderVals()` logic | a component rendering from attributes and state |
| Inline `<svg>` icons | kept inline in the component that uses them |
| Remote images and fonts | files in the app folder (`shared/` or `screenshots/`), or Google Fonts |

Map onto what `design/` already has, not beside it (`design-folder`, "Nothing twice"): a screen whose topic
already has a page is added to that page, an element an existing component covers uses that component, a colour
an existing token holds uses that token. Screens in the source that repeat each other become one page; repeated
blocks become one component.

## 3. Rebuild

- Scaffold with `new-design-app` if `design/<app>/` doesn't exist yet (it asks about the overview page).
- Build tokens first, then components from the smallest up, then pages. Follow `web-components` and
  `pages-and-state` exactly — the source's own framework, runtime or template syntax doesn't come along.
- Keep the source's look: same layout, copy, spacing and colours. Where the source uses a font or asset you can't
  load, say so and use the nearest token.
- Use the `frontend-design` skill when the source is rough and the person wants it refined, not only ported.
- Run `canvas-index.mjs` so `design/canvas.json` lists the new pages.

## 4. Check it

- Serve `design/` and open every imported page in Chrome or Edge. Put each next to the source and fix differences
  in layout, spacing and colour.
- Console clean, every link and control works, state survives navigation where the source implies it.
- Run `design:accessibility-review` on the result and fix what it finds.
- Tell the person which pages and components were created, and anything from the source that couldn't be
  reproduced. Offer `canvas-sync` if they want it on a canvas.
