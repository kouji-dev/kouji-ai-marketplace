// node --test videos/pipeline/test/
// The pure parts of the pipeline: lint, the tape and its timeline, zoom, captions, the composition, replies.
// Nothing here records or renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { lint, load } from '../stages/check.mjs';
import { FRAME, compile, zoomFor, zoomToBox, fontFor, TYPING_MS, TYPED_MS, BEAT_MS, MODE_KEY_MS, WAIT_SHOW_MS, AFTER_WAIT_MS, REPLY_TIMEOUT } from '../surfaces/terminal.mjs';
import { compose, cues, composeShowcase, composeSegments, fillMotion, beatMs, ASPECTS, BAND } from '../stages/compose.mjs';
import { resolveShowcase, makeRoom, launchParts } from '../stages/showcase.mjs';
import { chunks, voiceOf } from '../stages/voice.mjs';
import { repliesToStreams, streamMs } from '../stages/replies.mjs';
import { worldPs1, sandboxEnv, configProblem, mergeConfig, worldsDir, worldModel, modelToml, DEFAULT_MODEL, pruneTemplates } from '../stages/world.mjs';
import { staleness } from '../cli.mjs';
import { playwrightKey, isRemote } from '../surfaces/app.mjs';
import { REPO, VIDEOS } from '../paths.mjs';

// This plugin ships the pipeline without Orrery's own scripts and boards: the tests that read them skip without them.
const NO_SCRIPTS = fs.existsSync(path.join(VIDEOS, 'scripts', 'demos', 'extensions-install', 'video.yaml'))
  ? false : 'needs the docs clips of the repository the pipeline runs in';
const NO_BOARDS = fs.existsSync(path.join(REPO, 'design', 'ade', 'ade.dc.html')) ? false : "needs that repository's design/ boards";
import { boardSize } from '../surfaces/board.mjs';
import { mix, moodAt, MOODS, chordSegments, soundProblems, wav, SR, demoSound } from '../stages/sound.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = (name) => fs.readFileSync(path.join(here, 'golden', name), 'utf8').replace(/\r\n/g, '\n');
const demo = (over = {}) => ({ kind: 'demo', title: 'A clip', docs: 'extend/install.md', world: { home: 'fresh' }, scenes: [{ terminal: [{ run: 'orrery' }] }], ...over });

test('lint: a good script passes; each mistake names where and the fix', () => {
  assert.deepEqual(lint(demo()), []);
  assert.match(lint({ ...demo(), kind: 'film' }).join('\n'), /kind/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ type: 'a', key: 'Enter' }] }] })).join('\n'), /scenes\[0\]\.terminal\[0\]: one action per step .* split it/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ vhs: 'Sleep 1s' }] }] })).join('\n'), /needs `seconds:`/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ click: 'Save' }] }] })).join('\n'), /app step/);
  assert.match(lint(demo({ scenes: [{ app: [{ click: 'Save' }] }] })).join('\n'), /an app scene opens a page: url:/);
  assert.deepEqual(lint(demo({ scenes: [{ url: '/', app: [{ click: 'Install', zoom: 'target' }, { scroll: 600 }, { key: 'Down' }, { zoom: 'off', pause: '1s' }] }] })), []);
  assert.match(lint(demo({ scenes: [{ url: '/', app: [{ run: 'orrery' }] }] })).join('\n'), /run is a terminal step; an app takes click/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ scroll: 300 }] }] })).join('\n'), /scroll is an app step/);
  assert.match(lint(demo({ scenes: [{ url: '/', app: [{ type: 'hi', zoom: 'target' }] }] })).join('\n'), /zoom: target eases in on what a click or a fill touches/);
  assert.match(lint(demo({ docs: undefined })).join('\n'), /docs: a demo names/);
  assert.match(lint(demo({ kind: 'launch', docs: undefined })).join('\n'), /voice: a launch is spoken/);
  assert.match(lint(demo({ scenes: [{ card: 'hook', text: 'Hi' }] })).join('\n'), /card scenes belong to a launch/);
  // a docs clip speaks (decision 0038): a line alone is fine, a caption without its line is not
  assert.deepEqual(lint(demo({ scenes: [{ terminal: [{ type: 'x', say: 'Hello.' }] }] })), []);
  assert.match(lint(demo({ scenes: [{ terminal: [{ type: 'x', caption: 'Type x' }] }] })).join('\n'), /scenes\[0\]\.terminal\[0\]: a docs clip speaks every captioned step: add say:/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ type: 'x', caption: 'y'.repeat(71) }] }] })).join('\n'), /caption/);
  assert.match(lint(demo({ scenes: [{ terminal: [{ key: 'Down', zoom: 'rows 2-5 cols 1-40' }] }] })).join('\n') || 'ok', /ok/);
});

