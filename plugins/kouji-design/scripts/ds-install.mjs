#!/usr/bin/env node
// Installs design/design-system/ (a Design System artifact's project/ folder) where the canvas and every local
// page load it: design/ds/<folder>/, the path a Claude Design canvas installs a design system at.
//
//   node ds-install.mjs <design-dir>
//
// 1. Writes design-system/tokens.css from tokens.json, laid out as the Design System page compiles it, when the
//    file is missing or was generated (first line ends "generated from tokens.json */"). A hand-written tokens.css
//    is left alone.
// 2. Checks components/bundle.js and bundle.css: sizes, and no literal "</script" or "<!--" (the canvas inlines them).
// 3. Copies tokens.json, tokens.css, components/bundle.js, components/bundle.css and fonts/ to ds/<folder>/,
//    replacing what was there. <folder> is the namespace in design-system.json, lower case.
// Run it after every change to the design system. Exits 1 with the fix when something is wrong.
import { readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Usage: node ds-install.mjs <design-dir>'); process.exit(2); }
const src = join(dir, 'design-system');
const fail = (msg) => { console.error('ds-install: ' + msg); process.exit(1); };
const read = (p) => readFile(join(src, p), 'utf8').catch(() => null);

const index = JSON.parse((await read('design-system.json')) ?? fail('no design-system/design-system.json. Create the design system first (new-design-app).'));
const { title, namespace } = index;
if (!/^[A-Za-z_$][\w$]*$/.test(namespace ?? '')) fail(`design-system.json "namespace" must be a JS identifier (the bundle's global), got ${JSON.stringify(namespace)}.`);
const folder = namespace.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^[-_]+/, '').slice(0, 64);

// 1. tokens.css
const HEADER = `/* ${title} — generated from tokens.json */`;
const tokensJson = await read('tokens.json');
const tokensCss = await read('tokens.css');
if (tokensJson && (tokensCss == null || /generated from tokens\.json \*\/\s*$/.test(tokensCss.split('\n')[0]))) {
  await writeFile(join(src, 'tokens.css'), compile(JSON.parse(tokensJson)));
  console.log('design-system/tokens.css ← tokens.json');
} else if (!tokensJson) console.warn('ds-install: no tokens.json: the canvas Theme menu and colour pickers will be empty.');

// 2. checks
for (const [p, max] of [['components/bundle.js', 6e6], ['components/bundle.css', 2e6]]) {
  const text = await read(p);
  if (text == null) fail(`no design-system/${p}.`);
  if (Buffer.byteLength(text) > max) fail(`design-system/${p} is over ${max / 1e6} MB, the Design System limit.`);
  if (/<\/script|<!--/i.test(text)) fail(`design-system/${p} has a literal "</script" or "<!--": write it "<\\/script" or "\\x3C!--".`);
}

// 3. copy
const out = join(dir, 'ds', folder);
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'components'), { recursive: true });
for (const p of ['tokens.json', 'tokens.css', 'components/bundle.js', 'components/bundle.css']) {
  if ((await read(p)) != null) await cp(join(src, p), join(out, p));
}
if (await stat(join(src, 'fonts')).catch(() => null)) await cp(join(src, 'fonts'), join(out, 'fonts'), { recursive: true });
console.log(`design-system → ds/${folder}/ (pages load ../ds/${folder}/tokens.css, components/bundle.css, components/bundle.js)`);

// tokens.json → tokens.css, as the Design System page compiles it (its format.md, "tokens.css as compiled").
function compile(t) {
  const themes = t.color?.themes ?? [{ id: 'light' }];
  const first = themes[0].id;
  const val = (v, th) => (v == null || typeof v !== 'object' ? v : v[th] ?? v[first]);
  const ref = (v) => (typeof v === 'string' && /^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
  const len = (v) => (typeof v === 'number' ? (v ? v + 'px' : '0') : v);
  const decl = (name, v) => `  --${name.replace(/\./g, '\\.')}: ${v};`;
  const themed = [...(t.color?.tokens ?? []), ...(t.shadow?.tokens ?? [])];
  const out = [HEADER];
  out.push(`:root, [data-theme="${first}"] {`, ...themed.map((k) => decl(k.name, ref(val(k.value, first)))), '}');
  for (const th of themes.slice(1)) {
    const own = themed.filter((k) => typeof k.value === 'object' && k.value?.[th.id] != null || /^\{/.test(val(k.value, th.id) ?? ''));
    if (own.length) out.push(`[data-theme="${th.id}"] {`, ...own.map((k) => decl(k.name, ref(val(k.value, th.id)))), '}');
  }
  const plain = Object.entries(t).filter(([k, f]) => !['color', 'shadow', 'type', 'name', 'version', 'meta'].includes(k) && Array.isArray(f?.tokens));
  out.push(':root {',
    ...plain.flatMap(([, f]) => f.tokens.map((k) => decl(k.name, len(k.value)))),
    ...Object.entries(t.type?.families ?? {}).map(([k, v]) => decl('font-' + k.toLowerCase(), v)),
    '}');
  for (const g of t.type?.groups ?? []) for (const s of g.styles ?? []) {
    const fam = s.family ?? g.family;
    out.push(`.${s.name} { ${[fam && `font-family: var(--font-${fam})`, s.fontSize && `font-size: ${len(s.fontSize)}`,
      s.lineHeight != null && `line-height: ${s.lineHeight}`, s.fontWeight != null && `font-weight: ${s.fontWeight}`,
      s.letterSpacing != null && `letter-spacing: ${len(s.letterSpacing)}`, s.fontStyle && `font-style: ${s.fontStyle}`].filter(Boolean).join('; ')}; }`);
  }
  for (const f of t.type?.fonts ?? []) {
    const file = f.file.includes('/') ? f.file : 'fonts/' + f.file;
    out.push(`@font-face { font-family: "${f.family}"; src: url("${file}"); font-weight: ${f.weight ?? 400}; font-style: ${f.style ?? 'normal'}; font-display: swap; }`);
  }
  return out.join('\n') + '\n';
}
