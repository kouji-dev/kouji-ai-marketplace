// world: the sandbox a take runs in (decisions 0036 §5 and 0037).
//
//   C:\demo\ (worldsDir: no one's name on screen, short so tool lines fit) is HOME and USERPROFILE for the take
//     .orrery/              the preset's extensions installed from the build, minus `without`; the model in config
//     <workspace>/          the sample project, its own git repo with a demo identity: C:\demo\sample-rust
//     bin/orrery-demo.exe   a copy of the dev build (never the shared target's file: another worktree may relink it)
//     state/                --state-dir
//     .orrery-videos        the mark that lets the next take clear the folder
//     reply-<n>.jsonl       authored replies, one per pass, replayed by the fixture provider (a world with replies:)
//     world.ps1             dot-sourced, hidden, by the tape: neutral prompt, no API key but the model's own, and
//                           `orrery` on the world's real model, or forced onto the fixture when it has replies
//
// A template is built once per (preset, without, binary) and copied for each take, so every take starts the same.
// Every take runs in the same folder, so renders run one at a time (as they must: they are heavy).
// Nothing here reads or writes the person's ~/.orrery.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { OUT, VIDEOS } from '../paths.mjs';
import { repliesToStreams } from './replies.mjs';

const WORLDS = path.join(VIDEOS, 'scripts', 'shared', 'worlds');

/** What a world runs on when it has no authored replies: a real model, `provider:model` (decision 0037). */
export const DEFAULT_MODEL = 'anthropic:claude-haiku-5-5';

/**
 * The real model a world's takes call, or null when it replays authored `replies` on the fixture provider.
 * `key` is the variable the provider's key comes from, derived as the host derives it: anthropic -> ANTHROPIC_API_KEY.
 */
export function worldModel(world = {}) {
  if (world.replies) return null;
  const spec = world.model ?? DEFAULT_MODEL;
  const provider = spec.slice(0, spec.indexOf(':'));
  return { provider, model: spec.slice(provider.length + 1), key: `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY` };
}

/** The config a real-model world adds: the model in use, and a cap per run so a looping take cannot run up a bill. */
export function modelToml({ provider, model }) {
  return `\n[providers]\ndefault = "${provider}"\n\n[providers.${provider}]\nmodel = "${model}"\n\n[budget]\nmaxTurns = 20\nmaxUsd = 0.25\n`;
}

/**
 * Where a take runs, and its HOME: a short path with no one's name in it, because tool lines and commands print it
 * (`orrery permissions explain` names the config file). ORRERY_VIDEOS_WORLDS overrides it.
 */
export function worldsDir(env = process.env) {
  if (env.ORRERY_VIDEOS_WORLDS) return env.ORRERY_VIDEOS_WORLDS;
  return process.platform === 'win32' ? path.win32.join(`${env.SystemDrive || 'C:'}\\`, 'demo') : path.join(os.tmpdir(), 'orrery-demo');
}

export const MARK = '.orrery-videos';

