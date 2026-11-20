#!/usr/bin/env node
// pnpm videos:<command> (plan 20, decision 0036)
//
//   videos:check [id]            validate one script, or all; renders nothing
//   videos:render <id> [--draft] one video end to end; a demo lands in docs-site/media/
//   videos:preview <id>          HyperFrames studio on the composed project (after a render)
//   videos:stale                 render every demo whose script changed or whose clip is a minor version behind
//   videos:doctor                what the pipeline needs, and how to get what is missing
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { listVideos, load } from './stages/check.mjs';
import { OUT, MEDIA, VIDEOS } from './paths.mjs';

const [cmd, ...args] = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));

/** A demo's clip is stale when its script changed since the render, or it was made by an older minor version. */
export function staleness(id, { media = MEDIA, scripts = path.join(VIDEOS, 'scripts'), current } = {}) {
  const name = id.split('/').pop();
  const m = path.join(media, `${name}.json`);
  if (!fs.existsSync(m)) return 'never rendered';
  const meta = JSON.parse(fs.readFileSync(m, 'utf8'));
  const text = fs.readFileSync(path.join(scripts, id, 'video.yaml'), 'utf8');
  if (crypto.createHash('sha256').update(text).digest('hex') !== meta.script) return 'script changed';
  const minor = (v) => (v || '').split('.').slice(0, 2).join('.');
  if (current && minor(current) !== minor(meta.orrery)) return `made by ${meta.orrery}, now ${current}`;
  return null;
}

function check() {
  const list = ids.length ? ids : listVideos();
  let bad = 0;
  for (const id of list) {
    try { load(id); console.log(`ok    ${id}`); } catch (e) { bad++; console.log(`FAIL  ${e.message}`); }
  }
  if (!list.length) console.log('no scripts yet: add videos/scripts/demos/<id>/video.yaml');
  process.exit(bad ? 1 : 0);
}

async function main() {
  if (cmd === 'check') return check();
  if (cmd === 'render') {
    if (ids.length !== 1) { console.error('usage: pnpm videos:render <id> [--draft]'); process.exit(2); }
    const { render } = await import('./stages/render.mjs');
    await render(ids[0], { draft: flags.has('--draft') });
    return;
  }
  if (cmd === 'preview') {
    const name = ids[0]?.split('/').pop();
    const project = name && path.join(OUT, name, 'project');
    if (!project || !fs.existsSync(project)) { console.error(`no composed project for ${ids[0] ?? '<id>'}: run pnpm videos:render ${ids[0] ?? '<id>'} first`); process.exit(1); }
    const { HYPERFRAMES } = await import('./stages/render.mjs');
    spawnSync('pnpm', ['dlx', HYPERFRAMES, 'preview', project], { stdio: 'inherit', shell: process.platform === 'win32' });
    return;
  }
  if (cmd === 'stale') {
    const { render } = await import('./stages/render.mjs');
    const demos = listVideos().filter((id) => id.startsWith('demos/'));
    const todo = demos.map((id) => [id, staleness(id)]).filter(([, why]) => why);
    if (!todo.length) { console.log(`all ${demos.length} docs clips are up to date`); return; }
    for (const [id, why] of todo) { console.error(`${id}: ${why}`); await render(id, { draft: flags.has('--draft') }); }
    return;
  }
  if (cmd === 'doctor') {
    const need = [
      ['vhs', ['--version'], 'winget install charmbracelet.vhs'],
      ['ttyd', ['--version'], 'winget install tsl0922.ttyd'],
      ['ffmpeg', ['-version'], 'winget install Gyan.FFmpeg (or scoop install ffmpeg)'],
      ['pwsh', ['-v'], 'winget install Microsoft.PowerShell'],
      ['python', ['-c', 'import kokoro_onnx, soundfile'], 'python -m pip install --user kokoro-onnx soundfile (voice, phase 2)'],
    ];
    let bad = 0;
    for (const [bin, a, fix] of need) {
      const r = spawnSync(bin, a, { encoding: 'utf8' });
      const ok = r.status === 0;
      if (!ok) bad++;
      console.log(`${ok ? 'ok     ' : 'MISSING'} ${bin}${ok ? '' : `: ${fix}`}`);
    }
    const node = Number(process.versions.node.split('.')[0]);
    console.log(`${node >= 22 ? 'ok     ' : 'MISSING'} node ${process.versions.node}${node >= 22 ? '' : ': HyperFrames needs Node 22+'}`);
    process.exit(bad || node < 22 ? 1 : 0);
  }
  console.error('usage: pnpm videos:check [id] | videos:render <id> [--draft] | videos:preview <id> | videos:stale | videos:doctor');
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('pipeline', 'cli.mjs'))) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
