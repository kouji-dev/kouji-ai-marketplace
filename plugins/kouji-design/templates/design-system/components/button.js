// <ds-button variant="primary|ghost" disabled> — the reference component: copy its shape for every new one.
(self.DS = self.DS || []).push(function (ds) {
  class Button extends ds.Base {
    static styles = [ds.css('../design-system/components/button.css')];
    static attributes = ['variant', 'disabled'];

    render() {
      const variant = this.attr('variant') ?? 'primary';
      return ds.html`<button part="button" class="${variant}" ${this.flag('disabled') ? 'disabled' : ''}><slot></slot></button>`;
    }
  }
  ds.define('ds-button', Button);
});
