// Every design-system component (tag prefix ds-). Paths are relative to the page, and every page sits one level
// under design/, so '../design-system/…' works from the design system's own pages and from every app.
(self.DS = self.DS || []).push(function (ds) {
  ds.load([
    '../design-system/components/button.js',
    '../design-system/components/swatch.js',        // documentation: the colours page
    '../design-system/components/theme-toggle.js',  // documentation: the colours page
  ]);
});
