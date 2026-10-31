// <ds-theme-toggle> — switches the page between the dark and light token sets. Shares the theme as K.use('theme').
(self.KOUJI = self.KOUJI || []).push(function (K) {
  const theme = K.use('theme') || K.provide('theme', K.signal(document.documentElement.dataset.theme || 'dark'));

  class ThemeToggle extends K.Base {
    static styles = [K.css('../design-system/components/theme-toggle.css')];

    render() {
      return K.html`<ds-button variant="ghost">Switch to ${theme.value === 'light' ? 'dark' : 'light'}</ds-button>`;
    }

    rendered() {
      this.$('ds-button').addEventListener('click', () => {
        const next = theme.value === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;   // tokens first, so swatches re-read the new values
        theme.value = next;
      });
    }
  }
  K.define('ds-theme-toggle', ThemeToggle);
});