/** Empty the take folder for a new take: only one a take made (it has MARK), so a person's own folder is never touched. */
export function clearTakeDir(dir) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length && !fs.existsSync(path.join(dir, MARK))) {
    throw new Error(`world: ${dir} holds files a take did not make; move them, or set ORRERY_VIDEOS_WORLDS to another folder`);
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

/** The dev build's folder: CARGO_TARGET_DIR/debug, as scripts/dev/orrery-dev.mjs resolves it. */
export function buildDir(env = process.env) {
  if (env.ORRERY_VIDEOS_BIN) return path.dirname(env.ORRERY_VIDEOS_BIN);
  if (!env.CARGO_TARGET_DIR) {
    const shared = path.join(env.USERPROFILE || env.HOME || '', '.claude', 'scripts', 'cargo-shared-target.mjs');
    if (fs.existsSync(shared)) return path.join(execFileSync(process.execPath, [shared], { encoding: 'utf8' }).trim(), 'debug');
    throw new Error('no dev build: set CARGO_TARGET_DIR (or ORRERY_VIDEOS_BIN) and run pnpm orrery:build');
  }
  return path.join(env.CARGO_TARGET_DIR, 'debug');
}

/** The environment every orrery call that builds a world gets: the sandbox home, no keys, no endpoint, no images. */
export function sandboxEnv(home, base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (!/_API_KEY$|^ORRERY_/i.test(k)) env[k] = v;
  return { ...env, HOME: home, USERPROFILE: home, ProgramData: path.join(home, 'ProgramData'), ORRERY_GRAPHICS: 'none' };
}

/**
 * The PowerShell the tape dot-sources, hidden. Pure, so it can be tested. `replies`: how many fixture streams bare
 * `orrery` replays; 0 runs the world's real model, and `key` is the one API key the take keeps.
 */
export function worldPs1({ root, workspace, replies = 0, key = null }) {
  const q = (p) => `'${p.replace(/'/g, "''")}'`;
  const home = root;
  const exe = path.join(root, 'bin', 'orrery-demo.exe');
  const fixture = Array.from({ length: replies }, (_, i) => ` --provider ${q(`fixture:${path.join(root, `reply-${i + 1}.jsonl`)}`)}`).join('');
  const keep = key ? ` -and $_.Name -ne '${key}'` : '';
  return [
    `Get-ChildItem Env: | Where-Object { $_.Name -match '_API_KEY$|^ORRERY_|^CARGO_TARGET_DIR$'${keep} } | ForEach-Object { Remove-Item "Env:$($_.Name)" }`,
    // rustup and cargo find their homes from USERPROFILE: pin them before it moves, so the agent can still run cargo.
    "if (-not $env:RUSTUP_HOME) { $env:RUSTUP_HOME = Join-Path $env:USERPROFILE '.rustup' }",
    "if (-not $env:CARGO_HOME) { $env:CARGO_HOME = Join-Path $env:USERPROFILE '.cargo' }",
    `$env:HOME = ${q(home)}`,
    `$env:USERPROFILE = ${q(home)}`,
    `$env:ProgramData = ${q(path.join(home, 'ProgramData'))}`,
    "$env:ORRERY_GRAPHICS = 'none'",
    "function global:prompt { '> ' }",
    // No grey history prediction while a command is typed.
    "if (Get-Command Set-PSReadLineOption -ErrorAction SilentlyContinue) { Set-PSReadLineOption -PredictionSource None }",
    // Bare `orrery` is the TUI (on the fixture when the world has replies); any other use passes its arguments through.
    `function global:orrery { if ($args.Count -eq 0) { & ${q(exe)} --state-dir ${q(path.join(root, 'state'))}${fixture} } else { & ${q(exe)} @args } }`,
    `Set-Location ${q(path.join(home, workspace))}`,
    '',
  ].join('\r\n');
}

/** Why a world's extra config is refused, or null. It may set rules and keys, never a provider or a secret. */
export function configProblem(toml) {
  if (/^\s*\[\s*providers\b|^\s*providers\.|apiKey|_API_KEY|^\s*\[\s*registry\b/m.test(toml)) {
    return "a world's config names no provider, key or registry: pick the model with world.model (or authored world.replies); the build's extensions are forced";
  }
  return null;
}

/**
 * `extra` appended to `base`, except that a `[table]` `base` already has (an installed extension's) gets the keys
 * under its own header: TOML refuses a table declared twice.
 */
export function mergeConfig(base, extra) {
  let out = `\n${base}`;
  const rest = [];
  for (const block of extra.trim().split(/^(?=\[)/m).map((b) => b.trim()).filter(Boolean)) {
    const head = block.startsWith('[[') ? null : block.match(/^\[[^\]\n]+\]/)?.[0];
    const at = head ? out.indexOf(`\n${head}\n`) : -1;
    if (at < 0) { rest.push(block); continue; }
    const end = at + head.length + 2;
    out = `${out.slice(0, end)}${block.slice(head.length).trim()}\n${out.slice(end)}`;
  }
  out = out.slice(1);
  return rest.length ? `${out.trimEnd()}\n\n${rest.join('\n\n')}\n` : out;
}

function run(exe, args, env) {
  try {
    return execFileSync(exe, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`world: ${path.basename(exe)} ${args.join(' ')} failed: ${(e.stderr || e.message).trim().split('\n').pop()}`);
  }
}

const copyDir = (from, to) => fs.cpSync(from, to, { recursive: true });

/** Templates of an older build are never used again (about 0.5 GB each): drop every one not made from `stamp`. */
export function pruneTemplates(dir, stamp) {
  if (!fs.existsSync(dir)) return;
  for (const t of fs.readdirSync(dir)) {
    let made;
    try { made = JSON.parse(fs.readFileSync(path.join(dir, t, 'ready'), 'utf8')).stamp; } catch { made = null; }
    if (made !== stamp) fs.rmSync(path.join(dir, t), { recursive: true, force: true, maxRetries: 3 });
  }
}

/** Build (or reuse) the template for a world, then copy it to the worlds folder. Returns the paths. */
export function makeWorld(name, world, { env = process.env, out = OUT } = {}) {
  const model = worldModel(world);
  if (model && !env[model.key]) {
    throw new Error(`world: this video runs ${model.provider}:${model.model} for real and needs ${model.key} in the shell that renders; set it, or give the world authored replies: (the fixture provider, no key)`);
  }
  const preset = world.home || 'fresh';
  const workspace = world.workspace || 'sample-rust';
  const without = [...(world.without || [])].sort();
  const dir = buildDir(env);
  const bin = env.ORRERY_VIDEOS_BIN || path.join(dir, process.platform === 'win32' ? 'orrery.exe' : 'orrery');
  if (!fs.existsSync(bin)) throw new Error(`world: no ${bin}; build it: pnpm orrery:build`);
  const staged = path.join(dir, 'extensions');
  if (!fs.existsSync(path.join(WORLDS, preset))) throw new Error(`world: no preset ${preset} in videos/scripts/shared/worlds/`);
  if (!fs.existsSync(path.join(WORLDS, workspace))) throw new Error(`world: no workspace ${workspace} in videos/scripts/shared/worlds/`);

  const stamp = fs.statSync(bin).mtimeMs;
  const key = crypto.createHash('sha256').update(JSON.stringify({ preset, workspace, without, stamp, bin, index: 'toml' })).digest('hex').slice(0, 12);
  const template = path.join(out, '.cache', 'worlds', key);
  pruneTemplates(path.dirname(template), stamp);
  if (!fs.existsSync(path.join(template, 'ready'))) {
    fs.rmSync(template, { recursive: true, force: true });
    const home = path.join(template, 'home');
    fs.mkdirSync(path.join(home, '.orrery'), { recursive: true });
    fs.mkdirSync(path.join(home, 'ProgramData'), { recursive: true });
    fs.mkdirSync(path.join(template, 'bin'), { recursive: true });
    fs.copyFileSync(bin, path.join(template, 'bin', 'orrery-demo.exe'));
    const exe = path.join(template, 'bin', 'orrery-demo.exe');
    const sbx = sandboxEnv(home, env);
    const presetFile = path.join(WORLDS, preset, 'world.json');
    const presetSpec = fs.existsSync(presetFile) ? JSON.parse(fs.readFileSync(presetFile, 'utf8')) : { install: 'all' };
    const exts = fs.readdirSync(staged, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      .filter((e) => (presetSpec.install === 'all' || presetSpec.install.includes(e)) && !without.includes(e));
    for (const e of exts) run(exe, ['install', path.join(staged, e), '--yes'], sbx);
    copyDir(path.join(WORLDS, workspace), path.join(home, workspace));
    const git = (...a) => execFileSync('git', ['-c', 'user.name=Demo', '-c', 'user.email=demo@getorrery.dev', '-c', 'core.autocrlf=false', ...a], { cwd: path.join(home, workspace), stdio: 'ignore' });
    git('init', '-q', '-b', 'main');
    git('add', '-A');
    git('commit', '-q', '-m', 'Start');
    run(exe, ['trust', 'grant', path.join(home, workspace)], sbx);
    // Offline: an empty list, and the build's own extensions as the source for anything installed in the take.
    // shortcut: a TOML index, not a `.json` list: install reads a local `.json` list as TOML (plan 20, open questions).
    fs.writeFileSync(path.join(home, 'index.toml'), 'schema = 1\nissued = "2026-01-01T00:00:00Z"\nexpires = "2099-01-01T00:00:00Z"\n');
    const cfg = path.join(home, '.orrery', 'config.toml');
    const tomlPath = (p) => `'${p}'`;
    fs.appendFileSync(cfg, `\n[registry]\nindex = ${tomlPath(path.join(home, 'index.toml'))}\nextensionSources = [${tomlPath(staged)}]\n`);
    fs.writeFileSync(path.join(template, 'ready'), JSON.stringify({ at: new Date().toISOString(), stamp }));
  }

  const root = worldsDir(env);
  clearTakeDir(root);
  copyDir(path.join(template, 'home'), root);
  copyDir(path.join(template, 'bin'), path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, MARK), `${name}\n`);
  // The copy points at the template's paths; the workspace trust and config name the home, so rewrite them.
  for (const f of [path.join(root, '.orrery', 'config.toml'), path.join(root, '.orrery', 'trust.toml')]) {
    if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split(path.join(template, 'home')).join(root).split(template).join(root));
  }
  const cfg = path.join(root, '.orrery', 'config.toml');
  // The model goes in config, as a person sets it; its key stays a variable of the render's shell, never in a file.
  if (model) fs.appendFileSync(cfg, modelToml(model));
  if (world.config) {
    if (configProblem(world.config)) throw new Error(`world.config: ${configProblem(world.config)}`);
    fs.writeFileSync(cfg, mergeConfig(fs.readFileSync(cfg, 'utf8'), world.config));
  }
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  const streams = model ? [] : repliesToStreams(world.replies);
  streams.forEach((s, i) => fs.writeFileSync(path.join(root, `reply-${i + 1}.jsonl`), s));
  fs.writeFileSync(path.join(root, 'world.ps1'), worldPs1({ root, workspace, replies: streams.length, key: model?.key }));
  return { root, home: root, workspace: path.join(root, workspace), ps1: path.join(root, 'world.ps1'), model };
}