test('lint: the docs page must embed the clip', () => {
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'videos-docs-'));
  fs.mkdirSync(path.join(docs, 'extend'));
  fs.writeFileSync(path.join(docs, 'extend', 'install.md'), '# Install\n');
  assert.match(lint(demo(), { docsRoot: docs, id: 'demos/a-clip' }).join('\n'), /does not embed the clip; add !\[A clip\]\(\.\.\/media\/a-clip\.mp4\)/);
  fs.writeFileSync(path.join(docs, 'extend', 'install.md'), '# Install\n\n![A clip](../media/a-clip.mp4)\n');
  assert.deepEqual(lint(demo(), { docsRoot: docs, id: 'demos/a-clip' }), []);
});

test('the repository\'s own scripts pass check', { skip: NO_SCRIPTS }, () => {
  assert.equal(load('extensions-install').name, 'extensions-install');
});

test('tape: the compiled tape matches its golden file', { skip: NO_SCRIPTS }, () => {
  const video = parse(fs.readFileSync(path.join(here, '..', '..', 'scripts', 'demos', 'extensions-install', 'video.yaml'), 'utf8'));
  const { tape } = compile(video.scenes[0].terminal, { output: 'scene-1.mp4', ps1: 'C:/world/world.ps1', cols: 100 });
  assert.equal(tape, golden('extensions-install.tape'));
});

test('tape: a setup that ends at the shell prompt is cleared before the clip; one that opens the TUI is not', () => {
  const shown = (tape) => tape.slice(0, tape.lastIndexOf('\nShow'));
  const shell = compile([{ pause: '1s' }], { output: 'x.mp4', ps1: 'w.ps1', setup: [{ run: 'echo hi', until: 'hi' }] }).tape;
  assert.match(shown(shell), /Type "cls"\nEnter\nSleep 500ms$/);
  const tui = compile([{ pause: '1s' }], { output: 'x.mp4', ps1: 'w.ps1', setup: [{ run: 'orrery' }, { type: 'hi' }, { key: 'Enter' }, { reply: '0s' }] }).tape;
  assert.doesNotMatch(shown(tui), /Type "cls"\nEnter\nSleep 500ms$/);
});

