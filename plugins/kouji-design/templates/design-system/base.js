/* base.js — @preact/signals-core 1.14.4 (MIT, Preact Team, https://github.com/preactjs/signals) bundled first, then
   the design kit. One classic script, no imports: it runs the same from design/ on disk and on a Claude Design canvas.
   To upgrade signals, replace the line below with the new dist/signals-core.min.js (UMD, global preactSignalsCore). */
!function(i,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((i||self).preactSignalsCore={})}(this,function(i){var t=Symbol.for("preact-signals");function n(){if(!(e>1)){var i,t=!1;!function(){var i=d;d=void 0;while(void 0!==i){var t=i.S;if(t.v===i.v)for(var n=t.t;void 0!==n;n=n.x)if(n.i===i.i)n.i=t.i;i=i.o}}();while(void 0!==s){var n=s;s=void 0;v++;while(void 0!==n){var r=n.u;n.u=void 0;n.f&=-3;if(!(8&n.f)&&w(n))try{n.c()}catch(n){if(!t){i=n;t=!0}}n=r}}v=0;e--;if(t)throw i}else e--}function r(i){if(e>0)return i();c=++u;e++;try{return i()}finally{n()}}var o,f=void 0;function h(i){var t=f,n=o;f=void 0;o=void 0;try{return i()}finally{f=t;o=n}}var s=void 0,e=0,v=0,u=0,c=0,d=void 0,a=0;function l(i){if(void 0!==f){var t=i.n;if(void 0===t||t.t!==f){t={i:0,S:i,p:f.s,n:void 0,t:f,e:void 0,x:void 0,r:t};if(void 0!==f.s)f.s.n=t;f.s=t;i.n=t;if(32&f.f)i.S(t);return t}else if(-1===t.i){t.i=0;if(void 0!==t.n){t.n.p=t.p;if(void 0!==t.p)t.p.n=t.n;t.p=f.s;t.n=void 0;f.s.n=t;f.s=t}return t}}}function y(i,t){this.v=i;this.i=0;this.n=void 0;this.t=void 0;this.l=0;this.W=null==t?void 0:t.watched;this.Z=null==t?void 0:t.unwatched;this.name=null==t?void 0:t.name}y.prototype.brand=t;y.prototype.h=function(){return!0};y.prototype.S=function(i){var t=this,n=this.t;if(n!==i&&void 0===i.e){i.x=n;this.t=i;if(void 0!==n)n.e=i;else h(function(){var i;null==(i=t.W)||i.call(t)})}};y.prototype.U=function(i){var t=this;if(void 0!==this.t){var n=i.e,r=i.x;if(void 0!==n){n.x=r;i.e=void 0}if(void 0!==r){r.e=n;i.x=void 0}if(i===this.t){this.t=r;if(void 0===r)h(function(){var i;null==(i=t.Z)||i.call(t)})}}};y.prototype.subscribe=function(i){var t=this;return j(function(){var n=t.value;h(function(){return i(n)})},{name:"sub"})};y.prototype.valueOf=function(){return this.value};y.prototype.toString=function(){return this.value+""};y.prototype.toJSON=function(){return this.value};y.prototype.peek=function(){var i=this;return h(function(){return i.value})};Object.defineProperty(y.prototype,"value",{get:function(){var i=l(this);if(void 0!==i)i.i=this.i;return this.v},set:function(i){if(i!==this.v){if(v>100)throw new Error("Cycle detected");!function(i){if(0!==e&&0===v)if(i.l!==c){i.l=c;d={S:i,v:i.v,i:i.i,o:d}}}(this);this.v=i;this.i++;a++;e++;try{for(var t=this.t;void 0!==t;t=t.x)t.t.N()}finally{n()}}}});function w(i){for(var t=i.s;void 0!==t;t=t.n)if(t.S.i!==t.i||!t.S.h()||t.S.i!==t.i)return!0;return!1}function p(i){for(var t=i.s;void 0!==t;t=t.n){var n=t.S.n;if(void 0!==n)t.r=n;t.S.n=t;t.i=-1;if(void 0===t.n){i.s=t;break}}}function b(i){var t=i.s,n=void 0;while(void 0!==t){var r=t.p;if(-1===t.i){t.S.U(t);if(void 0!==r)r.n=t.n;if(void 0!==t.n)t.n.p=r}else n=t;t.S.n=t.r;if(void 0!==t.r)t.r=void 0;t=r}i.s=n}function _(i,t){y.call(this,void 0,t);this.x=i;this.s=void 0;this.g=a-1;this.f=4}_.prototype=new y;_.prototype.h=function(){this.f&=-3;if(1&this.f)return!1;if(32==(36&this.f))return!0;this.f&=-5;if(this.g===a)return!0;this.g=a;this.f|=1;if(this.i>0&&!w(this)){this.f&=-2;return!0}var i=f;try{p(this);f=this;var t=this.x();if(16&this.f||this.v!==t||0===this.i){this.v=t;this.f&=-17;this.i++}}catch(i){this.v=i;this.f|=16;this.i++}f=i;b(this);this.f&=-2;return!0};_.prototype.S=function(i){if(void 0===this.t){this.f|=36;for(var t=this.s;void 0!==t;t=t.n)t.S.S(t)}y.prototype.S.call(this,i)};_.prototype.U=function(i){if(void 0!==this.t){y.prototype.U.call(this,i);if(void 0===this.t){this.f&=-33;for(var t=this.s;void 0!==t;t=t.n)t.S.U(t)}}};_.prototype.N=function(){if(!(2&this.f)){this.f|=6;for(var i=this.t;void 0!==i;i=i.x)i.t.N()}};Object.defineProperty(_.prototype,"value",{get:function(){if(1&this.f)throw new Error("Cycle detected");var i=l(this);this.h();if(void 0!==i)i.i=this.i;if(16&this.f)throw this.v;return this.v}});function g(i){var t=i.m;i.m=void 0;if("function"==typeof t){e++;var r=f;f=void 0;try{t()}catch(t){i.f&=-2;i.f|=8;x(i);throw t}finally{f=r;n()}}}function x(i){for(var t=i.s;void 0!==t;t=t.n)t.S.U(t);i.x=void 0;i.s=void 0;g(i)}function m(i){if(f!==this)throw new Error("Out-of-order effect");b(this);f=i;this.f&=-2;if(8&this.f)x(this);n()}function S(i,t){this.x=i;this.m=void 0;this.s=void 0;this.u=void 0;this.f=32;this.name=null==t?void 0:t.name;if(o)o.push(this)}S.prototype.c=function(){var i=this.S();try{if(8&this.f)return;if(void 0===this.x)return;var t=this.x();if("function"==typeof t)this.m=t}finally{i()}};S.prototype.S=function(){if(1&this.f)throw new Error("Cycle detected");this.f|=1;this.f&=-9;g(this);p(this);e++;var i=f;f=this;return m.bind(this,i)};S.prototype.N=function(){if(!(2&this.f)){this.f|=2;this.u=s;s=this}};S.prototype.d=function(){this.f|=8;if(!(1&this.f))x(this)};S.prototype.dispose=function(){this.d()};function j(i,t){var n=new S(i,t);try{n.c()}catch(i){n.d();throw i}var r=n.d.bind(n);r[Symbol.dispose]=r;return r}function E(i){return function(){var t=arguments,n=this;return r(function(){return h(function(){return i.apply(n,[].slice.call(t))})})}}function T(){var i=o;o=[];return function(){var t=o;if(o&&i)i=i.concat(o);o=i;return t}}var C=function(i){for(var t in i){var n=i[t];if("function"==typeof n)i[t]=E(n);else if("object"==typeof n&&null!==n&&!("brand"in n))C(n)}};i.Computed=_;i.Effect=S;i.Signal=y;i.action=E;i.batch=r;i.computed=function(i,t){return new _(i,t)};i.createModel=function(i){return function(){var t,n,r=T();try{n=i.apply(void 0,[].slice.call(arguments))}catch(i){o=void 0;throw i}finally{t=r()}C(n);n[Symbol.dispose]=E(function(){if(t)for(var i=0;i<t.length;i++)t[i].dispose();t=void 0});return n}};i.effect=j;i.signal=function(i,t){return new y(i,t)};i.untracked=h});

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
   design kit — the one runtime every component and page uses, in design/ on disk and on a Claude Design canvas.

   Load order doesn't matter: on the canvas, head scripts may run in any order, so every other file registers
   through the queue:   (self.DS = self.DS || []).push(function (ds) { … });
   Paths are relative to the PAGE (document.baseURI). Every page sits one level under design/, so
   '../design-system/…' reaches the design system from any page and 'shared/…' is the page's own app.
   ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */
