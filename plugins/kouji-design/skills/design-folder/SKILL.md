---
name: design-folder
description: Where every design goes and how it is laid out, so the same files run locally and on a Claude Design canvas. Use for ANY design, mockup, prototype, screen, page or UI work in a project — including designs made in Claude Design, a claude.ai artifact, Google Stitch or Figma — before writing a single file.
---

# The design folder

Every design for a project lives in that project, in `design/` at the repository root. The same files are two
things at once:

- **locally**, a native web app you serve and open in Chrome or Edge;
- **on a Claude Design canvas**, the canvas's `project/` folder: each folder of `design/` is a canvas page (the
  page picker), each `.dc.html` file is an artboard on it.

Nothing is converted between the two: `canvas-sync` copies files both ways. Every rule below exists so a file
works in both places — break one and the design breaks on the canvas, usually silently.

## Layout

```
design/
├── canvas.json                 # the canvas index: pages, artboards and their positions (scripts/canvas-index.mjs)
├── .canvas.json                # local only: which canvas this folder syncs with (canvas-sync)
├── design-system/              # OPTIONAL: only when several apps share one design system → canvas page "Design system"
│   ├── index.dc.html           # REQUIRED here: lists the element pages below, grouped (foundations, components)
│   ├── colors.page.dc.html     # one concise page per element (colors, typography, code, spacing, buttons, …)
│   ├── buttons.page.dc.html
│   ├── components/
│   │   ├── button.js           # <ds-button>, a classic script
│   │   └── button.css          # its styles, fetched into its shadow root
│   ├── components.js           # lists every design-system component
│   ├── base.js                 # the kit: Preact signals bundled + the DS global (Base, html, css, provide/use, persisted, load)
│   ├── tokens.css, base.css    # shared tokens, page reset and layout helpers
│   ├── docs.css                # layout of the design system's own pages
│   └── support.js              # local stand-in for the canvas runtime (the canvas ignores it)
├── <app>/                      # one folder per app: shop, admin, … → one canvas page each
│   ├── index.dc.html           # REQUIRED: the app's entry page, as the real app would open
│   ├── <name>.page.dc.html     # one file per page: checkout.page.dc.html, settings.page.dc.html
│   ├── overview.page.dc.html   # OPTIONAL, only if the person said yes: every page as a card with a screenshot
│   ├── screenshots/            # the PNGs the overview shows
│   ├── support.js              # local stand-in for the canvas runtime
│   └── shared/                 # this app's own system and logic, kept FLAT
│       ├── components/<name>.js + <name>.css
│       ├── components.js       # lists this app's components
│       ├── store.js            # the app's shared state
│       ├── tokens.css          # the app's tokens, or only its overrides of design-system's
│       └── base.js, base.css   # only when there is no design-system/ (the app then carries the kit itself)
└── <other-app>/…
```

## The two levels of "shared"

- **No design system shared between apps** → the app is self-contained: `shared/` holds the kit (`base.js`),
  `base.css`, all tokens and every component.
- **One design system for several apps** → `design/design-system/` holds the kit, tokens, base styles and the
  generic components (`ds-…`). Apps don't carry `base.js` or `base.css`; their pages load the design system's,
  then their own `shared/` for app-only components, state and token overrides.
- A component a second app needs moves up to `design/design-system/components/` and becomes `ds-<name>`.
  Never copy a component between apps.

## Rules that keep both worlds working

- **Every page sits exactly one level under `design/`.** So `../design-system/…` reaches the design system from
  any page, and `shared/…` is the page's own app. Every path in a page or component is relative to the PAGE.
- **Pages are static markup.** A page is a `.dc.html` artboard: plain HTML inside `<x-dc>` plus components. No
  `{{holes}}`, `<sc-if>` or `<sc-for>` (they only render on the canvas) and no `<script>` in the body. All
  behaviour and live text lives in components.
- **Components are classic scripts,** registered through the kit's queue, never ES modules: the canvas can't
  resolve module imports. Each loads its own `.css` with `ds.css(path)`.
- **No network.** No CDN, no remote image, no API. The only library, Preact signals, is bundled in `base.js`.
  Google Fonts stylesheets are the one exception the canvas allows.
- **Names:** folders and files are kebab-case. Pages are `index.dc.html` and `<name>.page.dc.html`. A component
  file `date-picker.js` defines `<prefix-date-picker>`: `ds` in the design system, the app's short prefix in an app
  (written at the top of the app's `shared/components.js`).
- **Valid markup for the canvas:** quote every attribute (`disabled=""`, not `disabled`), close every
  non-void element, no `<iframe>`, `<object>` or `<embed>`.
- **Target browsers:** current Chrome and Edge, locally and on the canvas.
- **Serve, don't double-click:** serve the `design/` folder itself (`npx serve design` or
  `python3 -m http.server -d design`) and open `/<app>/index.dc.html`.
- **Ask before building an app's pages** whether the person wants an overview page (see `pages-and-state`).
  On the canvas the page picker already lists every artboard, so the overview is mainly for local browsing.
- **The design system documents itself.** Every token family and `ds-` component has a short
  `<element>.page.dc.html`, and `design/design-system/index.dc.html` lists them. Adding or changing an element
  updates its page and the index in the same change.
- **Verify in the browser** before calling a design done: open each page you touched, check the console has no
  errors, click what you built. After a sync, check the canvas too.

## Which skill next

- New app or first design in a project → `new-design-app`.
- Writing or changing a component → `web-components`.
- Pages, navigation, state, the overview → `pages-and-state`.
- Sending `design/` to a canvas, or bringing canvas edits back → `canvas-sync`.
- A design that exists elsewhere (another canvas, an artifact, Stitch, Figma, a screenshot) → `import-design`.
- Direction and review come from the plugins this one depends on: `frontend-design` for the visual direction,
  `design:design-critique` and `design:accessibility-review` to review the result, `design:design-handoff` to spec
  it for engineering, `engineering:code-review` for the code.
