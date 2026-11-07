// <ds-theme-toggle> — switches the page between the dark and light token sets. Shares the theme as ds.use('theme').
(self.DS = self.DS || []).push(function (ds) {
  const theme = ds.use('theme') || ds.provide('theme', ds.signal(document.documentElement.dataset.theme || 'dark'));

  class ThemeToggle extends ds.Base {
    static styles = [ds.css('../design-system/components/theme-toggle.css')];

    render() {
      return ds.html`<ds-button variant="ghost">Switch to ${theme.value === 'light' ? 'dark' : 'light'}</ds-button>`;
    }

    rendered() {
      this.$('ds-button').addEventListener('click', () => {
        const next = theme.value === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;   // tokens first, so swatches re-read the new values
        theme.value = next;
      });
    }
  }
  ds.define('ds-theme-toggle', ThemeToggle);
});
