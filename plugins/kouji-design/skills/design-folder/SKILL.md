---
name: design-folder
description: Where every design goes and how it is laid out, so the same files run locally and on a Claude Design canvas. Use for ANY design, mockup, prototype, screen, page or UI work in a project — including designs made in Claude Design, a claude.ai artifact, Google Stitch or Figma — before writing a single file.
---

# The design folder

Every design for a project lives in that project, in `design/` at the repository root. The same files are three
things at once:

- **locally**, a native web app you serve and open in Chrome or Edge;
- **on a Claude Design canvas**, the canvas's `project/` folder: each app folder of `design/` is a canvas page,
  each `.dc.html` file an artboard on it;
- **the design system** (`design/design-system/`) is its own **Design System artifact**: the brand book, tokens
  and a card per component. The canvas holds an installed copy of it in `ds/<folder>/`, which feeds the canvas's
  Theme menu, colour pickers and text styles.

Nothing is converted: `canvas-sync` copies files both ways. Every rule below exists so a file works in all three
places; break one and the design breaks on the canvas, usually silently.

## Layout

```
design/
├── canvas.json                  # the canvas index: pages, artboards, positions, the design system's record
├── .canvas.json                 # local only: which canvas and which Design System artifact this folder syncs with
├── design-system/               # = the Design System artifact's project/ — NOT a canvas page
│   ├── design-system.json       # its index: title, namespace (the bundle's global, e.g. "Shop")
│   ├── README.md                # the brand book: usage rules that name tokens
│   ├── tokens.json              # every token, as lists (Theme menu, colour pickers, text styles read it)
│   ├── tokens.css               # generated from tokens.json by ds-install.mjs
│   ├── components/
│   │   ├── bundle.js            # the kit + EVERY component, one classic script
│   │   ├── bundle.css           # page-level CSS: reset, layout helpers, values tokens.json can't hold
│   │   └── <Comp>/README.md + preview.html   # one card per component (Button/, DatePicker/, …)
│   └── fonts/, assets/          # when the brand has them
├── ds/<folder>/                 # the installed copy (ds-install.mjs): tokens.*, components/bundle.*, fonts/
├── <app>/                       # one folder per app: shop, admin, … → one canvas page each
│   ├── <app>.dc.html            # REQUIRED: the interactive app, every screen and state inside it
│   ├── <app>-components.dc.html # every component and token the app uses, one page, a left index
│   ├── support.js               # local stand-in for the canvas runtime
│   └── shared/store.js          # the app's state (+ data.js when the demo data is large)
└── <freeform>/                  # OPTIONAL: standalone boards (brand, logos, explorations), named <freeform>-<name>.dc.html
```

## Condensed pages: few artboards, each one interactive

A design is read by clicking through it, not by scrolling a wall of boards. Keep it condensed:

| Level | What it is | How many |
| :- | :- | :- |
| The design system | its own Design System artifact: brand book, tokens, a card per component | one, for the whole project |
| An app (a product, a client, a site) | one folder → one canvas page: `ade/`, `cloud/`, `harness/`, `phone/`, `landing/` | one per app |
| Its components | `<app>-components.dc.html` | **one page per app** |
| Its screens | `<app>.dc.html`, the interactive app | **one page per app** |
| Freeform (brand, logos, social cards, explorations, one-off pages) | standalone boards in their own folder | the only exception |

- **Group by app first, never by kind.** No separate folders or canvas pages for an app's foundations, its
  components and its screens: they are the same app's two pages.
- **Components: one page per app.** Every component the app uses, with its foundations (colours, type, spacing,
  radii) first, all in `<app>-components.dc.html`. Don't split it by spec, topic or area ("shell", "navigation",
  "spec 8"): a topic is a section of that page, listed in its left index (`<ds-screens index="">`), and the shown
  section scrolls on the right. Many interactive examples (every state of a list, every row of a table) are more
  sections or tabs inside the page, never more pages.
- **Screens: only the interactive app.** Every screen and state is reachable inside `<app>.dc.html`
  (navigation, dialogs, empty, loading, error, narrow), each a `<section id>` with its own hash
  (`shop.dc.html#checkout-error`), so a link, a screenshot or a review can point at it. No static board per
  screen next to it.
- **A site is one interactive page too:** each of its pages a section, its own nav switching them.
- **One screen high, scrolling inside.** An artboard is at most 8000 px a side: a page keeps a fixed height
  (`$preview` 1280–1440 × 800–900) and its content scrolls inside `<ds-screens>`.
- **Condensing an existing design** (many boards per app): list every board and each state it shows first; build
  each into the app page (a section, a reachable state) or the components page; check every item of the list is
  there; only then delete the old boards. Nothing a board showed is lost.
