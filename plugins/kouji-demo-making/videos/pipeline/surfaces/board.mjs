// stills: a motion page shows the ADE, Cloud and the phone as their design/ pages (the mockups the apps match), not
// as UI drawn again in the page. A still names an app page and its section (`ade/ade#needs-you`; #app by default) and,
// for the section's prototype, the state to open it at (`start: session`, drawn still). It opens the page headless at
// 2x, clicks a button if asked (the prototypes answer: `Allow once` gives the allowed state), replaces text, hides
// parts, measures the boxes the page asked for, and shoots <id>.png. The page gets each still's size and boxes as
// window.STILLS, to move parts of a shot.
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../paths.mjs';
import { serve } from './app.mjs';

export const DESIGN = path.join(REPO, 'design');
export const STILL_SCALE = 2;

/** `ade/ade#needs-you` → the page file under design/ and the section shown. */
export function boardRef(board) {
  const [page, section = 'app'] = String(board).split('#');
  return { file: `${page}.dc.html`, section };
}

/** A page's own size, from its canvas preview (`"$preview":{"width":390,"height":844}`); 1440x908 without one. */
export function boardSize(html) {
  const m = /"\$preview":\{"width":(\d+),"height":(\d+)\}/.exec(html);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1440, h: 908 };
}

// Runs in the page: every text node, shadow roots included, with each key replaced by its value in one pass.
function rename(map) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const walk = (root) => {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) {
      const t = n.textContent.replace(re, (m) => map[m]);
      if (t !== n.textContent) n.textContent = t;
    }
    for (const e of root.querySelectorAll('*')) if (e.shadowRoot) walk(e.shadowRoot);
  };
  walk(document.body);
}

/**
 * Shoot each still into `dir` as <id>.png.
 * @returns {Promise<Record<string, { w: number, h: number, find: Record<string, number[][]> }>>} board pixels
 */
export async function shootStills(stills, dir, log = () => {}) {
  const { chromium } = await import('@playwright/test');
  fs.mkdirSync(dir, { recursive: true });
  const site = await serve(DESIGN);
  const browser = await chromium.launch();
  const out = {};
  try {
    for (const s of stills) {
      const { file, section } = boardRef(s.board);
      const [sw, sh] = (s.size ?? '').split('x').map(Number);
      const { w, h } = s.size ? { w: sw, h: sh } : boardSize(fs.readFileSync(path.join(DESIGN, file), 'utf8'));
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: STILL_SCALE });
      await page.goto(`${site.base}/${file}#${section}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // the canvas runtime draws the page after the load
      // the shot is the section alone: the page's section index (<ds-screens index>) is the page's, not the app's
      await page.evaluate(() => document.querySelectorAll('ds-screens[index]').forEach((e) => e.removeAttribute('index')));
      if (s.start) {
        // a prototype takes its state when it connects: mount a fresh one at `start`, drawn still
        const ok = await page.evaluate(([sec, start]) => {
          const old = [...document.querySelectorAll(`section#${sec} *`)].find((e) => e.localName.endsWith('-prototype'));
          if (!old) return false;
          const el = document.createElement(old.localName);
          for (const a of old.attributes) el.setAttribute(a.name, a.value);
          el.setAttribute('start', start);
          el.setAttribute('still', '');
          old.replaceWith(el);
          return true;
        }, [section, s.start]);
        if (!ok) throw new Error(`stills: ${s.id}: no prototype in ${file}#${section} to open at start: ${s.start}`);
        await page.waitForTimeout(1500);
      }
      // the #section in the URL scrolled the page to it on load: the shot starts at the section's top, as a board did
      await page.evaluate(() => {
        const top = (root) => root.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; if (e.shadowRoot) top(e.shadowRoot); });
        top(document); window.scrollTo(0, 0);
      });
      if (s.click) {
        await page.getByRole('button', { name: s.click }).first().click();
        await page.waitForTimeout(1200);
      }
      if (s.text) await page.evaluate(rename, s.text);
      for (const sel of s.hide ?? []) for (const el of await page.locator(sel).all()) await el.evaluate((e) => { e.style.visibility = 'hidden'; });
      const find = {};
      for (const [name, sel] of Object.entries(s.find ?? {})) {
        find[name] = [];
        for (const el of await page.locator(sel).all()) {
          const b = await el.boundingBox();
          if (b) find[name].push([b.x, b.y, b.width, b.height].map(Math.round));
        }
        if (!find[name].length) throw new Error(`stills: ${s.id}: nothing on ${s.board} matches find.${name} (${sel}); open the board with pnpm design and check the selector`);
      }
      await page.screenshot({ path: path.join(dir, `${s.id}.png`) });
      await page.close();
      out[s.id] = { w, h, find };
      log(`  still ${s.id}: ${s.board}${s.click ? `, after ${s.click}` : ''}`);
    }
  } finally {
    await browser.close();
    site.close();
  }
  return out;
}