test('timeline: every visible action is counted, waits show WAIT_SHOW then cut', () => {
  const { events, durationMs, tape } = compile([
    { run: 'orrery' },
    { type: 'abc', caption: 'one' },
    { key: 'Down 2' },
    { key: 'Escape' },
    { wait: 'Done' },
    { pause: '1.5s' },
  ], { output: 'x.mp4', ps1: 'w.ps1' });
  const run = 6 * TYPING_MS + TYPING_MS + WAIT_SHOW_MS + AFTER_WAIT_MS;
  assert.deepEqual(events.map((e) => e.at), [
    0,
    run,
    run + 3 * TYPING_MS + TYPED_MS,
    run + 3 * TYPING_MS + TYPED_MS + 2 * TYPING_MS + BEAT_MS,
    run + 3 * TYPING_MS + TYPED_MS + 2 * TYPING_MS + BEAT_MS + TYPING_MS + MODE_KEY_MS,
    run + 3 * TYPING_MS + TYPED_MS + 2 * TYPING_MS + BEAT_MS + TYPING_MS + MODE_KEY_MS + WAIT_SHOW_MS + AFTER_WAIT_MS,
  ]);
  assert.equal(durationMs, events[5].at + 1500);
  // The variable part of a wait is hidden: it never adds to the visible time.
  assert.match(tape, /Hide\nWait\+Screen@30s \/Done\/\nShow/);
  // A bare orrery waits for the built session (the hint), not the placeholder that shows while extensions start.
  assert.match(tape, /Wait\+Screen@60s \/enter send\//);
});

test('reply: a live turn shows a fixed slice, then cuts to its end; all hidden in setup', () => {
  const { tape, events, durationMs } = compile([{ key: 'Enter' }, { reply: '5s', caption: 'live' }, { pause: '1s' }], { output: 'x.mp4', ps1: 'w.ps1' });
  assert.ok(tape.includes(`Hide\nWait+Screen@60s /Turn running/\nShow\nSleep 4600ms\nSleep 400ms\nHide\nWait+Screen@${REPLY_TIMEOUT} /enter send/\nShow\nSleep 800ms`), tape);
  assert.equal(events[2].at - events[1].at, 5000 + AFTER_WAIT_MS);
  assert.equal(durationMs, events[2].at + 1000);
  const setup = compile([{ pause: '1s' }], { output: 'x.mp4', ps1: 'w.ps1', setup: [{ run: 'orrery' }, { type: 'hi' }, { key: 'Enter' }, { reply: '0s' }] });
  assert.equal(setup.durationMs, 1000);
  assert.ok(setup.tape.includes(`Wait+Screen@60s /Turn running/\nSleep 400ms\nWait+Screen@${REPLY_TIMEOUT} /enter send/\nSleep 800ms\nShow`), setup.tape);
});

test('tape: a letter key is typed, Ctrl keys pass through, quotes are kept', () => {
  const { tape } = compile([{ key: 'i' }, { key: 'Ctrl+C' }, { type: 'say "hi"' }], { output: 'x.mp4', ps1: 'w.ps1' });
  assert.match(tape, /Type "i"\n/);
  assert.match(tape, /\nCtrl\+C\n/);
  assert.match(tape, /Type `say "hi"`/);
});

test('zoom: a band is scaled to fit, centred, never past the frame', () => {
  assert.equal(fontFor(100), 30);
  const z = zoomFor('rows 21-25 cols 1-80', 30, 100);
  assert.deepEqual(z, { scale: 1.201, x: 193, y: -121 });
  const top = zoomFor('rows 1-3 cols 1-20', 30, 100);
  assert.equal(top.scale, 2); // capped
  assert.ok(Math.abs(top.x) <= (top.scale - 1) * 960 && Math.abs(top.y) <= (top.scale - 1) * 600);
  assert.equal(zoomFor('the middle', 30), null);
});

test('fillMotion times beats, places takes at their marks, adds the voices; a missing beat or mark fails by name', () => {
  const page = '<head></head><div data-duration="{{total}}"><section class="clip" data-beat="a"></section><video class="clip" data-beat="b" data-take="s" data-from="m"></video><!--voices--></div>';
  const beats = { a: { start: 0, duration: 2000, voice: { src: 'voice-a.wav', durationMs: 1500, words: [{ text: 'Hi', start: 0.1 }] } }, b: { start: 2000, duration: 3000 } };
  const html = fillMotion(page, { beats, takes: { s: { src: 'scene-1.mp4', marks: { m: 4250 } } }, total: 5000 });
  assert.match(html, /data-duration="5"/);
  assert.match(html, /data-beat="a" data-start="0" data-duration="2"/);
  assert.match(html, /data-beat="b" data-start="2" data-duration="3" data-take="s" data-from="m" src="scene-1.mp4" data-media-start="4.25" muted playsinline/);
  assert.match(html, /<audio id="v-a" class="clip" src="voice-a.wav" data-start="0.4" data-duration="1.5"/);
  assert.match(html, /window\.BEATS = \{"a":\{"start":0,"duration":2,"words":\[\["Hi",0.5\]\]\}/);
  assert.match(html, /window\.MARKS = \{"s":\{"m":4.25\}\}/);
  assert.match(html, /window\.STILLS = \{\};/);
  const shot = { ade: { w: 1440, h: 908, find: { rows: [[1, 194, 251, 42]] } } };
  assert.match(fillMotion(page, { beats, takes: { s: { src: 'x', marks: { m: 1 } } }, total: 1, stills: shot }), /window\.STILLS = \{"ade":\{"w":1440,"h":908,"find":\{"rows":\[\[1,194,251,42\]\]\}\}\};/);
  // with a soundtrack the page carries one track, which already holds the voice
  const one = fillMotion(page, { beats, takes: { s: { src: 'x', marks: { m: 1 } } }, total: 5000, sound: 'sound.wav' });
  assert.match(one, /<audio id="sound" class="clip" src="sound\.wav" data-start="0" data-duration="5" data-volume="1" data-track-index="9"><\/audio>/);
  assert.doesNotMatch(one, /id="v-a"/);
  assert.throws(() => fillMotion(page, { beats: { a: beats.a }, takes: {}, total: 1 }), /beat b/);
  assert.throws(() => fillMotion(page, { beats, takes: { s: { src: 'x', marks: {} } }, total: 1 }), /mark: m/);
  assert.equal(beatMs({ durationMs: 1000 }, 0), 1850);
  assert.equal(beatMs(null, 3000), 3000);
});

test('pruneTemplates drops world templates of another build and keeps this one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worlds-'));
  const make = (name, ready) => { fs.mkdirSync(path.join(dir, name)); if (ready) fs.writeFileSync(path.join(dir, name, 'ready'), ready); };
  make('now', JSON.stringify({ stamp: 42 }));
  make('old', JSON.stringify({ stamp: 41 }));
  make('legacy', '2026-11-09T00:00:00.000Z');
  make('half', null);
  pruneTemplates(dir, 42);
  assert.deepEqual(fs.readdirSync(dir), ['now']);
  fs.rmSync(dir, { recursive: true });
});

test('app: keys as Playwright names them; zoom: target eases in on the clicked box; a page is local or https', () => {
  assert.equal(playwrightKey('Down'), 'ArrowDown');
  assert.equal(playwrightKey('Ctrl+K'), 'Control+K');
  assert.equal(playwrightKey('Enter'), 'Enter');
  assert.ok(isRemote('https://getorrery.dev/') && !isRemote('/docs/'));
  // A button near the top right: scaled up to 2x at most, shifted towards the middle, never past the frame's edge.
  const z = zoomToBox({ x: 1718, y: 18, w: 100, h: 54 });
  assert.deepEqual(z, { scale: 2, x: -1920 / 2, y: 600 });
  const c = cues([{ at: 1200, step: { click: 'Install', zoom: 'target' }, box: { x: 1718, y: 18, w: 100, h: 54 } }, { at: 3000, step: { zoom: 'target' }, box: null }], 5000, { font: 30 });
  assert.deepEqual(c.zooms, [{ at: 1.2, scale: 2, x: -960, y: 600 }]);
});

