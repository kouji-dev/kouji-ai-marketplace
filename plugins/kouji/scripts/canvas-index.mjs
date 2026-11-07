#!/usr/bin/env node
// Writes design/canvas.json — the Claude Design canvas index — from the folders in design/, so the same folder
// is both the local design and the canvas's project/: one canvas page per folder (design-system first), one
// artboard per *.dc.html in it.
//
//   node canvas-index.mjs <design-dir> [--title "Shop design"]
//
// Keeps everything already in canvas.json that still matches a file: positions, sizes, titles, notes, pages'
// names, launch, design systems. New artboards go at the end of their page's row; artboards whose file is gone
// are dropped. Prints what changed. Run it after adding, renaming or removing a page.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const [dir, ...rest] = process.argv.slice(2);
if (!dir) { console.error('Usage: node canvas-index.mjs <design-dir> [--title "…"]'); process.exit(2); }
const ti = rest.indexOf('--title');
const titleArg = ti >= 0 ? rest[ti + 1] : null;

const indexPath = join(dir, 'canvas.json');
let index = null;
try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch { /* new index */ }
index ??= { v: 3, createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }, title: titleArg ?? 'Design', launch: { view: 'canvas' }, pages: [], boards: {}, order: [], notes: {}, designSystems: [] };
if (titleArg) index.title = titleArg;
index.pages ??= []; index.boards ??= {}; index.order ??= []; index.notes ??= {};

const SEG = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const pretty = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// folders that hold artboards, design-system first
const folders = [];
for (const name of (await readdir(dir)).sort()) {
  if (name.startsWith('.') || name === 'ds') continue;
  if (!(await stat(join(dir, name))).isDirectory()) continue;
  const files = (await readdir(join(dir, name))).filter((f) => f.endsWith('.dc.html'));
  if (files.length) folders.push({ name, files });
}
folders.sort((a, b) => (a.name === 'design-system' ? -1 : b.name === 'design-system' ? 1 : a.name.localeCompare(b.name)));

const changes = [];
const seenStems = new Map();
const keep = new Set();
const pageIds = new Set(index.pages.map((p) => p.id));

for (const { name: folder, files } of folders) {
  if (!SEG.test(folder)) { console.error(`Folder "${folder}" can't be a canvas path: use letters, digits, - _ . only.`); process.exit(1); }
  const id = folder.slice(0, 40);
  if (!pageIds.has(id)) { index.pages.push({ id, name: folder === 'design-system' ? 'Design system' : pretty(folder) }); pageIds.add(id); changes.push(`+ page ${id}`); }

  // index.dc.html first, then the pages alphabetically, overview last
  files.sort((a, b) => {
    const rank = (f) => (f === 'index.dc.html' ? 0 : f === 'overview.page.dc.html' ? 2 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  // the row's next free x, after this page's existing artboards
  let nextX = 0;
  for (const [k, b] of Object.entries(index.boards)) if (k.startsWith(folder + '/') && files.includes(k.slice(folder.length + 1))) nextX = Math.max(nextX, b.x + b.w + 80);

  for (const file of files) {
    if (!SEG.test(file)) { console.error(`File "${folder}/${file}" can't be a canvas path: use letters, digits, - _ . only.`); process.exit(1); }
    const key = `${folder}/${file}`;
    const stem = `${folder}/${file.replace(/\.dc\.html$/, '')}`;
    seenStems.set(stem, key);
    keep.add(key);
    const src = await readFile(join(dir, folder, file), 'utf8');
    const title = src.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    const preview = src.match(/"\$preview"\s*:\s*\{\s*"width"\s*:\s*(\d+)\s*,\s*"height"\s*:\s*(\d+)/);
    if (!index.boards[key]) {
      const w = preview ? Number(preview[1]) : 1280, h = preview ? Number(preview[2]) : 800;
      index.boards[key] = { x: nextX, y: 0, w, h, page: id, expand: 'fill', is_interactive: true, ...(title ? { title } : {}) };
      nextX += w + 80;
      changes.push(`+ ${key}`);
    } else {
      index.boards[key].page ??= id;
    }
  }
}

for (const key of Object.keys(index.boards)) {
  if (!key.endsWith('.dc.html') || key.startsWith('ds/')) continue;
  if (!keep.has(key)) { delete index.boards[key]; changes.push(`- ${key}`); }
}
index.order = [...index.order.filter((k) => index.boards[k]), ...Object.keys(index.boards).filter((k) => !index.order.includes(k))];
index.pages = index.pages.filter((p) => Object.values(index.boards).some((b) => b.page === p.id) || !folders.length);
if (!index.launch?.page || !pageIds.has(index.launch.page)) index.launch = { view: 'canvas', ...(folders[0] ? { page: folders[0].name.slice(0, 40) } : {}) };

await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(changes.length ? changes.join('\n') : 'canvas.json already up to date');
console.log(`${Object.keys(index.boards).length} artboards on ${index.pages.length} pages → ${indexPath}`);
