// app: a scene in a browser -> a take with an animated cursor and click ripples (plan 20, phase 3).
//
// Playwright drives headless Chromium (nothing takes the screen) and records the page and a trace; playwright-recast
// turns them into the take, drawing the cursor's path and a ripple on every click. Time is real: each step's start is
// logged as the video runs, so captions and zoom need no calibration, and a wait is shown in full.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { REPO } from '../paths.mjs';
import { parseKey, TYPING_MS, TYPED_MS, BEAT_MS, AFTER_WAIT_MS, FRAME } from './terminal.mjs';

// The page is laid out at 1280x800 CSS pixels and drawn at 1.5x: the take is FRAME (1920x1200), its text readable.
export const VIEW = { width: 1280, height: 800, scale: FRAME.width / 1280 };
export const CURSOR_MS = 700; // recast moves the cursor to a click; it needs this long on screen
export const GAP_MS = 500; // after a spoken line, before the next beat

const ms = (s) => (s.endsWith('ms') ? Number(s.slice(0, -2)) : Math.round(Number(s.slice(0, -1)) * 1000));
const KEYS = { Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Space: ' ' };

/** A step's key as Playwright names it: `Down` -> ArrowDown, `Ctrl+K` -> Control+K. */
export const playwrightKey = (name) => KEYS[name] ?? name.replace(/^Ctrl\+/, 'Control+');

/** Where a scene's page is: an http(s) URL as given, or a path served from landing/ (the site as built). */
export const isRemote = (url) => /^https?:\/\//.test(url);

export function serve(root) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, ...p.split('/'));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/** What a click names: a link or a button by its accessible name, else visible text. */
const target = (page, name) => page.getByRole('link', { name, exact: true })
  .or(page.getByRole('button', { name, exact: true })).or(page.getByRole('tab', { name, exact: true }))
  .or(page.getByText(name, { exact: true })).first();

/**
 * Record one app scene: run its steps in a fresh headless browser, then render the take with recast.
 * `lineMs(step)` is how long a step's `say:` line is spoken: the next beat waits for it (the live form of makeRoom).
 * @returns {Promise<{ events: {at:number, step:object, index:number, box:object|null}[], durationMs: number }>}
 */
export async function recordApp(steps, { url, dir, clip, lineMs = () => 0, log = () => {} }) {
  const { chromium } = await import('@playwright/test');
  const { Recast } = await import('playwright-recast');
  const rec = path.join(dir, `${clip.replace(/\.mp4$/, '')}-rec`);
  fs.rmSync(rec, { recursive: true, force: true });
  const site = isRemote(url) ? null : await serve(path.join(REPO, 'landing'));
  const events = [];
  let loadMs = 0;
  let durationMs = 0;
  try {
    // Headless Chromium screencasts at CSS size unless forced: without this the take is 1280x800 upscaled (soft text).
    const browser = await chromium.launch({ args: [`--force-device-scale-factor=${VIEW.scale}`] });
    const context = await browser.newContext({ viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.scale, recordVideo: { dir: rec, size: { width: FRAME.width, height: FRAME.height } } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    const start = Date.now(); // the video starts with the page
    await page.goto(site ? `${site.base}${url}` : url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    loadMs = Date.now() - start;
    let spokenUntil = 0;
    for (const [index, step] of steps.entries()) {
      // A new spoken beat waits for the last line to finish.
      if (step.say && Date.now() - start < spokenUntil) await page.waitForTimeout(spokenUntil - (Date.now() - start));
      const at = Date.now() - start - loadMs;
      if (step.say) spokenUntil = Date.now() - start + lineMs(step) + GAP_MS;
      let box = null;
      if (step.click !== undefined) {
        const el = target(page, step.click);
        await el.scrollIntoViewIfNeeded();
        box = await el.boundingBox();
        await page.waitForTimeout(CURSOR_MS);
        await el.click();
        await page.waitForTimeout(BEAT_MS);
      } else if (step.fill !== undefined) {
        for (const [label, value] of Object.entries(step.fill)) {
          const el = page.getByLabel(label).first();
          box = await el.boundingBox();
          await page.waitForTimeout(CURSOR_MS);
          await el.click();
          await el.pressSequentially(String(value), { delay: TYPING_MS });
        }
        await page.waitForTimeout(TYPED_MS);
      } else if (step.type !== undefined) {
        await page.keyboard.type(step.type, { delay: TYPING_MS });
        await page.waitForTimeout(TYPED_MS);
      } else if (step.key !== undefined) {
        const { name, count } = parseKey(step.key);
        for (let i = 0; i < count; i++) await page.keyboard.press(playwrightKey(name));
        await page.waitForTimeout(BEAT_MS);
      } else if (step.wait !== undefined) {
        const w = typeof step.wait === 'string' ? { for: step.wait } : step.wait;
        await page.getByText(w.for).first().waitFor({ timeout: ms(w.timeout ?? '30s') });
        await page.waitForTimeout(AFTER_WAIT_MS);
      } else if (step.scroll !== undefined) {
        // A smooth scroll: the wheel in small steps, not one jump.
        for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, step.scroll / 24); await page.waitForTimeout(25); }
        await page.waitForTimeout(BEAT_MS);
      } else if (step.pause !== undefined) {
        await page.waitForTimeout(ms(step.pause));
      }
      events.push({ at, step, index, box: box && { x: box.x * VIEW.scale, y: box.y * VIEW.scale, w: box.width * VIEW.scale, h: box.height * VIEW.scale } });
      log(`  ${index + 1}. ${Object.keys(step).find((k) => k !== 'caption' && k !== 'say' && k !== 'zoom')} at ${(at / 1000).toFixed(2)} s`);
    }
    if (Date.now() - start < spokenUntil) await page.waitForTimeout(spokenUntil - (Date.now() - start));
    durationMs = Date.now() - start - loadMs;
    await context.tracing.stop({ path: path.join(rec, 'trace.zip') });
    await context.close();
    await browser.close();
  } finally {
    site?.close();
  }
  // recast draws the cursor and the clicks; the page's loading is then cut off the front.
  const raw = path.join(rec, 'take.mp4');
  await Recast.from(rec).parse().cursorOverlay().clickEffect().render({ format: 'mp4', resolution: { width: FRAME.width, height: FRAME.height }, fps: 30 }).toFile(raw);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', (loadMs / 1000).toFixed(3), '-i', raw, '-t', (durationMs / 1000).toFixed(3), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', path.join(dir, clip)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg could not trim the app take: ${(r.stderr || '').trim().split('\n').pop()}`);
  return { events, durationMs };
}
