// render: one video end to end.
//   demo:     check -> world -> tape -> VHS -> calibrate -> compose -> HyperFrames -> docs media
//   showcase: check -> voice -> room for each line -> world -> tape -> VHS -> calibrate -> 3 aspects -> HyperFrames
// Heavy (headless Chrome, FFmpeg): run one at a time, never beside cargo or Playwright.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { OUT, MEDIA, REPO, VIDEOS } from '../paths.mjs';
import { load } from './check.mjs';
import { makeWorld } from './world.mjs';
import { compile, record, fontFor, ms } from '../surfaces/terminal.mjs';
import { recordApp } from '../surfaces/app.mjs';
import { shootStills } from '../surfaces/board.mjs';
import { compose, composeShowcase, composeSegments, cardMs, beatMs, fillMotion, cues, ASPECTS, LEAD_MS } from './compose.mjs';
import { readCues, soundtrack, demoSound, DOCS_MUSIC_DB } from './sound.mjs';
import { HYPERFRAMES, speak, chunks, voiceOf, DOCS_VOICE } from './voice.mjs';
import { resolveShowcase, makeRoom, launchParts } from './showcase.mjs';
import { follow } from './follow.mjs';

export { HYPERFRAMES };
// Docs clips are delivered at 1280 wide: half the bytes, still sharp in an 820 px column.
export const DOCS_SIZE = { width: 1280, height: 900, crf: 30 }; // the 16:10 take and its caption band (compose.mjs BAND)

