# kouji-design

Every design for a project lives in that project's `design/` folder as a native web app that opens in Chrome
or Edge: custom elements with their own CSS file, pages as `<name>.page.html`, shared state with
[`@preact/signals-core`](https://github.com/preactjs/signals), no build step.

```
design/
├── design-system/            # optional: what several apps share (tokens, generic components, base.js, deps.js)
└── <app>/
    ├── index.html            # entry + list of pages
    ├── <name>.page.html
    └── shared/
        ├── components/<name>.js + <name>.css
        └── deps.js, base.js, store.js, tokens.css, base.css, components.js
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
| `design-folder` | Where every design goes and how `design/` is laid out — read first for any design work |
| `web-components` | Writing a component: `<name>.js` + `<name>.css`, the `Base` class, attributes, events, slots |
| `pages-and-state` | Pages, the shared head, navigation, signals and the store, the one pinned CDN dependency |
| `new-design-app` | Scaffolding `design/<app>/`, alone or on top of `design/design-system/` |
| `import-design` | Rebuilding a design from Claude Design, a claude.ai artifact, Google Stitch, Figma or a screenshot |

## Depends on

- `design@knowledge-work-plugins` — critique, accessibility review, handoff specs, UX copy
- `engineering@knowledge-work-plugins` — code review, testing strategy, architecture
- `frontend-design@claude-plugins-official` — visual direction for distinctive interfaces

## Templates

`templates/app/` is a working app (home page, a second page sharing state, two reference components);
`templates/design-system/` is the shared level. Serve the folder that contains them
(`python3 -m http.server`) and open `app/index.html` to see them run.