(function (g) {
  'use strict';
  if (g.DS && g.DS.ready) return;                         // loaded twice (design-system + app): keep the first
  var S = g.preactSignalsCore;
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var RAW = '__ds_raw';

  function url(path) { return new URL(path, document.baseURI).href; }

  // CSS for a component's shadow root, fetched once per path and shared. The sheet is returned at once and
  // filled when the file arrives, so a component never waits on it.
  var sheets = {};
  function css(path) {
    if (!sheets[path]) {
      var sheet = new CSSStyleSheet();
      sheets[path] = sheet;
      fetch(url(path))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (text) { return sheet.replace(text); })
        .catch(function (e) { console.error('[ds] css("' + path + '") failed: ' + e.message + '. The path is relative to the page.'); });
    }
    return sheets[path];
  }

  function raw(markup) { var o = {}; o[RAW] = String(markup); return o; }
  function part(v) {
    if (v == null || v === false) return '';
    if (Array.isArray(v)) return v.map(part).join('');
    if (typeof v === 'object' && RAW in v) return v[RAW];
    return String(v).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }
  function html(strings) {
    var out = '';
    for (var i = 0; i < strings.length; i++) out += strings[i] + (i + 1 < arguments.length ? part(arguments[i + 1]) : '');
    return raw(out);
  }

  // Shared state by name: ds.provide('app', {...}) in store.js, ds.use('app') in a component's render().
  // use() is reactive, so a component rendered before the store loaded re-renders when it arrives.
  var registry = S.signal({});
  // peek(): never subscribe whoever is rendering to the registry just because it provided something.
  function provide(name, value) { var next = Object.assign({}, registry.peek()); next[name] = value; registry.value = next; return value; }
  function use(name) { return registry.value[name]; }

  // A signal saved in sessionStorage, so the next page sees it. On the canvas every artboard stays loaded, so a
  // change made in one artboard also reaches the others live, through the storage event.
  function persisted(key, initial) {
    var id = 'ds:' + key, start = initial;
    try { var saved = sessionStorage.getItem(id); if (saved !== null) start = JSON.parse(saved); } catch (e) { /* storage blocked */ }
    var s = S.signal(start);
    S.effect(function () { try { sessionStorage.setItem(id, JSON.stringify(s.value)); } catch (e) { /* storage blocked */ } });
    g.addEventListener('storage', function (e) {
      if (e.key !== id || e.newValue === null) return;
      try { if (e.storageArea === sessionStorage) s.value = JSON.parse(e.newValue); } catch (err) { /* ignore a bad value */ }
    });
    return s;
  }

  // Load more scripts (a level's components), page-relative. Order between them doesn't matter either.
  // fetch + inline, not <script src>: the canvas's frame only runs scripts it inlined itself, and it allows fetch.
  var loaded = {};
  function load(paths) {
    paths.forEach(function (p) {
      var href = url(p);
      if (loaded[href]) return;
      loaded[href] = true;
      fetch(href)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (code) {
          var s = document.createElement('script');
          s.textContent = code + '\n//# sourceURL=' + href;
          document.head.appendChild(s);
        })
        .catch(function (e) { console.error('[ds] load("' + p + '") failed: ' + e.message + '. The path is relative to the page.'); });
    });
  }

  class Base extends HTMLElement {
    static styles = [];
    static attributes = [];
    static get observedAttributes() { return this.attributes; }
    constructor() {
      super();
      this._attrs = S.signal({});
      this.attachShadow({ mode: 'open' }).adoptedStyleSheets = this.constructor.styles.slice();
    }
    attr(name) { var v = this._attrs.value[name]; return v === undefined ? null : v; }
    flag(name) { return this.attr(name) !== null; }
    // peek(): a child created inside a parent's render must not subscribe the parent to the child's attributes.
    attributeChangedCallback(name, _old, value) { var n = Object.assign({}, this._attrs.peek()); n[name] = value; this._attrs.value = n; }
    connectedCallback() {
      var seed = {}, self = this;
      this.constructor.attributes.forEach(function (a) { seed[a] = self.getAttribute(a); });
      this._attrs.value = seed;
      this._stop = S.effect(function () {
        var out = self.render();
        self.shadowRoot.innerHTML = out && typeof out === 'object' && RAW in out ? out[RAW] : String(out == null ? '' : out);
        if (self.rendered) self.rendered();
      });
    }
    disconnectedCallback() { if (this._stop) this._stop(); this._stop = null; }
    render() { return html(['<slot></slot>']); }
    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail: detail, bubbles: true, composed: true })); }
    $(selector) { return this.shadowRoot.querySelector(selector); }
  }
  function define(tag, cls) { if (!customElements.get(tag)) customElements.define(tag, cls); }

  // One global, DS: before this file runs it is the queue other files push to; from here on it is the kit, and
  // push() runs a callback at once. So (self.DS = self.DS || []).push(function (ds) { … }) works in any order.
  var queue = Array.isArray(g.DS) ? g.DS : [];
  var ds = Object.assign({}, S, { ready: true, url: url, css: css, html: html, raw: raw, provide: provide, use: use,
    persisted: persisted, load: load, Base: Base, define: define, push: function (fn) { fn(ds); } });
  g.DS = ds;
  queue.forEach(function (fn) { fn(ds); });
})(self);
