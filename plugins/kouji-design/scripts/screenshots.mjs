#!/usr/bin/env node
// Screenshots every page of one folder in design/ (an app, or design-system) into <folder>/screenshots/<page>.png,
// for an app's overview page.
//
//   node screenshots.mjs <design-dir> <folder> [--width 1440] [--height 900]
//   node screenshots.mjs design shop
//
// Serves <design-dir> itself (so ../design-system/ resolves), opens index.dc.html and every *.page.dc.html in <folder>
// except overview.page.dc.html (through the local support.js), and saves one viewport-sized PNG per page. Needs Playwright with Chromium:
//   npm i -D playwright && npx playwright install chromium
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, extname, sep } from 'node:path';

const [dir, folder, ...rest] = process.argv.slice(2);
if (!dir || !folder) {
  console.error('Usage: node screenshots.mjs <design-dir> <folder> [--width 1440] [--height 900]\n  e.g. node screenshots.mjs design shop');
  process.exit(2);
}
const opt = (name, fallback) => { const i = rest.indexOf('--' + name); return i >= 0 ? Number(rest[i + 1]) : fallback; };
const width = opt('width', 1440), height = opt('height', 900);

// Playwright from the project first, then wherever this script can see it.
let chromium;
for (const base of [join(process.cwd(), 'noop.js'), import.meta.url]) {
  try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* try the next place */ }
}
if (!chromium) {
  console.error('Playwright is not installed. In the project: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const root = resolve(dir);
const target = join(root, folder);
try { await stat(join(target, 'index.dc.html')); } catch {
  console.error(`No index.dc.html in ${target}. Pass the design folder and an app (or design-system) inside it.`);
  process.exit(1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const pages = ['index.dc.html', ...(await readdir(target)).filter((f) => f.endsWith('.page.dc.html') && f !== 'overview.page.dc.html').sort()];
await mkdir(join(target, 'screenshots'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
for (const file of pages) {
  const name = file === 'index.dc.html' ? 'index' : file.replace(/\.page\.dc\.html$/, '');
  await page.goto(`${origin}/${folder}/${file}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(target, 'screenshots', name + '.png') });
  console.log(`${folder}/screenshots/${name}.png`);
}
await browser.close();
server.close();
if (problems.length) { console.error('Page errors:\n  ' + problems.join('\n  ')); process.exit(1); }
