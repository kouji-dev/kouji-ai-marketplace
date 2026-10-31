// <app-button variant="primary|ghost" disabled> — the reference component: copy its shape for every new one.
import { Base, html, define } from '../base.js';
import sheet from './button.css' with { type: 'css' };

class Button extends Base {
  static styles = [sheet];
  static attributes = ['variant', 'disabled'];

  render() {
    const variant = this.attr('variant') ?? 'primary';
    return html`<button part="button" class="${variant}" ${this.flag('disabled') ? 'disabled' : ''}><slot></slot></button>`;
  }
}

define('app-button', Button);