test('captions run to the next caption; null clears; the calibration scales them', () => {
  const events = [
    { at: 0, step: { caption: 'one' } },
    { at: 1000, step: { zoom: 'rows 1-5' } },
    { at: 2000, step: { caption: 'two' } },
    { at: 3000, step: { caption: null } },
    { at: 4000, step: { zoom: 'off' } },
  ];
  const c = cues(events, 5000, { scale: 1.1, font: 30 });
  assert.deepEqual(c.captions, [{ text: 'one', start: 0, duration: 2.2 }, { text: 'two', start: 2.2, duration: 1.1 }]);
  assert.equal(c.zooms.length, 2);
  assert.equal(c.zooms[0].at, 1.1);
  assert.deepEqual(c.zooms[1], { at: 4.4, scale: 1, x: 0, y: 0 });
});

test('compose: the composition matches its snapshot', () => {
  const scenes = [{ clip: 'scene-1.mp4', durationMs: 6000, cues: { captions: [{ text: 'Type <this>', start: 0.5, duration: 3 }], zooms: [{ at: 2, scale: 1.2, x: 10, y: -20 }] } }];
  assert.equal(compose({ title: 'A clip', scenes }).replace(/\r\n/g, '\n'), golden('compose.html'));
});

test('replies: one stream per reply; text streams in chunks; a tool call ends its turn; nothing is still one answer', () => {
  const streams = repliesToStreams([{ text: 'Three crates: proto, provider and kernel.' }, { text: 'Reading.', tool: 'builtin.read', input: { path: 'Cargo.toml' } }]);
  assert.equal(streams.length, 2);
  const [a, b] = streams.map((s) => s.trim().split('\n').map((l) => JSON.parse(l)));
  assert.equal(a[0].t, 'started');
  assert.equal(a.filter((l) => l.t === 'text-delta').map((l) => l.text).join(''), 'Three crates: proto, provider and kernel.');
  assert.equal(a.at(-1).stop, 'end-turn');
  assert.equal(b.find((l) => l.t === 'text-delta').text, 'Reading.');
  assert.equal(b.at(-1).stop, 'tool-use');
  assert.equal(JSON.parse(b.find((l) => l.t === 'tool-use-delta').json_fragment).path, 'Cargo.toml');
  assert.match(repliesToStreams([])[0], /"text":"Ready\."/);
  assert.equal(streamMs('x'.repeat(24)), 56);
});

