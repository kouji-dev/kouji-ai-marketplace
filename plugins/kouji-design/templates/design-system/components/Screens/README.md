`<ds-screens>` shows one of its `<section id="…" data-title="…">` children at a time, picked by the URL hash.

- Content: one `<section>` per screen or topic, written as plain page markup, so the canvas can edit it.
- `index`: a left column lists every section and the shown one scrolls on the right. Use it for an app's
  components page.
- Without `index`, the page's own links switch screens (`<a href="#profile">`). Use it for an app's screens.
- Every section is reachable by its hash (`app.dc.html#profile`), so screenshots and links can point at it.
