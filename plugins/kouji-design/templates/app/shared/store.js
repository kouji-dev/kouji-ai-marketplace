// App state: plain signals, imported by any component or page that needs them.
// Pages are separate HTML documents, so state that must survive a navigation is persisted to sessionStorage.
import { signal, effect } from './deps.js';

/** A signal saved in sessionStorage under `app:<key>`, restored on the next page. */
export function persisted(key, initial) {
  const id = 'app:' + key;
  let start = initial;
  try { const saved = sessionStorage.getItem(id); if (saved !== null) start = JSON.parse(saved); } catch { /* storage blocked: start fresh */ }
  const s = signal(start);
  effect(() => { try { sessionStorage.setItem(id, JSON.stringify(s.value)); } catch { /* storage blocked */ } });
  return s;
}

// ── the app's state, one export per piece ──
export const user = persisted('user', { name: 'Ada' });
export const cart = persisted('cart', []);
export const theme = signal(document.documentElement.dataset.theme ?? 'dark');
