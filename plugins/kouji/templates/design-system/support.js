// Local stand-in for the Claude Design canvas runtime. On the canvas, `<script src="./support.js">` loads the
// canvas's own runtime and this file is ignored, so it is safe to keep next to the pages and to sync.
// Pages are static markup plus web components, so locally the browser only needs <x-dc> and <helmet> out of the way.
(function () {
  var style = document.createElement('style');
  style.textContent = 'x-dc, helmet { display: contents; }';
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', function () {
    var dc = document.querySelector('x-dc');
    if (dc && /\{\{[^}]+\}\}/.test(dc.innerHTML)) {
      console.warn('[ds] This page has {{holes}}: they only fill on the canvas. Keep pages static and put behaviour in a component.');
    }
  });
})();