test('world: a fixture world keeps no key and forces bare orrery onto its replies', () => {
  const env = sandboxEnv('C:\\w\\home', { PATH: 'p', ANTHROPIC_API_KEY: 'sk', OPENAI_API_KEY: 'sk', ORRERY_HOME: 'x', ORRERY_ENDPOINT: 'y' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'ORRERY_GRAPHICS', 'PATH', 'ProgramData', 'USERPROFILE']);
  const ps1 = worldPs1({ root: 'C:\\w', workspace: 'sample-rust', replies: 1 });
  assert.ok(ps1.includes("-match '_API_KEY$|^ORRERY_|^CARGO_TARGET_DIR$' }"), ps1);
  assert.match(ps1, /--provider 'fixture:C:\\w\\reply-1\.jsonl'/);
  assert.match(worldPs1({ root: 'C:\\w', workspace: 's', replies: 2 }), /reply-1\.jsonl' --provider 'fixture:C:\\w\\reply-2\.jsonl'/);
  assert.match(ps1, /PredictionSource None/);
  assert.match(ps1, /function global:prompt \{ '> ' \}/);
  // cargo keeps the person's toolchain once USERPROFILE moves: pinned before it does.
  assert.ok(ps1.indexOf('RUSTUP_HOME') < ps1.indexOf('$env:USERPROFILE = '));
});

test('world: with no replies a take runs a real model, keeping only its key; the model is set in config', () => {
  assert.equal(DEFAULT_MODEL, 'anthropic:claude-haiku-5-5');
  assert.deepEqual(worldModel({ home: 'fresh' }), { provider: 'anthropic', model: 'claude-haiku-5-5', key: 'ANTHROPIC_API_KEY' });
  assert.deepEqual(worldModel({ model: 'openai-compat:llama-3.3-70b' }), { provider: 'openai-compat', model: 'llama-3.3-70b', key: 'OPENAI_COMPAT_API_KEY' });
  assert.equal(worldModel({ replies: [{ text: 'hi' }] }), null);
  const ps1 = worldPs1({ root: 'C:\\w', workspace: 's', key: 'ANTHROPIC_API_KEY' });
  assert.ok(ps1.includes("-and $_.Name -ne 'ANTHROPIC_API_KEY' }"), ps1);
  assert.doesNotMatch(ps1, /--provider/);
  const toml = modelToml(worldModel({}));
  assert.ok(toml.includes('[providers]\ndefault = "anthropic"\n\n[providers.anthropic]\nmodel = "claude-haiku-5-5"\n'), toml);
  assert.match(toml, /maxUsd = 0\.25/);
  assert.doesNotMatch(toml, /apiKey/);
  assert.match(lint(demo({ world: { model: 'anthropic:x', replies: [{ text: 'a' }] } })).join('\n'), /model and replies exclude each other/);
  assert.match(lint(demo({ world: { model: 'haiku' } })).join('\n'), /model/);
  assert.deepEqual(lint(demo({ scenes: [{ terminal: [{ reply: '4s', caption: 'live', say: 'It answers live.' }] }] })), []);
});

test('world: extra config merges into a table the install already wrote', () => {
  const base = '[extensions.acp]\nsource = "a"\n\n[extensions.git]\nsource = "g"\n';
  const out = mergeConfig(base, '[extensions.git]\ndeferred = true\n\n[permissions]\nask = ["x"]\n');
  assert.equal(out.match(/\[extensions\.git\]/g).length, 1);
  assert.match(out, /\[extensions\.git\]\ndeferred = true\nsource = "g"/);
  assert.match(out, /\n\n\[permissions\]\nask = \["x"\]\n$/);
  assert.match(mergeConfig(base, '[extensions.acp]\nx = 1'), /^\[extensions\.acp\]\nx = 1\nsource = "a"/);
});

test('world: extra config sets rules, never a provider, key or registry; takes run under a neutral root', () => {
  assert.equal(configProblem('[permissions]\nask = ["write(./**)"]\n'), null);
  for (const bad of ['[providers.anthropic]\nmodel = "x"', 'providers.default = "anthropic"', 'apiKey = "sk"', '[registry]\nindex = "x"']) assert.ok(configProblem(bad), bad);
  assert.equal(worldsDir({ ORRERY_VIDEOS_WORLDS: 'D:\\w' }), 'D:\\w');
  assert.doesNotMatch(worldsDir({}), /Users|home/i);
});

test('showcase: lint asks for a voice and both cards, and one line per beat of the demo it uses', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'videos-show-'));
  fs.mkdirSync(path.join(root, 'demos', 'a'), { recursive: true });
  fs.writeFileSync(path.join(root, 'demos', 'a', 'video.yaml'), 'kind: demo\ntitle: A clip\nscenes:\n  - terminal:\n      - type: x\n        caption: one\n      - key: Enter\n      - pause: 1s\n        caption: two\n');
  const show = (over = {}) => ({ kind: 'showcase', title: 'A day', voice: 'af_heart', uses: 'demos/a', hook: { text: 'Hook' }, end: { text: 'getorrery.dev' }, say: ['One.', 'Two.'], ...over });
  assert.deepEqual(lint(show(), { root }), []);
  assert.match(lint(show({ say: ['One.'] }), { root }).join('\n'), /demos\/a has 2 captioned beats; give one line for each \(has 1\)/);
  assert.match(lint(show({ voice: undefined, hook: undefined }), { root }).join('\n'), /voice: a showcase is spoken[\s\S]*hook: a showcase opens/);
  assert.match(lint(show({ uses: 'demos/gone' }), { root }).join('\n'), /no videos\/scripts\/demos\/gone/);
  assert.match(lint(show({ uses: undefined, say: undefined }), { root }).join('\n'), /takes a demo \(uses: demos\/<id>\) or has its own world and scenes/);
});

test('showcase: uses puts each line on its beat; makeRoom pads a beat shorter than its line', () => {
  const used = { world: { home: 'fresh' }, scenes: [{ terminal: [{ type: 'abc', caption: 'one' }, { key: 'Enter' }, { pause: '1s', caption: 'two' }] }] };
  const { world, scenes } = resolveShowcase({ uses: 'demos/a', say: ['First line.', 'Second line.'] }, used);
  assert.equal(world.home, 'fresh');
  assert.deepEqual(scenes[0].terminal, [{ type: 'abc', say: 'First line.' }, { key: 'Enter' }, { pause: '1s', say: 'Second line.' }]);
  // Beat one is typing 3 characters, 0.9 s, then Enter's press and beat: 135 + 900 + 45 + 400 = 1480 ms. A 3 s line needs
  // 3000 + GAP_MS: the pause goes right before beat two. Beat two (1 s) gets room for its 2 s line at the end.
  const lines = { 'First line.': 3000, 'Second line.': 2000 };
  const roomy = makeRoom(scenes[0].terminal, (s) => lines[s.say], { output: 'x.mp4', ps1: 'w.ps1' });
  assert.deepEqual(roomy.map((s) => s.pause ?? Object.keys(s)[0]), ['type', 'key', '2100ms', '1s', '1500ms']);
  const fits = makeRoom(scenes[0].terminal, () => 100, { output: 'x.mp4', ps1: 'w.ps1' });
  assert.equal(fits.length, 3);
});

