---
name: canvas-sync
description: Keep the project's design/ folder and a Claude Design canvas identical — push local changes to the canvas (each design/ folder a canvas page, each .dc.html an artboard) and pull back edits made on the canvas. Use when the person wants a design on a canvas, shares a canvas to work from, or asks to sync either way.
---

# Sync design/ with a Claude Design canvas

`design/` and the canvas's `project/` folder hold the same files at the same paths:
`design/shop/index.dc.html` is `project/shop/index.dc.html`, `design/canvas.json` is `project/canvas.json`. A sync
copies files; it never converts them. This works because every file follows `design-folder` — check that first.

## Which canvas

`design/.canvas.json` (local only, never sent) remembers it:

```json
{ "url": "https://claude.ai/artifact/…", "slug": "…", "version": "<last version synced>" }
```

- **No canvas yet:** create one from the **Design** artifact type, titled after the project
  (e.g. "Shop design"), and write `design/.canvas.json`.
- **The person shares a canvas link:** that one. Its `project/` must follow this structure; if it holds other
  `.dc.html` artboards (another format), use `import-design` instead of syncing over them.

## Push: design/ → canvas

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/canvas-index.mjs design` so `canvas.json` lists every page.
2. **Pull first** if the canvas changed since `version` in `.canvas.json` (step "Pull"), so a teammate's edit on
   the canvas isn't overwritten.
3. Publish the changed files with the artifact tools, in patch mode: each file under `design/` → `project/<same
   path>`, `canvas.json` included, and `.canvas.json` excluded. Files deleted locally go in the publish's removals.
   Text, CSS, JS and PNG files all travel as files: no uploads, no rewritten paths.
4. Save the new version in `.canvas.json`. Tell the person what changed on the canvas.

## Pull: canvas → design/

1. List the canvas's files; read every file under `project/` that differs from `design/` (compare sizes or
   hashes) and write it to the same path under `design/`. Files gone from the canvas are removed locally.
2. Keep `project/canvas.json` as `design/canvas.json`: it carries positions and notes people set on the canvas.
3. Edits made in the canvas editor land in the `.dc.html` markup (inline `style="…"` on elements). Keep them;
   if one breaks a rule (a `{{hole}}`, a body script), tell the person and move that behaviour into a component.
4. Serve `design/` and open the pages that changed: the console must be clean. Save the version in
   `.canvas.json`, and say which pages changed.

## Rules

- `support.js` files travel too: the canvas ignores them and uses its own runtime, so they are harmless there.
- `screenshots/` travel as files; images load on the canvas from the artboard's folder.
- Never send files outside `design/` and never send `.canvas.json`.
- A publish refused for a conflict means someone saved meanwhile: pull, redo, push again.
- After a push, check the canvas in the browser when the person can: each page's artboards render, and links move
  between artboards in Play.
