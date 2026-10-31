// The base class every component extends. A component declares its styles and attributes, and renders from
// signals and attributes; it re-renders by itself when any of them change.
import { signal, effect } from './deps.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const RAW = Symbol('raw');

/** Markup that html`` inserts as is (another html`` result, or trusted markup). */
export const raw = (markup) => ({ [RAW]: String(markup) });

/** Tagged template: interpolated values are escaped, arrays are joined, raw()/html`` results pass through. */
export function html(strings, ...values) {
  const part = (v) => v == null || v === false ? ''
    : Array.isArray(v) ? v.map(part).join('')
    : v[RAW] !== undefined ? v[RAW]
    : String(v).replace(/[&<>"']/g, (c) => ESC[c]);
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ''), ''));
}

export class Base extends HTMLElement {
  /** CSSStyleSheets adopted by the shadow root: import sheet from './x.css' with { type: 'css' }. */
  static styles = [];
  /** Attribute names this component reads with this.attr(name); changing one re-renders. */
  static attributes = [];
  static get observedAttributes() { return this.attributes; }

  #attrs = signal({});
  #stop = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).adoptedStyleSheets = [...this.constructor.styles];
  }

  /** An attribute's value (null when absent). Reading it inside render() subscribes to changes. */
  attr(name) { return this.#attrs.value[name] ?? null; }
  /** A boolean attribute: present means true. */
  flag(name) { return this.attr(name) !== null; }

  attributeChangedCallback(name, _old, value) { this.#attrs.value = { ...this.#attrs.value, [name]: value }; }

  connectedCallback() {
    const seed = {};
    for (const name of this.constructor.attributes) seed[name] = this.getAttribute(name);
    this.#attrs.value = seed;
    // Re-render whenever a signal or attribute read during render() changes.
    this.#stop = effect(() => {
      const out = this.render();
      this.shadowRoot.innerHTML = out?.[RAW] ?? String(out ?? '');
      this.rendered?.();
    });
  }

  disconnectedCallback() { this.#stop?.(); this.#stop = null; }

  /** Override: return html`…`. Use <slot> for children. */
  render() { return html`<slot></slot>`; }

  /** Fire a DOM event that bubbles out of the shadow root: this.emit('select', { id }). */
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }

  /** Shorthand for querying inside the component: this.$('button'). */
  $(selector) { return this.shadowRoot.querySelector(selector); }
}

/** Register a tag once, even if a page imports the component twice. */
export function define(tag, cls) { if (!customElements.get(tag)) customElements.define(tag, cls); }
