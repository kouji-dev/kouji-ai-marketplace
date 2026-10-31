// <ds-swatch token="--accent">Primary actions</ds-swatch> — one token row for the design system's colour page:
// the colour, its name, its use (slot) and its live value, re-read when the theme changes.
(self.KOUJI = self.KOUJI || []).push(function (K) {
  class Swatch extends K.Base {
    static styles = [K.css('../design-system/components/swatch.css')];
    static attributes = ['token'];

    render() {
      K.use('theme')?.value;                           // re-render when <ds-theme-toggle> switches the theme
      const token = this.attr('token') ?? '';
      const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      return K.html`<span class="chip" style="background: var(${token})"></span><code>${token}</code><span class="use"><slot></slot></span><code class="value">${value}</code>`;
    }
  }
  K.define('ds-swatch', Swatch);
});
