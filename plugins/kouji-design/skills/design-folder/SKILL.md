---
name: design-folder
description: Where every design goes and how it is laid out. Use for ANY design, mockup, prototype, screen, page or UI work in a project — including designs made in Claude Design, a claude.ai artifact, Google Stitch or Figma — before writing a single file.
---

# The design folder

Every design for a project lives in that project, in `design/` at the repository root, as a native web app that
opens in Chrome or Edge. Not in a scratch folder, not only on a canvas or in an artifact: when the work happens
locally, the files land here.

## Layout

```
design/
├── design-system/              # OPTIONAL: only when several apps share one design system
│   ├── index.html              # REQUIRED here: lists every element page below, grouped (foundations, components)
│   ├── colors.page.html        # one concise page per element: what it is, shown live, the tokens behind it
│   ├── typography.page.html    #   (colors, typography, code, spacing, icons, buttons, inputs, cards, …)
│   ├── buttons.page.html
│   ├── components/
│   │   ├── button.js           # <ds-button>
│   │   └── button.css
│   ├── components.js           # registers every design-system component
│   ├── deps.js                 # the one place CDN imports live (pinned versions)
│   ├── base.js                 # Base class, html``, define()
│   ├── tokens.css              # shared tokens
│   ├── base.css                # page reset and layout helpers
│   ├── docs.css                # layout of the design system's own pages (apps never load it)
│   └── screenshots/            # optional: PNGs of its pages, from the screenshot script
├── <app>/                      # one folder per app: shop, admin, mobile, …
│   ├── index.html              # REQUIRED: the app's entry page (its home), as the real app would open
│   ├── <name>.page.html        # one file per page: checkout.page.html, settings.page.html
│   ├── overview.page.html      # OPTIONAL, only if the person said yes: every page as a card with a screenshot
│   ├── screenshots/            # the PNGs the overview shows, one per page
│   └── shared/                 # this app's own system and logic, kept FLAT
│       ├── components/
│       │   ├── <name>.js       # one web component per file, no sub-folders
│       │   └── <name>.css      # its styles, same name, same folder
│       ├── components.js       # registers this app's components (and the design system's first)
│       ├── deps.js, base.js    # the implementation, or re-exports of design-system's
│       ├── store.js            # app state (signals)
│       ├── tokens.css          # the app's tokens, or only its overrides of design-system's
│       └── base.css            # only when there is no design-system/
└── <other-app>/…
```

## The two levels of "shared"

- **No design system shared between apps** → each app is self-contained: `design/<app>/shared/` holds the
  implementation of `deps.js`, `base.js`, tokens and every component.
- **One design system for several apps** → `design/design-system/` holds what is common (tokens, base styles,
  generic components such as button, input, dialog) AND the one implementation of `deps.js` and `base.js`.
  Each app's `shared/deps.js` and `shared/base.js` become one-line re-exports, so component imports never change:

  ```js
  // design/<app>/shared/base.js
  export * from '../../design-system/base.js';
  ```

  The app keeps in its own `shared/` only what is specific to it: its components, its store, its token overrides.
- A component used by a second app moves up to `design-system/` (rename its tag from `<app>-x` to `ds-x`).
  Never copy a component between apps.

## Rules

- **Names:** folders and files are kebab-case. Pages end in `.page.html`. A component file `date-picker.js`
  defines `<prefix-date-picker>`, where the prefix is `ds` in the design system and the app's short prefix
  in an app (chosen once, written at the top of the app's `shared/components.js`).
- **Native only:** ES modules, custom elements with shadow DOM, CSS module scripts
  (`import sheet from './button.css' with { type: 'css' }`), modern CSS (nesting, `color-mix`, `:has`,
  container queries). No build step, no bundler, no framework. The only library is
  `@preact/signals-core`, through `deps.js`.
- **Target browsers:** current Chrome and Edge. CSS module scripts don't work in Safari; that's accepted.
- **Serve, don't double-click:** ES modules need http. Serve the `design/` folder itself (so `../design-system/`
  resolves) with `npx serve design` or `python3 -m http.server -d design`, then open `/<app>/index.html`.
- **Ask before building an app's pages** whether the person wants an overview page — `overview.page.html`,
  every page as a card with a screenshot. It is not the index: `index.html` stays the app's entry page. Wait for
  the answer before creating pages, and build the overview only on a yes (see `pages-and-state`).
- **The design system documents itself.** Every token family and every `ds-` component gets a short
  `<element>.page.html` in `design/design-system/`, and `design/design-system/index.html` lists them all. Adding
  or changing an element updates its page and the index in the same change.
- **Verify in the browser** before calling a design done: open each page you touched, check the console has no
  errors, click what you built.

## Which skill next

- New app or first design in a project → `new-design-app`.
- Writing or changing a component → `web-components`.
- Pages, navigation, state → `pages-and-state`.
- A design that exists elsewhere (Claude Design canvas, artifact, Stitch, Figma, screenshot) → `import-design`.
- Direction and review come from the plugins this one depends on: `frontend-design` for the visual direction,
  `design:design-critique` and `design:accessibility-review` to review the result, `design:design-handoff` to spec
  it for engineering, `engineering:code-review` for the code.