- **Freeform folders** hold boards that stand apart from any app (brand, logos, social cards, explorations,
  a one-off page): as many as needed, same naming and size rules. List the folder in `canvas.json`'s
  `"freeform"` (`"freeform": ["brand"]`) so
  `canvas-index.mjs` lets it keep more than two boards; it refuses that in every other folder.

## What is shared, and where

- **Every project has one design system,** even with one app: the canvas needs it for its Theme menu.
- **Every component lives in `design-system/components/bundle.js`,** named `ds-<name>`, whichever app uses it.
  Its CSS sits beside its class in the bundle (a shadow root doesn't see page CSS); page-level CSS goes in
  `bundle.css`. An app folder holds pages and state, never components.
- **Pages load the installed copy:** `../ds/<folder>/tokens.css`, `../ds/<folder>/components/bundle.css`,
  `../ds/<folder>/components/bundle.js`, then `shared/store.js`. After any change to `design-system/`, run
  `node ${CLAUDE_PLUGIN_ROOT}/scripts/ds-install.mjs design` to refresh `ds/<folder>/` (and `tokens.css`).
- **The one file in every app folder is `support.js`:** the canvas requires each page to load exactly
  `./support.js` (it swaps in its runtime there), so a tiny local stand-in sits next to the pages.

## The canvas's limits

| Limit | Value | What follows |
| :- | :- | :- |
| Files per canvas | 512, its own ~33 included | `design/` minus `design-system/` stays under ~470: few pages, one bundle, no unused assets |
| Size | 256 MB a canvas; 16 MB and 255 files a publish | a big push takes several calls |
| Artboard | 40–8000 px a side | one screen high, scroll inside |
| Pages | 40 | one per app folder |
| File names | `[A-Za-z0-9_.-]`, every name unique on the canvas | `<app>.dc.html`, `<app>-<name>.dc.html` |
| Network | Google Fonts only | everything else is a file in `design/` |
| Design system | its files in `ds/<folder>/` plus a `designSystems` record | ds-install.mjs, then canvas-sync |
| `bundle.js` | ≤ 6 MB, no literal `</script` or `<!--` | ds-install.mjs checks it |

`node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design` refuses, with the fix, every one of these it can see.

## Rules that keep every place working

- **Every page sits exactly one level under `design/`,** so `../ds/<folder>/…` reaches the design system from any
  page and `shared/…` is the page's own app.
- **Pages are static markup.** Plain HTML inside `<x-dc>` plus components: that markup is what the canvas lets
  people select and edit. No `{{holes}}`, `<sc-if>`, `<sc-for>` or body `<script>`. Behaviour and live text live in
  components; screens and copy stay markup in the page.
- **Components are classic scripts in the bundle,** never ES modules: the canvas can't resolve imports.
- **No network.** No CDN, no remote image, no API. Preact signals are bundled in the kit. Google Fonts is the one
  exception.
- **Names:** folders and files kebab-case; pages `<app>.dc.html` and `<app>-<name>.dc.html`; elements
  `ds-<name>`; component cards `components/<PascalName>/`.
- **Valid markup for the canvas:** quote every attribute (`disabled=""`), close every non-void element, no
  `<iframe>`, `<object>` or `<embed>`.
- **Serve, don't double-click:** serve `design/` (`pnpm dlx serve design` or `python3 -m http.server -d design`) and
  open `/<app>/<app>.dc.html` in current Chrome or Edge.
- **Verify in the browser** before calling a design done: open each page you touched, check the console has no
  errors, click through every screen you built. After a sync, check the canvas too.

## Limits

- What a component draws (inside its shadow root) shows on the canvas but can't be selected or edited there;
  only the page markup around it can. Keep screens and copy in the page.
- The design system's cards (`preview.html`) render only on the Design System artifact; locally, the app's
  components page shows the components.
- A theme switched in the canvas's Theme menu reaches components through custom properties; a value written
  literally in a component's CSS doesn't change.

## Which skill next

- New app or first design in a project → `new-design-app`.
- Writing or changing a component → `web-components`.
- Pages, screens, navigation, state → `pages-and-state`.
- Sending `design/` to a canvas, or bringing canvas edits back → `canvas-sync`.
- A design that exists elsewhere (another canvas, an artifact, Stitch, Figma, a screenshot) → `import-design`.
- Direction and review come from the plugins this one depends on: `frontend-design` for the visual direction,
  `design:design-critique` and `design:accessibility-review` to review the result, `design:design-handoff` to spec
  it for engineering, `engineering:code-review` for the code.
