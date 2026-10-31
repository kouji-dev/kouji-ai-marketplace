---
name: import-design
description: Bring a design that exists elsewhere — a Claude Design canvas artboard, a claude.ai artifact, a Google Stitch or Figma export, an HTML mockup or a screenshot — into the project's design/<app>/ folder as native pages and web components. Use when the person shares or points at a design to build locally, or asks to sync a canvas design into the repo.
---

# Import a design into design/

The local `design/` folder is where the design ends up, whatever tool drew it. Importing is a rebuild into the
structure from `design-folder`, not a file copy.

## 1. Get the source

- **Claude Design canvas / claude.ai artifact:** read it with the Artifact tools (the canvas's `project/*.dc.html`
  files, or the artifact's HTML). Never edit the source while importing.
- **Google Stitch, Figma, other tools:** use the exported HTML/CSS when there is one, otherwise the screenshots or
  frames the person shares. Ask for the export before working from pixels.
- Note what the source has: screens (→ pages), repeated UI (→ components), colours, type and spacing (→ tokens),
  and behaviour (→ state).

## 2. Map it

| Source | Becomes |
| :- | :- |
| One screen or artboard | `design/<app>/<screen-name>.page.html` (the first or main one is `index.html`) |
| A repeated element (button, card, row, nav) | a component: `shared/components/<name>.js` + `.css` |
| A generic element shared with another app | `design/design-system/components/<name>.*` as `ds-<name>` |
| Colours, fonts, radii, spacing, shadows | custom properties in `tokens.css` (design-system or app level) |
| Interactions, toggles, filled-in data | signals in `shared/store.js`, demo data as their initial values |
| A canvas `.dc.html` template hole `{{x}}` or `renderVals()` logic | attributes, signals and page scripts |
| Inline `<svg>` icons | kept inline in the component that uses them |

## 3. Rebuild

- Scaffold with `new-design-app` if `design/<app>/` doesn't exist yet.
- Build tokens first, then components from the smallest up, then pages. Follow `web-components` and
  `pages-and-state` exactly — the source's own framework, runtime or template syntax doesn't come along.
- Keep the source's look: same layout, copy, spacing and colours. Where the source uses a font or asset you can't
  load, say so and use the nearest token.
- Use the `frontend-design` skill when the source is rough and the person wants it refined, not only ported.

## 4. Check it

- Serve `design/` and open every imported page in Chrome or Edge. Put each page next to the source (screenshot or
  live) and fix differences in layout, spacing and colour.
- Console clean, every link and control works, state survives navigation where the source implies it.
- Run `design:accessibility-review` on the result and fix what it finds.
- Tell the person which pages and components were created, and anything from the source that couldn't be
  reproduced.

## Keeping both in sync

When the source keeps evolving (a canvas the team still edits), import again by page: re-read the changed
artboard, update the matching page and components, and say in the commit which source version it matches.
