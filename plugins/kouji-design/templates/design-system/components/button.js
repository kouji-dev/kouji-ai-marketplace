// <ds-button variant="primary|ghost" disabled> — the reference component: copy its shape for every new one.
(self.KOUJI = self.KOUJI || []).push(function (K) {
  class Button extends K.Base {
    static styles = [K.css('../design-system/components/button.css')];
    static attributes = ['variant', 'disabled'];

    render() {
      const variant = this.attr('variant') ?? 'primary';
      return K.html`<button part="button" class="${variant}" ${this.flag('disabled') ? 'disabled' : ''}><slot></slot></button>`;
    }
  }
  K.define('ds-button', Button);
});
