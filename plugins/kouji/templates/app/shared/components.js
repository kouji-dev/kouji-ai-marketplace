// Tag prefix for this app's components: app-   (new-design-app replaces it with the app's own prefix)
// Every component of this app, page-relative. With design/design-system/, the page also loads its components.js.
(self.DS = self.DS || []).push(function (ds) {
  ds.load([
    'shared/components/button.js',
    'shared/components/user-card.js',
    'shared/components/greeting.js',
  ]);
});
