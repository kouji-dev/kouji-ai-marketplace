`<ds-user-card>` shows the signed-in person and lets them rename themselves; the name is shared app state.

- Reads and writes `app.user` from the app's `shared/store.js`; renders nothing until the store is there.
- The name updates on `change`, so typing is never interrupted.