test('launch: cards and takes in order; a uses: scene speaks one line from its first step, or one per beat', () => {
  const demo2 = { world: { home: 'fresh' }, scenes: [{ setup: [{ run: 'orrery' }], terminal: [{ type: 'a', caption: 'one' }, { key: 'Enter' }, { pause: '1s', caption: 'two' }] }] };
  const parts = launchParts({
    kind: 'launch',
    world: { home: 'fresh', workspace: 'w' },
    scenes: [
      { card: 'hook', text: 'Your rules.', say: 'Make them.' },
      { uses: 'demos/x', say: 'One line over all of it.' },
      { uses: 'demos/x', say: ['First.', 'Second.'] },
      { terminal: [{ run: 'orrery', caption: 'shown' }, { type: 'hi', say: 'Hi.' }] },
      { card: 'cta', text: 'getorrery.dev' },
    ],
  }, (id) => { assert.equal(id, 'demos/x'); return demo2; });
  assert.deepEqual(parts.map((p) => p.kind), ['card', 'take', 'take', 'take', 'card']);
  assert.deepEqual(parts[0], { kind: 'card', card: 'hook', text: 'Your rules.', say: 'Make them.' });
  assert.deepEqual(parts[1].scenes[0].terminal.map((s) => s.say), ['One line over all of it.', undefined, undefined]);
  assert.deepEqual(parts[1].scenes[0].setup, [{ run: 'orrery' }]);
  assert.deepEqual(parts[2].scenes[0].terminal.map((s) => s.say), ['First.', undefined, 'Second.']);
  // Its own terminal scene runs in the video's world, its captions dropped: the spoken words are the captions.
  assert.equal(parts[3].world.workspace, 'w');
  assert.deepEqual(parts[3].scenes[0].terminal, [{ run: 'orrery' }, { type: 'hi', say: 'Hi.' }]);
  assert.equal(parts[4].say, null);
  const html = composeSegments({ title: 't', aspect: '1x1', music: { src: 'music.mp3', volume: 0.126 }, segments: [
    { kind: 'card', id: 'card0', title: 'Your rules.', sub: 'orrery', voice: { src: 'v.wav', durationMs: 1000 }, durationMs: 2200 },
    { kind: 'take', clip: 'scene-1.mp4', durationMs: 5000, cues: { zooms: [] }, beats: [] },
    { kind: 'card', id: 'card2', logo: true, sub: 'getorrery.dev', durationMs: 2600 },
  ] });
  assert.match(html, /<audio id="music" class="clip" src="music\.mp3" data-start="0" data-duration="9\.8" data-volume="0\.126" data-fade-in="1" data-fade-out="2"/);
  assert.match(html, /<div id="card2" class="card clip" data-start="7\.2" data-duration="2\.6"[^>]*><orr-logo class="card-logo"/);
  assert.match(lint({ kind: 'launch', title: 'A launch', voice: 'af_heart', scenes: [{ card: 'hook' }] }).join('\n'), /a card shows text/);
});

test('stills: a board is shot only for a motion page, from a board that exists, one id each; the size comes from the board', { skip: NO_BOARDS }, () => {
  const motion = { kind: 'launch', title: 'A launch', voice: 'af_heart', motion: 'motion.html', world: { home: 'fresh' }, beats: [{ id: 'a', say: 'Hi.' }], scenes: [{ id: 's', terminal: [{ run: 'orrery' }] }] };
  const ade = { id: 'ade', board: 'ade/ade', start: 'agent', click: 'Allow once', hide: ['.rail-row'], find: { rows: '.rail-row' }, text: { VECTORGP66: 'workstation' } };
  assert.deepEqual(lint({ ...motion, stills: [ade] }), []);
  assert.match(lint({ ...motion, stills: [{ id: 'x', board: 'no/such-page#app' }] }).join('\n'), /stills\[0\]: no board design\/no\/such-page\.dc\.html/);
  assert.match(lint({ ...motion, stills: [ade, ade] }).join('\n'), /two shots are called ade/);
  assert.match(lint({ ...motion, motion: undefined, stills: [ade] }).join('\n'), /stills: .* add motion:/);
  assert.deepEqual(boardSize(`<script data-props='{"$preview":{"width":390,"height":844}}'>`), { w: 390, h: 844 });
  assert.deepEqual(boardSize('<html></html>'), { w: 1440, h: 908 });
});

test('sound: moods and chords follow the score; a wrong cue is named; the mix is the same twice and never clips', () => {
  const score = [{ at: 0, mood: 'dark' }, { at: 3, mood: 'drive' }];
  assert.equal(moodAt(score, 2.9), MOODS.dark);
  assert.equal(moodAt(score, 3), MOODS.drive);
  // a bar is 2.4 s at 100 BPM: dark holds Am over its first two bars; drive starts its own bars and its progression
  // (F, C, …) at 3 s, where the picture cuts, not on the old bar line
  assert.deepEqual(chordSegments(score, 6).map((s) => [s.s, s.e, s.chord]), [[0, 3, 'Am'], [3, 5.4, 'F'], [5.4, 6, 'C']]);
  assert.deepEqual(soundProblems({ score: [{ at: 0, mood: 'loud' }], sfx: [{ name: 'boing', at: 1 }, { name: 'hit', at: 9 }] }, 5).map((p) => p.split(' ').slice(0, 2).join(' ')),
    ['SCORE: mood', 'SFX: boing', 'SFX: hit']);
  assert.throws(() => mix({ score: [{ at: 0, mood: 'loud' }], total: 1 }), /mood loud at 0 s is not one of open, dark/);
  const cues = { score, sfx: [{ name: 'hit', at: 0.5, gain: 1 }, { name: 'swirl', at: 1 }, { name: 'pluck', at: 1.5, pitch: 3, pan: -1 }], total: 2 };
  const [L, R] = mix(cues), [L2] = mix(cues);
  assert.equal(L.length, 2 * SR);
  assert.ok(L.every((x, i) => x === L2[i]), 'seeded: the same cues make the same track');
  const peak = [...L, ...R].reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  assert.ok(peak > 0.05 && peak <= 10 ** (-1 / 20) + 1e-6, `the limiter holds -1 dBFS, and there is sound (peak ${peak})`);
  const head = wav([new Float32Array(3), new Float32Array(3)]);
  assert.deepEqual([head.toString('ascii', 0, 4), head.readUInt16LE(20), head.readUInt16LE(22), head.readUInt32LE(24), head.length], ['RIFF', 3, 2, SR, 44 + 24]);
});

