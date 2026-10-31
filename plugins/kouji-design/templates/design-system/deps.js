// The only file that imports from a CDN. Every version is pinned exactly; change it here and nowhere else.
// Components, pages and the store import these names from './deps.js' (or '../deps.js'), never from a URL.
export { signal, computed, effect, batch, untracked } from 'https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.4/+esm';
