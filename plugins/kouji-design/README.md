# kouji-design

Every design for a project lives in that project's `design/` folder, and the same files run in three places:
locally as a native web app in Chrome or Edge; on a Claude Design canvas, where each app folder is a canvas page
and each `.dc.html` file an artboard; and, for `design/design-system/`, as a Design System artifact whose
installed copy gives the canvas its Theme menu, colour pickers and text styles. Web components in one bundle,
shared state with [Preact signals](https://github.com/preactjs/signals) bundled in, no build step, no conversion.

```
design/
├── canvas.json                 # the canvas index (scripts/canvas-index.mjs)
├── design-system/              # the Design System artifact's project/ — not a canvas page
│   ├── design-system.json, README.md, tokens.json, tokens.css (generated)
│   ├── components/bundle.js    # the kit + every ds-* component, one classic script
│   ├── components/bundle.css   # page-level CSS
│   └── components/<Comp>/README.md + preview.html   # a card per component
├── ds/<folder>/                # the system installed on the canvas (scripts/ds-install.mjs)
└── <app>/                      # → one canvas page per app
    ├── <app>.dc.html           # the interactive app: every screen a #section
    ├── <app>-components.dc.html  # every component and token it uses, a left index
    ├── support.js              # local stand-in for the canvas runtime
    └── shared/store.js
```

## Install

```
/plugin marketplace add anthropics/knowledge-work-plugins
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add kouji-dev/kouji-ai-marketplace
/plugin install kouji-design@kouji
```

The first two lines let Claude Code install the three Anthropic plugins this one depends on. See the
[marketplace README](../../README.md) to make a project offer it automatically.

## Skills

| Skill | Use it for |
| :- | :- |
| `design-folder` | Where every design goes, the canvas's limits, the rules that keep it working — read first |
| `web-components` | Writing a component: a `ds-<name>` block in `bundle.js`, its CSS beside it, its card |
| `pages-and-state` | The two artboards of an app, screens as `#sections`, the components page, shared state |
| `new-design-app` | Scaffolding `design/<app>/`, and the design system when the project has none |
| `canvas-sync` | Pushing to the canvas and the Design System artifact, pulling their edits back |
| `import-design` | Rebuilding a design from another canvas, an artifact, Google Stitch, Figma or a screenshot |

## Depends on

- `design@knowledge-work-plugins` — critique, accessibility review, handoff specs, UX copy
- `engineering@knowledge-work-plugins` — code review, testing strategy, architecture
- `frontend-design@claude-plugins-official` — visual direction for distinctive interfaces

## Templates and scripts

The templates folder is laid out like a `design/` folder:

- `templates/design-system/` — a small design system, `Starter`, with four components and their cards.
- `templates/ds/starter/` — its installed copy, as `ds-install.mjs` writes it.
- `templates/app/` — an app's two artboards, `support.js` and `shared/store.js`.
- `scripts/ds-install.mjs <design-dir>` — writes `tokens.css` from `tokens.json`, checks the bundle, copies the
  system to `ds/<folder>/`.
- `scripts/canvas-index.mjs <design-dir>` — writes `design/canvas.json` from the folders, keeping positions, and
  refuses what a canvas can't hold.

Serve the `templates/` folder (`python3 -m http.server -d templates`) and open `app/app.dc.html`.

## Why the files look the way they do

The canvas runs each artboard in its own frame with its own runtime (scripts in any order, no ES module imports,
no network), holds 512 files, frames artboards up to 8000 px, needs every file name unique, and installs a design
system as one script, one stylesheet and `tokens.json`. So: pages are static markup inside `<x-dc>`; every
component is a classic script block in one `bundle.js`, its CSS beside it because a shadow root doesn't see page
CSS; an app is two artboards one screen high, its screens switched inside; and names are `<app>-<name>.dc.html`.

## Limits

- What a component draws shows on the canvas but can't be selected or edited there; page markup can.
- Design-system cards render on the Design System artifact only; locally, an app's components page shows them.
- `bundle.js` is one file: find a component by its tag.