test('demoSound: every docs clip gets the same sound from its steps: keys, taps, pops, air on a zoom, a chime', () => {
  const scenes = [{ durationMs: 6000, scale: 1, events: [
    { at: 0, step: { type: 'ab', caption: 'Type it', say: 'Type it.' } },
    { at: 1000, step: { key: 'Enter' } },
    { at: 2000, step: { pause: '1s', zoom: 'rows 1-3 cols 1-20' } },
    { at: 3000, step: { pause: '1s', zoom: 'off' } },
    { at: 4000, step: { click: 'Install' } },
  ] }];
  const { score, sfx } = demoSound(scenes);
  assert.deepEqual(score, [{ at: 0, mood: 'focus' }]);
  assert.deepEqual(sfx.map((c) => [c.name, c.at]), [['whoosh-up', 0], ['key', 0], ['key', TYPING_MS / 1000], ['pop', 0], ['key', 1], ['whoosh', 2], ['whoosh-down', 3], ['tap', 4.7], ['success', 4.6]]);
  assert.deepEqual(soundProblems({ score, sfx }, 6), []);
  // a second take starts where the first ends, and a short clip gets no chime
  assert.equal(demoSound([{ durationMs: 2000, scale: 1, events: [] }, { durationMs: 1000, scale: 2, events: [{ at: 100, step: { key: 'y' } }] }]).sfx.map((c) => `${c.name}@${c.at}`).join(' '), 'whoosh-up@0 key@2.2');
});

test('voice: captions come in groups of words, timed by the transcript when it lines up, else by length', () => {
  const words = [{ start: 0, end: 0.2 }, { start: 0.4, end: 0.8 }, { start: 0.8, end: 1.6 }, { start: 1.6, end: 1.9 }, { start: 1.9, end: 2.1 }];
  assert.deepEqual(chunks('Type slash context. Every part', 2500, words, 3), [{ text: 'Type slash context.', start: 0, end: 1600 }, { text: 'Every part', start: 1600, end: 2500 }]);
  const guessed = chunks('aaa bbb ccc ddd', 1600, null, 2);
  assert.deepEqual(guessed.map((c) => [c.text, c.start, c.end]), [['aaa bbb', 0, 800], ['ccc ddd', 800, 1600]]);
  // Groups end where the sentence does, or at a comma once they have three words: never "…in tokens. The".
  assert.deepEqual(chunks('Every part of the window, in tokens. The prompt, the tools, the results, the messages.', 5000).map((c) => c.text),
    ['Every part of the window,', 'in tokens.', 'The prompt, the tools,', 'the results, the messages.']);
  assert.deepEqual(voiceOf('af_heart'), { name: 'af_heart', speed: 1 });
  assert.deepEqual(voiceOf({ name: 'am_adam', speed: 0.95 }), { name: 'am_adam', speed: 0.95 });
});

