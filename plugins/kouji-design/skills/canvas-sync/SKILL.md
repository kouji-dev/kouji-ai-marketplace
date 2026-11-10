---
name: canvas-sync
description: Keep the project's design/ folder, its Claude Design canvas and its Design System artifact identical — push local changes (each app folder a canvas page, each .dc.html an artboard, design-system/ to its own artifact and installed on the canvas) and pull back edits made on either. Use when the person wants a design on a canvas, shares a canvas to work from, or asks to sync either way.
---

# Sync design/ with a Claude Design canvas

Two artifacts, two folders, same paths, files copied and never converted:

| Local | Artifact | Path there |
| :- | :- | :- |
| `design/` except `design-system/` and `.canvas.json` | the **Design** canvas | `project/<same path>` |
| `design/design-system/` | the **Design System** artifact | `project/<same path>` |

`design/ds/<folder>/` is the design system installed on the canvas: it travels with the canvas, and
`canvas.json`'s `designSystems` record names the Design System artifact it is a copy of.

## Which artifacts

`design/.canvas.json` (local only, never sent) remembers them:

```json
{ "url": "https://claude.ai/artifact/…", "version": "<canvas version last synced>",
  "designSystem": { "url": "https://claude.ai/artifact/…", "version": "<last synced>" } }
```

- **No canvas yet:** create one from the **Design** artifact type, titled after the project ("Shop design").
- **No Design System artifact yet:** create one from the **Design System** type, titled with
  `design-system.json`'s `title`. Both are private until the person shares them.
- **The person shares a link:** that one. A canvas whose `project/` holds artboards in another format: use
  `import-design` instead of syncing over it.

## Push: design/ → the artifacts

1. `node ${CLAUDE_PLUGIN_ROOT}/scripts/ds-install.mjs design`, then
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design`. Both must pass: they refuse what the artifacts
   can't take.
2. **Pull first** if either artifact changed since the version in `.canvas.json`, so an edit made there isn't
   overwritten.
3. **The design system:** publish the changed files of `design/design-system/` to its artifact, each at
   `project/<same path>`; files deleted locally go as removals. `design-system.json` goes LAST, in its own call:
   `read` it first, keep every key you don't change, set `lastChange` (`by` the person, `via` "Claude Code",
   `at` now). Never write `manifest.json` or `api/`: the page generates them.
4. **The canvas:** publish the changed files of `design/` (not `design-system/`, not `.canvas.json`) to the canvas,
   each at `project/<same path>`, at most 255 files and 16 MB a call. `canvas.json` goes in the LAST call, with
   its `designSystems` record set to
   `{"title", "namespace": "<folder>", "artifact": "<Design System url, cut after its id>", "version": "<its new version>", "copiedAt": "<now>"}`.
5. Save both versions in `.canvas.json`. Tell the person what changed, on which artifact.

## Pull: the artifacts → design/

1. List each artifact's files; read every file under `project/` that differs locally and write it to the same
   path. Files gone there are removed locally.
2. From the Design System artifact, the page's own edits arrive as `tokens.json`, `tokens.css` (regenerated on
   save), `README.md` and card files. Keep them, then run `ds-install.mjs` so `ds/<folder>/` matches.
3. Keep `project/canvas.json` as `design/canvas.json`: it carries positions and notes people set on the canvas.
4. Edits made in the canvas editor land in the `.dc.html` markup (inline `style="…"`). Keep them; if one breaks a
   rule (a `{{hole}}`, a body script), tell the person and move that behaviour into a component.
5. Serve `design/` and open the pages that changed: the console must be clean. Save the versions, and say which
   pages changed.

## Rules

- `support.js` files travel too: the canvas ignores them and uses its own runtime.
- Never send files outside `design/`, never `.canvas.json`, never `design-system/` to the canvas.
- A publish refused for a conflict means someone saved meanwhile: pull, redo, push again.
- After a push, check the canvas in the browser when the person can: artboards render, the Theme menu lists the
  system's colours, links move between artboards in Play.

## Limits

- The canvas copy (`ds/<folder>/`) is only as new as the last push: a token edited on the Design System page
  reaches the canvas after the next pull and push.
- A canvas installs at most four design systems; this skill keeps one.
- Two people pushing at once: the second is refused and must pull first.
