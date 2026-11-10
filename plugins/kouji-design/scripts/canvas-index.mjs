#!/usr/bin/env node
// Writes design/canvas.json — the Claude Design canvas index — from the folders in design/, so the same folder
// is both the local design and the canvas's project/: one canvas page per app folder, one artboard per *.dc.html
// in it. design-system/ (its own Design System artifact) and ds/ (its installed copy) are not canvas pages.
//
//   node canvas-index.mjs <design-dir> [--title "Shop design"]
//
// Keeps everything already in canvas.json that still matches a file: positions, sizes, titles, notes, pages'
// names, launch, design systems. New artboards go at the end of their page's row; artboards whose file is gone
// are dropped. Refuses, with the fix, what the canvas can't take (a name it can't hold or that isn't unique, an
// artboard over 8000 px, more than 40 pages, more files than a canvas holds) and pages that aren't condensed: an
// app folder holds <app>.dc.html and <app>-components.dc.html only, unless canvas.json lists it in "freeform"
// (standalone boards: brand, logos, social cards, explorations, one-off pages). Run it after adding, renaming or removing a page.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const [dir, ...rest] = process.argv.slice(2);
if (!dir) { console.error('Usage: node canvas-index.mjs <design-dir> [--title "…"]'); process.exit(2); }
const ti = rest.indexOf('--title');
const titleArg = ti >= 0 ? rest[ti + 1] : null;

// The canvas's limits (the Design type's own rules).
const MAX_FILES = 512;          // per canvas, the type's own files included
const TYPE_FILES = 33;          // about what the Design type adds
const MAX_PAGES = 40;
const MIN_SIDE = 40, MAX_SIDE = 8000;
const NOT_PAGES = new Set(['ds', 'design-system']);

const problems = [];
const indexPath = join(dir, 'canvas.json');
let index = null;
try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch { /* new index */ }
index ??= { v: 3, createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }, title: titleArg ?? 'Design', launch: { view: 'canvas' }, pages: [], boards: {}, order: [], notes: {}, designSystems: [] };
if (titleArg) index.title = titleArg;
index.pages ??= []; index.boards ??= {}; index.order ??= []; index.notes ??= {};
const freeform = new Set(index.freeform ?? []);   // folders of standalone boards (brand, explorations…); the canvas keeps the key

const SEG = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const pretty = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// every file the canvas will hold: all of design/ but design-system/ and dot-files
async function count(d) {
  let n = 0;
  for (const name of await readdir(d)) {
    if (name.startsWith('.')) continue;
    const p = join(d, name);
    n += (await stat(p)).isDirectory() ? (d === dir && name === 'design-system' ? 0 : await count(p)) : 1;
  }
  return n;
}

// folders that hold artboards
const folders = [];
for (const name of (await readdir(dir)).sort()) {
  if (name.startsWith('.') || NOT_PAGES.has(name)) continue;
  if (!(await stat(join(dir, name))).isDirectory()) continue;
  const files = (await readdir(join(dir, name))).filter((f) => f.endsWith('.dc.html'));
  if (files.length) folders.push({ name, files });
}
if (folders.length > MAX_PAGES) problems.push(`${folders.length} app folders: a canvas holds ${MAX_PAGES} pages. Merge folders.`);

const changes = [];
const stems = new Map();
const keep = new Set();
const pageIds = new Set(index.pages.map((p) => p.id));

for (const { name: folder, files } of folders) {
  if (!SEG.test(folder)) { problems.push(`Folder "${folder}": use letters, digits, - _ . only.`); continue; }
  const id = folder.slice(0, 40);
  if (!pageIds.has(id)) { index.pages.push({ id, name: pretty(folder) }); pageIds.add(id); changes.push(`+ page ${id}`); }

  // <folder>.dc.html (the entry) first, then the rest alphabetically
  files.sort((a, b) => (a === `${folder}.dc.html` ? -1 : b === `${folder}.dc.html` ? 1 : a.localeCompare(b)));

  let nextX = 0;
  for (const [k, b] of Object.entries(index.boards)) if (k.startsWith(folder + '/') && files.includes(k.slice(folder.length + 1))) nextX = Math.max(nextX, b.x + b.w + 80);

  for (const file of files) {
    const key = `${folder}/${file}`;
    const stem = file.replace(/\.dc\.html$/, '');
    if (!SEG.test(file)) { problems.push(`${key}: use letters, digits, - _ . only.`); continue; }
    if (!freeform.has(folder) && stem !== folder && stem !== folder + '-components') problems.push(`${key}: an app has two pages, ${folder}.dc.html (every screen a #section) and ${folder}-components.dc.html (every component). Fold it into one of them, or add "${folder}" to canvas.json "freeform" if its boards stand apart (brand, logos, explorations).`);
    else if (stem !== folder && !stem.startsWith(folder + '-')) problems.push(`${key}: name it ${folder}.dc.html (the entry) or ${folder}-<name>.dc.html, so every name on the canvas is unique.`);
    if (stems.has(stem)) problems.push(`${key} and ${stems.get(stem)} share the name "${stem}": the canvas needs every file name to be unique. Rename one.`);
    stems.set(stem, key);
    keep.add(key);
    const src = await readFile(join(dir, folder, file), 'utf8');
    const title = src.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    const preview = src.match(/"\$preview"\s*:\s*\{\s*"width"\s*:\s*(\d+)\s*,\s*"height"\s*:\s*(\d+)/);
    const w = preview ? Number(preview[1]) : 1280, h = preview ? Number(preview[2]) : 800;
    if ([w, h].some((n) => n < MIN_SIDE || n > MAX_SIDE)) problems.push(`${key}: $preview ${w}×${h}; an artboard is ${MIN_SIDE}–${MAX_SIDE} px a side. Keep the page one screen high and scroll inside it (ds-screens), or split it.`);
    if (!index.boards[key]) {
      index.boards[key] = { x: nextX, y: 0, w, h, page: id, expand: 'fill', is_interactive: true, ...(title ? { title } : {}) };
      nextX += w + 80;
      changes.push(`+ ${key}`);
    } else {
      index.boards[key].page ??= id;
    }
  }
}

const files = await count(dir);
if (files + TYPE_FILES > MAX_FILES) problems.push(`${files} files in design/ (design-system/ aside) + about ${TYPE_FILES} of the canvas's own: a canvas holds ${MAX_FILES}. Fold pages into ds-screens, drop unused assets.`);

if (problems.length) { console.error('canvas-index: canvas.json not written:\n  ' + problems.join('\n  ')); process.exit(1); }

for (const key of Object.keys(index.boards)) {
  if (!key.endsWith('.dc.html') || key.startsWith('ds/')) continue;
  if (!keep.has(key)) { delete index.boards[key]; changes.push(`- ${key}`); }
}
index.order = [...index.order.filter((k) => index.boards[k]), ...Object.keys(index.boards).filter((k) => !index.order.includes(k))];
index.pages = index.pages.filter((p) => Object.values(index.boards).some((b) => b.page === p.id) || !folders.length);
if (!index.launch?.page || !pageIds.has(index.launch.page)) index.launch = { view: 'canvas', ...(folders[0] ? { page: folders[0].name.slice(0, 40) } : {}) };

await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(changes.length ? changes.join('\n') : 'canvas.json already up to date');
console.log(`${Object.keys(index.boards).length} artboards on ${index.pages.length} pages, ${files} files (+ ~${TYPE_FILES} the canvas adds) of ${MAX_FILES} → ${indexPath}`);