const probe = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()) * 1000;
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'pnpm', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} failed:\n${(r.stderr || r.stdout || '').trim().split('\n').slice(-8).join('\n')}`);
  return r.stdout;
}

/** The manifest written beside a docs clip: what made it, so the docs build can say when it is stale. */
export function manifest({ id, text, orrery, durationMs }) {
  return { video: id, script: sha(text), orrery, durationMs: Math.round(durationMs), rendered: new Date().toISOString().slice(0, 10) };
}

/**
 * Record scenes: a terminal scene in its world through VHS (times planned, then calibrated), an app scene in a
 * headless browser (times real). `first` numbers the files after takes already recorded for the same video (a launch
 * records several worlds); `lineMs(step)` is how long a step's line is spoken, for app scenes to wait on.
 */
async function takes(dir, world, spec, scenes, log, { first = 0, lineMs = () => 0 } = {}) {
  const cols = Number((spec?.terminal || '80x24').split('x')[0]);
  const out = [];
  for (const [n, scene] of scenes.entries()) {
    const i = first + n;
    const clip = `scene-${i + 1}.mp4`;
    if (scene.app) {
      // The voice first: speaking a line takes seconds, and done mid-take it would freeze the page on screen.
      for (const step of scene.app) if (step.say) lineMs(step);
      log(`scene ${i + 1}: ${scene.url} in a headless browser`);
      const { events, durationMs } = await recordApp(scene.app, { url: scene.url, dir, clip, lineMs, log });
      log(`scene ${i + 1}: ${(durationMs / 1000).toFixed(2)} s recorded, the cursor and the clicks drawn by recast`);
      out.push({ clip, durationMs, events, scale: 1, cues: cues(events, durationMs, { scale: 1, font: fontFor(cols), cols }) });
      continue;
    }
    const { tape, events, durationMs } = compile(scene.terminal, { output: clip, ps1: world.ps1, cols, ready: spec.ready, setup: scene.setup });
    const tapeFile = path.join(dir, `scene-${i + 1}.tape`);
    fs.writeFileSync(tapeFile, tape);
    log(`scene ${i + 1}: recording (${(durationMs / 1000).toFixed(1)} s planned)`);
    record(tapeFile, { env: { ...process.env, PATH: process.env.PATH } });
    const real = probe(path.join(dir, clip));
    const scale = real / durationMs;
    log(`scene ${i + 1}: ${(real / 1000).toFixed(2)} s recorded (x${scale.toFixed(3)} of the plan)`);
    const c = cues(events, durationMs, { scale, font: fontFor(cols), cols });
    // No zoom in the script: the camera follows the text (stages/follow.mjs).
    if (!scene.terminal.some((st) => st.zoom)) c.zooms = follow(path.join(dir, clip), c.captions);
    out.push({ clip, durationMs: real, events, scale, cues: c });
  }
  return out;
}

/** A world for the scenes that need one: none when every scene is an app scene. */
function worldFor(name, spec, scenes, log) {
  if (!scenes.some((s) => s.terminal)) return null;
  const world = makeWorld(name, spec);
  log(`world: ${spec.home || 'fresh'} + ${spec.workspace || 'sample-rust'}, ${world.model ? `${world.model.provider}:${world.model.model}, for real` : 'authored replies on the fixture'}`);
  return world;
}

/** A HyperFrames project: the composition, the takes, the tokens (and other files), rendered to `out`. */
function writeProject(project, html, files) {
  fs.rmSync(project, { recursive: true, force: true });
  fs.mkdirSync(project, { recursive: true });
  for (const [to, from] of Object.entries(files)) fs.copyFileSync(from, path.join(project, to));
  fs.copyFileSync(path.join(REPO, 'ui', 'styles', 'tokens.css'), path.join(project, 'tokens.css'));
  fs.writeFileSync(path.join(project, 'index.html'), html);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: `video-${path.basename(project)}`, private: true, type: 'module' }, null, 2) + '\n');
}

const hyperframes = (project, out, draft) =>
  sh('pnpm', ['dlx', HYPERFRAMES, 'render', project, '-o', out, '-q', draft ? 'draft' : 'standard', '--video-frame-format', 'png', '--quiet'], { env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });

function renderProject(project, html, files, out, draft) {
  writeProject(project, html, files);
  hyperframes(project, out, draft);
}

/**
 * After a render that worked: the takes, tapes, recordings and the worlds go; the delivered files (`keep`) and the
 * composed projects (for `preview`) stay. A failed render keeps everything, to see why.
 */
function tidy(dir, keep, worlds, log) {
  const gone = [
    ...fs.readdirSync(dir).filter((f) => !keep.includes(f) && !f.startsWith('project')).map((f) => path.join(dir, f)),
    ...worlds.filter(Boolean).map((w) => w.root),
  ];
  for (const p of gone) {
    try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { log(`tidy: kept ${p} (${e.code}); delete it by hand`); }
  }
}

async function renderDemo({ id: full, name, text, video }, { draft, log }) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  // The voice first (decision 0038: a docs clip speaks): each line's length is known before the tape is written,
  // and the tape leaves room for it.
  const voice = video.voice ?? DOCS_VOICE;
  log(`voice: ${voiceOf(voice).name}, Kokoro through hyperframes tts`);
  const said = new Map();
  const say = (line) => { if (!said.has(line)) said.set(line, speak(line, voice)); return said.get(line); };
  const lineMs = (step) => say(step.say).durationMs;
  const cols = Number((video.world?.terminal || '80x24').split('x')[0]);
  const roomy = video.scenes.map((s) => (s.terminal ? { ...s, terminal: makeRoom(s.terminal, lineMs, { output: 'x.mp4', ps1: 'x.ps1', cols, ready: video.world?.ready, setup: s.setup }) } : s));
  const world = worldFor(name, video.world, roomy, log);
  const scenes = await takes(dir, world, video.world, roomy, log, { lineMs });

  const full1200 = path.join(dir, `${name}-1920x1200.mp4`);
  log('compose: rendering with HyperFrames');
  renderProject(path.join(dir, 'project'), compose({ title: video.title, scenes }), Object.fromEntries(scenes.map((s) => [s.clip, path.join(dir, s.clip)])), full1200, draft);

  // The sound every docs clip gets: its lines where their steps are, over the shared bed and effects.
  const total = scenes.reduce((n, s) => n + s.durationMs, 0);
  const voices = [];
  let t0 = 0;
  for (const s of scenes) {
    for (const e of s.events) if (e.step.say) voices.push({ file: say(e.step.say).wav, at: (t0 + e.at * s.scale) / 1000 });
    t0 += s.durationMs;
  }
  const track = path.join(dir, 'sound.wav');
  const cue = demoSound(scenes);
  soundtrack({ ...cue, voices, total: total / 1000, musicDb: DOCS_MUSIC_DB }, track);
  log(`sound: ${voices.length} lines, ${cue.sfx.length} effects and the bed, levelled to -15 LUFS`);

  const out = path.join(dir, `${name}.mp4`);
  sh('ffmpeg', ['-v', 'error', '-y', '-i', full1200, '-i', track, '-map', '0:v', '-map', '1:a', '-vf', `scale=${DOCS_SIZE.width}:${DOCS_SIZE.height}:flags=lanczos`, '-c:v', 'libx264', '-crf', String(DOCS_SIZE.crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '112k', '-shortest', '-movflags', '+faststart', out]);
  const poster = path.join(dir, `${name}.jpg`);
  const firstCaption = scenes[0].cues.captions[0];
  sh('ffmpeg', ['-v', 'error', '-y', '-ss', String((firstCaption ? firstCaption.start + 1 : 1).toFixed(2)), '-i', out, '-frames:v', '1', '-q:v', '4', poster]);

  // `--version` prints the version on its first line, then a few hints: the last word is not the version.
  const version = world ? /\d+\.\d+\.\d+\S*/.exec(sh(path.join(world.root, 'bin', 'orrery-demo.exe'), ['--version']))?.[0] ?? 'unknown' : 'unknown';
  fs.mkdirSync(MEDIA, { recursive: true });
  fs.copyFileSync(out, path.join(MEDIA, `${name}.mp4`));
  fs.copyFileSync(poster, path.join(MEDIA, `${name}.jpg`));
  fs.writeFileSync(path.join(MEDIA, `${name}.json`), JSON.stringify(manifest({ id: full, text, orrery: version, durationMs: total }), null, 2) + '\n');
  log(`docs: docs-site/media/${name}.mp4 (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${(total / 1000).toFixed(1)} s)`);
  tidy(dir, [], [world], log);
  return { out: path.join(MEDIA, `${name}.mp4`), poster: path.join(MEDIA, `${name}.jpg`), durationMs: total };
}

async function renderShowcase({ name, video }, { draft, log }) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const { world: spec, scenes: resolved } = resolveShowcase(video, video.uses ? load(video.uses).video : null);

  // The voice first: every line's length is known before the tape is written.
  log(`voice: ${typeof video.voice === 'string' ? video.voice : video.voice.name}, Kokoro through hyperframes tts`);
  const said = new Map();
  const say = (line) => { if (!said.has(line)) said.set(line, speak(line, video.voice)); return said.get(line); };
  const cols = Number((spec.terminal || '80x24').split('x')[0]);
  const lineMs = (step) => say(step.say).durationMs;
  const scenes = resolved.map((s) => (s.terminal ? { ...s, terminal: makeRoom(s.terminal, lineMs, { output: 'x.mp4', ps1: 'x.ps1', cols, ready: spec?.ready, setup: s.setup }) } : s));
  const hookV = video.hook.say ? say(video.hook.say) : null;
  const endV = video.end.say ? say(video.end.say) : null;

  const world = worldFor(name, spec, scenes, log);
  const recorded = await takes(dir, world, spec, scenes, log, { lineMs });

  const files = Object.fromEntries(recorded.map((s) => [s.clip, path.join(dir, s.clip)]));
  files['orr-logo.js'] = path.join(REPO, 'landing', 'orr-logo.js');
  const wav = (key, v) => { files[`${key}.wav`] = v.wav; return { src: `${key}.wav`, durationMs: v.durationMs }; };
  const hook = { text: video.hook.text, voice: hookV && wav('voice-hook', hookV) };
  const end = { text: video.end.text, voice: endV && wav('voice-end', endV) };
  const composed = recorded.map((s, i) => ({
    clip: s.clip,
    durationMs: s.durationMs,
    cues: s.cues,
    beats: s.events.filter((e) => e.step.say).map((e, j) => {
      const v = say(e.step.say);
      return { at: Math.round(e.at * s.scale), ...wav(`voice-${i}-${j}`, v), chunks: chunks(e.step.say, v.durationMs, v.words) };
    }),
  }));

  const outs = [];
  for (const aspect of Object.keys(ASPECTS)) {
    const out = path.join(dir, `${name}-${aspect}.mp4`);
    log(`compose: ${aspect}`);
    renderProject(path.join(dir, `project-${aspect}`), composeShowcase({ title: video.title, aspect, hook, end, scenes: composed }), files, out, draft);
    outs.push(out);
  }
  if (video.post) fs.writeFileSync(path.join(dir, 'post.txt'), `${video.post}\n`);
  log(`showcase: ${outs.map((o) => path.relative(REPO, o)).join(', ')}${video.post ? `, and post.txt (${video.post.length} characters; nothing is posted)` : ''}`);
  tidy(dir, [...outs.map((o) => path.basename(o)), 'post.txt'], [world], log);
  return { outs };
}

// A launch: 16:9 for YouTube and Product Hunt, 1:1 for X.
export const LAUNCH_ASPECTS = ['16x9', '1x1'];

/**
 * A motion launch: the page `video.motion` (authored HTML and GSAP, beside the script) is the composition. The voice
 * sets each beat's length; the terminal scenes are recorded live and played inside the page by their id. 16:9 only.
 */
async function renderMotion({ id, name, video }, { draft, log }) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  log(`voice: ${typeof video.voice === 'string' ? video.voice : video.voice.name}, Kokoro through hyperframes tts`);
  const files = { 'orr-logo.js': path.join(REPO, 'landing', 'orr-logo.js') };
  // the site's provider and agent marks, for the page to show by file name (ai-claude.svg, agent-codex.svg, ...)
  const brand = path.join(REPO, 'landing', 'brand');
  for (const f of fs.readdirSync(brand)) if (f.endsWith('.svg')) files[f] = path.join(brand, f);
  // the real apps, shot from their design/ boards first: a wrong selector fails here, before the takes cost anything
  let stills = {};
  if (video.stills) {
    log(`stills: ${video.stills.length} shots of design/ boards`);
    stills = await shootStills(video.stills, path.join(dir, 'stills'), log);
    for (const sid of Object.keys(stills)) files[`${sid}.png`] = path.join(dir, 'stills', `${sid}.png`);
  }
  const beats = {};
  let t = 0;
  for (const b of video.beats) {
    const v = b.say ? speak(b.say, video.voice) : null;
    if (v) files[`voice-${b.id}.wav`] = v.wav;
    const duration = beatMs(v, b.min ? ms(b.min) : 0);
    beats[b.id] = { start: t, duration, voice: v && { src: `voice-${b.id}.wav`, durationMs: v.durationMs, words: v.words } };
    t += duration;
  }
  const scenes = video.scenes ?? [];
  const world = worldFor(name, video.world, scenes, log);
  const takesById = {};
  for (const [i, s] of (await takes(dir, world, video.world, scenes, log)).entries()) {
    files[s.clip] = path.join(dir, s.clip);
    const marks = s.events.filter((e) => e.step.mark).map((e) => [e.step.mark, Math.round(e.at * s.scale)]);
    takesById[scenes[i].id] = { src: s.clip, marks: Object.fromEntries(marks) };
  }
  const page = fs.readFileSync(path.join(VIDEOS, 'scripts', id, video.motion), 'utf8');
  const out = path.join(dir, `${name}-16x9.mp4`);
  log(`compose: ${video.motion}, ${(t / 1000).toFixed(1)} s`);
  const project = path.join(dir, 'project-16x9');
  const fill = (sound) => fillMotion(page, { beats, takes: takesById, total: t, stills, sound });
  writeProject(project, fill(), files);
  // the soundtrack, when the page asks for one (window.SCORE, window.SFX): made from its cues, with the voice in it
  const cues = await readCues(project);
  if (cues.score.length || cues.sfx.length) {
    const voices = Object.values(beats).filter((b) => b.voice).map((b) => ({ file: path.join(project, b.voice.src), at: (b.start + LEAD_MS) / 1000 }));
    const { loudness } = soundtrack({ ...cues, voices, total: t / 1000 }, path.join(project, 'sound.wav'));
    fs.writeFileSync(path.join(project, 'index.html'), fill('sound.wav'));
    log(`sound: ${cues.score.length} moods and ${cues.sfx.length} effects synthesized under the voice (${loudness} LUFS, levelled to -15)`);
  }
  hyperframes(project, out, draft);
  if (video.post) fs.writeFileSync(path.join(dir, 'post.txt'), `${video.post}\n`);
  log(`launch: ${(t / 1000).toFixed(1)} s, ${path.relative(REPO, out)}${video.post ? ', and post.txt (nothing is posted)' : ''}; no music (no licensed track in the script)`);
  tidy(dir, [path.basename(out), 'post.txt'], [world], log);
  return { outs: [out] };
}

async function renderLaunch({ name, video }, { draft, log }) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const parts = launchParts(video, (id) => load(id).video);
  log(`voice: ${typeof video.voice === 'string' ? video.voice : video.voice.name}, Kokoro through hyperframes tts`);
  const said = new Map();
  const say = (line) => { if (!said.has(line)) said.set(line, speak(line, video.voice)); return said.get(line); };
  const files = { 'orr-logo.js': path.join(REPO, 'landing', 'orr-logo.js') };
  const wav = (key, v) => { files[`${key}.wav`] = v.wav; return { src: `${key}.wav`, durationMs: v.durationMs }; };

  const segments = [];
  const worlds = [];
  let recordedSoFar = 0;
  const lineMs = (step) => say(step.say).durationMs;
  for (const [k, p] of parts.entries()) {
    if (p.kind === 'card') {
      const v = p.say ? say(p.say) : null;
      const voice = v && wav(`voice-card${k}`, v);
      segments.push(p.card === 'cta'
        ? { kind: 'card', id: `card${k}`, logo: true, sub: p.text, voice, durationMs: cardMs(v, 2600, 1000) }
        : { kind: 'card', id: `card${k}`, title: p.text, sub: 'orrery', voice, durationMs: cardMs(v) });
      continue;
    }
    const cols = Number((p.world?.terminal || '80x24').split('x')[0]);
    const scenes = p.scenes.map((s) => (s.terminal ? { ...s, terminal: makeRoom(s.terminal, lineMs, { output: 'x.mp4', ps1: 'x.ps1', cols, ready: p.world?.ready, setup: s.setup }) } : s));
    log(`part ${k + 1}:`);
    const world = worldFor(`${name}-${k + 1}`, p.world, scenes, log);
    worlds.push(world);
    for (const s of await takes(dir, world, p.world, scenes, log, { first: recordedSoFar, lineMs })) {
      files[s.clip] = path.join(dir, s.clip);
      segments.push({
        kind: 'take', clip: s.clip, durationMs: s.durationMs, cues: s.cues,
        beats: s.events.filter((e) => e.step.say).map((e, j) => {
          const v = say(e.step.say);
          return { at: Math.round(e.at * s.scale), ...wav(`voice-${s.clip.replace('.mp4', '')}-${j}`, v), chunks: chunks(e.step.say, v.durationMs, v.words) };
        }),
      });
      recordedSoFar++;
    }
  }

  let music = null;
  if (video.music) {
    const src = `music${path.extname(video.music.track)}`;
    files[src] = path.join(VIDEOS, 'scripts', video.music.track);
    music = { src, volume: Number((10 ** (Number.parseFloat(video.music['under-voice'] ?? '-18dB') / 20)).toFixed(3)) };
  }
  const outs = [];
  for (const aspect of LAUNCH_ASPECTS) {
    const out = path.join(dir, `${name}-${aspect}.mp4`);
    log(`compose: ${aspect}`);
    renderProject(path.join(dir, `project-${aspect}`), composeSegments({ title: video.title, aspect, segments, music }), files, out, draft);
    outs.push(out);
  }
  if (video.post) fs.writeFileSync(path.join(dir, 'post.txt'), `${video.post}\n`);
  const total = segments.reduce((n, s) => n + s.durationMs, 0);
  log(`launch: ${(total / 1000).toFixed(1)} s, ${outs.map((o) => path.relative(REPO, o)).join(', ')}${video.post ? ', and post.txt (nothing is posted)' : ''}${music ? '' : '; no music (no licensed track in the script)'}`);
  tidy(dir, [...outs.map((o) => path.basename(o)), 'post.txt'], worlds, log);
  return { outs };
}

export async function render(id, { draft = false, log = console.error } = {}) {
  const loaded = load(id);
  const kind = loaded.video.kind;
  const launch = loaded.video.motion ? renderMotion : renderLaunch;
  return (kind === 'showcase' ? renderShowcase : kind === 'launch' ? launch : renderDemo)(loaded, { draft, log });
}
