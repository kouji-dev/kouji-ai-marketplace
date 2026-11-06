# kouji — Claude plugin marketplace

Kouji's Claude Code plugins: the house rules for how we design and build, shared by every project. Change a
skill here once and every project that uses the marketplace gets it at its next update.

| Plugin | What it does |
| :- | :- |
| [`kouji-design`](plugins/kouji-design) | Every design lives in the project's `design/` folder and runs both locally and on a Claude Design canvas: `.dc.html` pages, web components with their own CSS, Preact signals, no build step. Brings in Anthropic's `design`, `engineering` and `frontend-design` plugins. |

## Install in Claude Code

`kouji-design` depends on three Anthropic plugins, so Claude Code must know their two marketplaces as well.
Run these once, in any Claude Code session:

```
/plugin marketplace add anthropics/knowledge-work-plugins
/plugin marketplace add anthropics/claude-plugins-official
/plugin marketplace add kouji-dev/kouji-ai-marketplace
/plugin install kouji-design@kouji
```

Installing `kouji-design` installs `design@knowledge-work-plugins`, `engineering@knowledge-work-plugins` and
`frontend-design@claude-plugins-official` with it. If one of the two Anthropic marketplaces is missing,
`kouji-design` installs but doesn't load, and Claude Code names the missing dependency.

The skills then show up as `/kouji-design:design-folder`, `/kouji-design:web-components`,
`/kouji-design:pages-and-state`, `/kouji-design:new-design-app`, `/kouji-design:canvas-sync` and
`/kouji-design:import-design`, and Claude uses
them on its own when you do design work.

## Use it in a project

Commit this to the project's `.claude/settings.json`, so everyone who opens the project in Claude Code is offered
the marketplaces and the plugin:

```json
{
  "extraKnownMarketplaces": {
    "kouji": { "source": { "source": "github", "repo": "kouji-dev/kouji-ai-marketplace" } },
    "knowledge-work-plugins": { "source": { "source": "github", "repo": "anthropics/knowledge-work-plugins" } },
    "claude-plugins-official": { "source": { "source": "github", "repo": "anthropics/claude-plugins-official" } }
  },
  "enabledPlugins": {
    "kouji-design@kouji": true
  }
}
```

## Staying in sync

- Each plugin has a `version` (in its `plugin.json` and its entry in `marketplace.json`), and the marketplace has
  one in `metadata.version`. Users stay on a version until it changes, so **every change to a plugin bumps its
  version and the marketplace's**, in the same commit.
- `/plugin marketplace update kouji` (or auto-update for the marketplace) then brings the new skills.

## Layout

```
.claude-plugin/marketplace.json          # the marketplace: name "kouji", its plugins, the marketplaces they may depend on
plugins/
└── kouji-design/
    ├── .claude-plugin/plugin.json       # the plugin manifest and its dependencies
    ├── skills/<name>/SKILL.md           # one folder per skill
    └── templates/                       # files the skills copy into a project
```

## Add a plugin

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json` (`name` in kebab-case, prefixed `kouji-`) and
   `skills/<skill>/SKILL.md`.
2. Add an entry to `plugins` in `.claude-plugin/marketplace.json` with `"source": "./plugins/<name>"`.
3. If it depends on a plugin from another marketplace, add that marketplace's name to
   `allowCrossMarketplaceDependenciesOn`.
4. Check it: `claude plugin validate ./plugins/<name>` and `claude plugin validate .`.

Try a plugin without installing it: `claude --plugin-dir ./plugins/<name>`.
