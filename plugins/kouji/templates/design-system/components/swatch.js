// <ds-swatch token="--accent">Primary actions</ds-swatch> — one token row for the design system's colour page:
// the colour, its name, its use (slot) and its live value, re-read when the theme changes.
(self.DS = self.DS || []).push(function (ds) {
  class Swatch extends ds.Base {
    static styles = [ds.css('../design-system/components/swatch.css')];
    static attributes = ['token'];

    render() {
      ds.use('theme')?.value;                           // re-render when <ds-theme-toggle> switches the theme
      const token = this.attr('token') ?? '';
      const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      return ds.html`<span class="chip" style="background: var(${token})"></span><code>${token}</code><span class="use"><slot></slot></span><code class="value">${value}</code>`;
    }
  }
  ds.define('ds-swatch', Swatch);
});
