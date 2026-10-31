# kouji-design

Every design for a project lives in that project's `design/` folder, and the same files run in two places:
locally as a native web app in Chrome or Edge, and on a Claude Design canvas, where each folder is a canvas page
and each `.dc.html` file an artboard. Web components with their own CSS file, shared state with
[Preact signals](https://github.com/preactjs/signals) bundled in, no build step, no conversion.

```
design/
├── canvas.json               # the canvas index (scripts/canvas-index.mjs)
├── design-system/            # optional: what several apps share → canvas page "Design system"
│   ├── index.dc.html         # lists the element pages
│   ├── <element>.page.dc.html  # colors, typography, code, buttons… — one short page each
│   ├── components/<name>.js + <name>.css
│   └── base.js, components.js, tokens.css, base.css, docs.css, support.js
└── <app>/                    # → one canvas page per app
    ├── index.dc.html         # the app's entry page
    ├── <name>.page.dc.html
    ├── overview.page.dc.html # optional (Claude asks first): every page as a card with a screenshot
    ├── screenshots/
    ├── support.js            # local stand-in for the canvas runtime
    └── shared/
        ├── components/<name>.js + <name>.css
        └── components.js, store.js, tokens.css (+ base.js, base.css without a design system)
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
| `design-folder` | Where every design goes and the rules that keep it working locally and on a canvas — read first |
| `web-components` | Writing a component: `<name>.js` (a classic script on the kit's queue) + `<name>.css` |
| `pages-and-state` | `.dc.html` pages, the overview page (asked first), design-system pages, shared state |
| `new-design-app` | Scaffolding `design/<app>/`, alone or on top of `design/design-system/` |
| `canvas-sync` | Pushing `design/` to a Claude Design canvas and pulling canvas edits back |
| `import-design` | Rebuilding a design from another canvas, an artifact, Google Stitch, Figma or a screenshot |

## Depends on

- `design@knowledge-work-plugins` — critique, accessibility review, handoff specs, UX copy
- `engineering@knowledge-work-plugins` — code review, testing strategy, architecture
- `frontend-design@claude-plugins-official` — visual direction for distinctive interfaces

## Templates and scripts

- `templates/app/` — a working standalone app: home page, a second page sharing state, three components.
- `templates/design-system/` — the shared level with its own documentation pages.
- `templates/overview/` — the optional page listing every page of an app with screenshots.
- `scripts/canvas-index.mjs <design-dir>` — writes `design/canvas.json` from the folders, keeping positions.
- `scripts/screenshots.mjs <design-dir> <folder>` — a PNG per page into `<folder>/screenshots/` (needs Playwright).

Serve the `templates/` folder (`python3 -m http.server`) and open `app/index.dc.html` or
`design-system/index.dc.html` to see them run.

## Why the files look the way they do

The canvas runs each artboard in its own frame, with its own runtime: scripts in any order, no ES module imports,
no network. So pages are static markup inside `<x-dc>`, components are classic scripts queued with
`(self.DS ||= []).push(ds => …)`, styles are fetched with `ds.css()`, and every path is relative to the page
(every page sits one level under `design/`). Each of these was tested on a canvas.
