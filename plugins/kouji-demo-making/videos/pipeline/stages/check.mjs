// check: read a video.yaml, validate it against schema.json, then lint what a schema cannot see.
// Pure apart from reading files; renders nothing. `pnpm videos:check [id]` runs it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import { VIDEOS, REPO } from '../paths.mjs';
import { configProblem } from './world.mjs';
import { beatsOf } from './showcase.mjs';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');
const schema = JSON.parse(fs.readFileSync(path.join(VIDEOS, 'pipeline', 'schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

const ACTIONS = ['run', 'type', 'key', 'wait', 'reply', 'pause', 'vhs', 'click', 'fill', 'scroll'];
const TERMINAL_ONLY = ['run', 'reply', 'vhs'];
const APP_ONLY = ['click', 'fill', 'scroll'];

/** Every video.yaml under scripts/, as ids: `demos/extensions-install`. */
export function listVideos(root = path.join(VIDEOS, 'scripts')) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'shared') continue;
      const d = path.join(dir, e.name);
      if (fs.existsSync(path.join(d, 'video.yaml'))) out.push(path.relative(root, d).split(path.sep).join('/'));
      else walk(d);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

/** The folder of a video id, accepting `extensions-install` when only one video has that name. */
export function resolveId(id, root = path.join(VIDEOS, 'scripts')) {
  const all = listVideos(root);
  if (all.includes(id)) return id;
  const hits = all.filter((v) => v.split('/').pop() === id);
  if (hits.length === 1) return hits[0];
  throw new Error(hits.length ? `${id} is ambiguous: ${hits.join(', ')}` : `no video ${id}; videos: ${all.join(', ') || 'none'} (scripts live in videos/scripts/<kind>/<id>/video.yaml)`);
}

/** A motion launch: its scenes are footage by id, and the page names only beats and takes the script has. */
function motionProblems(video, ctx) {
  const problems = [];
  if (!video.beats) problems.push('beats: a motion launch is timed by its beats: - { id: open, say: <the line> }');
  const ids = new Set();
  (video.scenes ?? []).forEach((s, i) => {
    if (!s.terminal || !s.id) problems.push(`scenes[${i}]: in a motion launch a scene is footage: a terminal scene with id:, which the page plays`);
    else ids.add(s.id);
  });
  const shots = (video.stills ?? []).map((s) => s.id);
  for (const sid of new Set(shots.filter((s, i) => shots.indexOf(s) !== i))) problems.push(`stills: two shots are called ${sid}; give each its own id`);
  (video.stills ?? []).forEach((s, i) => {
    const page = String(s.board).split('#')[0];
    if (!fs.existsSync(path.join(ctx.designRoot ?? path.join(REPO, 'design'), `${page}.dc.html`))) problems.push(`stills[${i}]: no board design/${page}.dc.html; pnpm design lists the pages`);
  });
  if (!ctx.root || !ctx.id) return problems;
  const file = path.join(ctx.root, ctx.id, video.motion);
  if (!fs.existsSync(file)) return [...problems, `motion: no ${video.motion} beside the script`];
  const page = fs.readFileSync(file, 'utf8');
  const beats = new Set((video.beats ?? []).map((b) => b.id));
  const marks = new Set((video.scenes ?? []).flatMap((s) => (s.terminal ?? []).map((st) => st.mark).filter(Boolean)));
  for (const [, id] of page.matchAll(/data-beat="([a-z0-9-]+)"/g)) if (!beats.has(id)) problems.push(`motion: ${video.motion} uses beat ${id}; add it to beats:`);
  for (const [, id, mark] of page.matchAll(/data-take="([a-z0-9-]+)"(?: data-from="([a-z0-9-]+)")?/g)) {
    if (!ids.has(id)) problems.push(`motion: ${video.motion} plays take ${id}; give a terminal scene id: ${id}`);
    if (mark && !marks.has(mark)) problems.push(`motion: ${video.motion} starts take ${id} at ${mark}; put mark: ${mark} on that step`);
  }
  return [...new Set(problems)];
}

/**
 * Problems with a parsed script, as `where: what, and the fix` lines. Empty when it is fine.
 * `ctx.docsRoot` is docs-site/, `ctx.worldsRoot` scripts/shared/worlds/.
 */
export function lint(video, ctx = {}) {
  const problems = [];
  if (!validate(video)) {
    for (const e of validate.errors) problems.push(`${e.instancePath || '/'}: ${e.message}${e.params?.additionalProperty ? ` (\`${e.params.additionalProperty}\`)` : ''}`);
    return problems;
  }
  if (video.kind !== 'showcase' && !video.scenes) problems.push(`scenes: a ${video.kind} needs its scenes`);
  const usedBy = (id) => {
    if (!ctx.root) return null;
    try { return parse(fs.readFileSync(path.join(ctx.root, id, 'video.yaml'), 'utf8')); } catch { return undefined; }
  };
  (video.scenes ?? []).forEach((scene, i) => {
    const where = `scenes[${i}]`;
    const surfaces = ['terminal', 'app', 'card', 'uses'].filter((k) => k in scene);
    if (surfaces.length !== 1) { problems.push(`${where}: needs exactly one of terminal, app, card or uses (has ${surfaces.join(', ') || 'none'})`); return; }
    if (scene.app && !scene.url) problems.push(`${where}: an app scene opens a page: url: / (the site in landing/) or https://…`);
    if (scene.url && !scene.app) problems.push(`${where}: url: belongs to an app scene`);
    if ((scene.card || scene.uses) && video.kind !== 'launch') problems.push(`${where}: ${surfaces[0]} scenes belong to a launch (kind: launch)${video.kind === 'showcase' ? '; a showcase takes its demo with uses: at the top' : ''}`);
    if (scene.card && !scene.text) problems.push(`${where}: a card shows text: add text:`);
    if (scene.say && !scene.card && !scene.uses) problems.push(`${where}: say: on a ${surfaces[0]} scene goes on its steps`);
    if (scene.uses && video.kind === 'launch') {
      const used = usedBy(scene.uses);
      if (used === undefined) problems.push(`${where}: no videos/scripts/${scene.uses}/video.yaml`);
      else if (used?.scenes && Array.isArray(scene.say) && scene.say.length !== beatsOf(used).length) {
        problems.push(`${where}: ${scene.uses} has ${beatsOf(used).length} captioned beats; give one say line for each, or one line for the scene (has ${scene.say.length})`);
      }
    }
    if (scene.terminal && video.kind === 'launch' && !video.world) problems.push(`${where}: a terminal scene needs the video's world`);
    if (scene.setup && !scene.terminal) problems.push(`${where}: setup belongs to a terminal scene`);
    for (const [j, step] of (scene.setup ?? []).entries()) {
      if (step.caption !== undefined || step.say || step.zoom) problems.push(`${where}.setup[${j}]: setup runs hidden, before the clip; captions, say and zoom go on the visible steps`);
    }
    [
      ...(scene.setup ?? []).map((s, j) => [s, `${where}.setup[${j}]`, false]),
      ...(scene.terminal ?? []).map((s, j) => [s, `${where}.terminal[${j}]`, false]),
      ...(scene.app ?? []).map((s, j) => [s, `${where}.app[${j}]`, true]),
    ].forEach(([step, at, app]) => {
      const acts = ACTIONS.filter((a) => a in step);
      if (acts.length !== 1) { problems.push(`${at}: one action per step (has ${acts.join(', ') || 'none'}); split it into two steps`); return; }
      if (!app && APP_ONLY.includes(acts[0])) problems.push(`${at}: ${acts[0]} is an app step; the terminal takes run, type, key, wait, reply, pause or vhs`);
      if (app && TERMINAL_ONLY.includes(acts[0])) problems.push(`${at}: ${acts[0]} is a terminal step; an app takes click, fill, type, key, wait, scroll or pause`);
      if (step.zoom === 'target' && !(step.click || step.fill)) problems.push(`${at}: zoom: target eases in on what a click or a fill touches; give rows a-b in a terminal`);
      if (app && step.zoom && step.zoom !== 'target' && step.zoom !== 'off') problems.push(`${at}: an app zooms with zoom: target or off`);
      if (step.vhs !== undefined && typeof step.seconds !== 'number') problems.push(`${at}: a vhs step needs \`seconds:\`, how long its visible part lasts`);
      if (step.until && !step.run) problems.push(`${at}: \`until\` belongs to a run step`);
      if (video.kind === 'demo' && step.caption && !step.say) problems.push(`${at}: a docs clip speaks every captioned step: add say: <the line, written to be spoken>`);
    });
  });
  if (video.kind === 'showcase') {
    if (!video.voice) problems.push('voice: a showcase is spoken: voice: af_heart (Kokoro; hyperframes tts --list for the others)');
    if (!video.hook?.text) problems.push('hook: a showcase opens on a card: hook: { text: <title>, say: <the first line> }');
    if (!video.end?.text) problems.push('end: a showcase closes on a card: end: { text: getorrery.dev }');
    if (video.uses) {
      if (video.world || video.scenes) problems.push('uses: takes the demo\'s world and scenes; leave world and scenes out');
      if (ctx.root) {
        let used = null;
        try { used = parse(fs.readFileSync(path.join(ctx.root, video.uses, 'video.yaml'), 'utf8')); } catch { problems.push(`uses: no videos/scripts/${video.uses}/video.yaml`); }
        const beats = used?.scenes ? beatsOf(used).length : 0;
        if (used && (video.say ?? []).length !== beats) problems.push(`say: ${video.uses} has ${beats} captioned beats; give one line for each (has ${(video.say ?? []).length})`);
      }
    } else {
      if (!video.world || !video.scenes) problems.push('a showcase takes a demo (uses: demos/<id>) or has its own world and scenes');
      if (video.say) problems.push('say: the list goes with uses:; in your own scenes, put say: on the steps');
    }
  }
  if (video.kind === 'launch') {
    if (!video.voice) problems.push('voice: a launch is spoken: voice: af_heart (Kokoro; hyperframes tts --list for the others)');
    if (video.motion) problems.push(...motionProblems(video, ctx));
    if (video.music && video.motion) problems.push('music: a motion launch has no music track yet; leave music out');
    if (video.music && ctx.root) {
      const track = path.join(ctx.root, video.music.track);
      const licence = track.replace(/\.[a-z0-9]+$/i, '.licence.md');
      if (!fs.existsSync(track)) problems.push(`music.track: no videos/scripts/${video.music.track}`);
      else if (!fs.existsSync(licence)) problems.push(`music.track: no licence beside it; add videos/scripts/${path.relative(ctx.root, licence).split(path.sep).join('/')} saying where the track comes from and that it may be used`);
    }
  }
  if (video.stills && !video.motion) problems.push('stills: shots of the boards are shown by a motion page; add motion: <page>.html, or leave stills out');
  if (video.kind === 'demo') {
    if (!video.docs) problems.push('docs: a demo names the docs-site page that embeds it, e.g. docs: extend/install.md');
    else if (ctx.docsRoot) {
      const page = path.join(ctx.docsRoot, video.docs);
      if (!fs.existsSync(page)) problems.push(`docs: ${video.docs} is not a docs-site page`);
      else if (ctx.id && !fs.readFileSync(page, 'utf8').includes(`media/${ctx.id.split('/').pop()}.mp4`)) {
        problems.push(`docs: ${video.docs} does not embed the clip; add ![${video.title}](../media/${ctx.id.split('/').pop()}.mp4) where it belongs`);
      }
    }
    if (!video.world && video.scenes?.some((s) => s.terminal)) problems.push('world: a terminal demo needs a world (home, workspace, terminal)');
  }
  if (video.world?.config && configProblem(video.world.config)) problems.push(`world.config: ${configProblem(video.world.config)}`);
  if (video.world?.model && video.world.replies) problems.push('world: model and replies exclude each other: model calls a real one, replies replays authored answers on the fixture');
  if (video.world && ctx.worldsRoot) {
    for (const k of ['home', 'workspace']) {
      const name = video.world[k];
      if (name && !fs.existsSync(path.join(ctx.worldsRoot, name))) problems.push(`world.${k}: no preset ${name} in videos/scripts/shared/worlds/`);
    }
  }
  return problems;
}

/** Read and lint one video by id. Throws with every problem when it is wrong. */
export function load(id, { root = path.join(VIDEOS, 'scripts'), docsRoot = path.join(REPO, 'docs-site') } = {}) {
  const full = resolveId(id, root);
  const file = path.join(root, full, 'video.yaml');
  const text = fs.readFileSync(file, 'utf8');
  let video;
  try { video = parse(text); } catch (e) { throw new Error(`${full}/video.yaml: not YAML: ${e.message}`); }
  const problems = lint(video, { id: full, docsRoot, root, worldsRoot: path.join(root, 'shared', 'worlds') });
  if (problems.length) throw new Error(`${full}/video.yaml:\n  ${problems.join('\n  ')}`);
  return { id: full, name: full.split('/').pop(), dir: path.join(root, full), text, video };
}