test('showcase compose: cards, the take in its box, the voice and its captions, per aspect', () => {
  const scenes = [{ clip: 'scene-1.mp4', durationMs: 8000, cues: { zooms: [{ at: 2, scale: 1.5, x: 100, y: -50 }] }, beats: [{ at: 500, src: 'v0.wav', durationMs: 1500, chunks: [{ text: 'one <two>', start: 0, end: 700 }, { text: 'three', start: 700, end: 1500 }] }] }];
  const html = composeShowcase({ title: 't', aspect: '9x16', hook: { text: 'Hook', voice: { src: 'h.wav', durationMs: 2000 } }, end: { text: 'getorrery.dev' }, scenes });
  // The hook lasts its line plus room: 2000 + 400 + 700 = 3.1 s; the take starts there.
  assert.match(html, /<audio id="v-hook" class="clip" src="h\.wav" data-start="0\.4" data-duration="2"/);
  assert.match(html, /<div id="w0" class="clip" data-start="3\.1" data-duration="8"[^>]*><div class="box"><video id="s0" class="take clip" src="scene-1\.mp4" muted playsinline data-start="3\.1"/);
  assert.match(html, /<audio id="v0-0" class="clip" src="v0\.wav" data-start="3\.6" data-duration="1\.5"/);
  assert.match(html, /<div id="c0" class="caption clip" data-start="3\.6" data-duration="0\.7" data-track-index="4"><span>one &lt;two&gt;<\/span>/);
  assert.match(html, /<div id="c1" class="caption clip" data-start="4\.3" data-duration="0\.8"/);
  // A zoom shift is in the take's own pixels: 1080 / 1920 of the frame's.
  assert.match(html, /tl\.to\("#s0", \{ scale: 1\.5, x: 56, y: -28/);
  assert.match(html, /id="t0" class="title clip" data-start="3\.1"/);
  assert.match(html, /<div id="end" class="card clip" data-start="11\.1" data-duration="2\.6"[^>]*><orr-logo class="card-logo" wordmark/);
  assert.match(html, /data-composition-id="main" data-start="0" data-duration="13\.7" data-width="1080" data-height="1920"/);
  const wide = composeShowcase({ title: 't', aspect: '16x9', hook: { text: 'Hook' }, end: { text: 'x' }, scenes });
  assert.doesNotMatch(wide, /class="title clip"/);
  assert.match(wide, /left: 192px; top: 24px; width: 1536px; height: 960px;[^}]*border: 2px solid var\(--hair\)/);
  assert.doesNotMatch(wide, /<audio id="v-hook"/);
  for (const [name, a] of Object.entries(ASPECTS)) {
    assert.equal(a.box.w / a.box.h, 1.6, `${name}: the take keeps 16:10`);
    assert.ok(a.caption.top >= a.box.y + a.box.h, `${name}: the caption sits under the take, never over the input row`);
  }
});

test('stale: a changed script or an older minor version makes a clip stale', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'videos-stale-'));
  const scripts = path.join(root, 'scripts');
  const media = path.join(root, 'media');
  fs.mkdirSync(path.join(scripts, 'demos', 'a'), { recursive: true });
  fs.mkdirSync(media);
  fs.writeFileSync(path.join(scripts, 'demos', 'a', 'video.yaml'), 'kind: demo\n');
  assert.equal(staleness('demos/a', { media, scripts }), 'never rendered');
  const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
  fs.writeFileSync(path.join(media, 'a.json'), JSON.stringify({ script: hash('kind: demo\n'), orrery: '0.3.6' }));
  assert.equal(staleness('demos/a', { media, scripts, current: '0.3.9' }), null);
  assert.match(staleness('demos/a', { media, scripts, current: '0.4.0' }), /made by 0\.3\.6/);
  fs.writeFileSync(path.join(scripts, 'demos', 'a', 'video.yaml'), 'kind: demo\ntitle: x\n');
  assert.equal(staleness('demos/a', { media, scripts }), 'script changed');
});

test('follow: the camera frames the text on screen, and leaves a full-screen app whole', async () => {
  const { contentBox, followZooms, SAMPLE } = await import('../stages/follow.mjs');
  const { width, height } = SAMPLE;
  const screen = (x0, y0, x1, y1) => {
    const px = new Uint8Array(width * height).fill(20);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * width + x] = 200;
    return px;
  };
  assert.equal(contentBox(new Uint8Array(width * height).fill(20)), null);
  const stray = screen(10, 10, 60, 30); stray[200 * width + 300] = 255; // one pixel does not stretch the box
  assert.deepEqual(contentBox(stray), { x0: 10, y0: 10, x1: 60, y1: 30 });
  const caps = [{ start: 0.5, duration: 2 }, { start: 2.5, duration: 2 }, { start: 4.5, duration: 2 }, { start: 6.5, duration: 2 }];
  const z = followZooms(caps, [contentBox(screen(10, 10, 120, 40)), contentBox(screen(10, 10, 122, 41)), contentBox(screen(0, 0, 383, 239)), null]);
  assert.equal(z.length, 2, JSON.stringify(z)); // the second box matches the first; the empty screen keeps the whole view
  assert.ok(z[0].scale > 1.5 && z[0].at === 0.5, JSON.stringify(z[0]));
  assert.deepEqual(z[1], { at: 4.5, scale: 1, x: 0, y: 0 });
});

test('world: a take clears only a folder a take made', async () => {
  const { clearTakeDir, MARK } = await import('../stages/world.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'videos-take-'));
  fs.writeFileSync(path.join(dir, 'mine.txt'), 'x');
  assert.throws(() => clearTakeDir(dir), /did not make/);
  assert.ok(fs.existsSync(path.join(dir, 'mine.txt')));
  fs.writeFileSync(path.join(dir, MARK), 'a\n');
  clearTakeDir(dir);
  assert.ok(!fs.existsSync(dir));
  clearTakeDir(dir); // a missing folder is fine
});

test('compose: a docs clip keeps its caption in a band under the take', () => {
  const html = compose({ title: 'A', scenes: [{ clip: 'scene-1.mp4', durationMs: 2000, cues: { captions: [{ text: 'x', start: 0, duration: 1 }], zooms: [] } }] });
  assert.match(html, new RegExp(`data-height="${FRAME.height + BAND}"`));
  assert.match(html, /class="band"/);
  assert.match(html, /<div id="w0" class="view clip"[^>]*><video id="s0"/);
});
