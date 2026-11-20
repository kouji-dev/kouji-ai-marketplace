// voice: a `say:` line -> speech (Kokoro, through `hyperframes tts`) and its word timings (Parakeet, through
// `hyperframes transcribe`), cached on the text and the voice. Plan 20, phase 2.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { OUT } from '../paths.mjs';

export const HYPERFRAMES = 'hyperframes@0.9.20';
export const DEFAULT_VOICE = 'af_heart';
// The one voice of the docs clips, unless a script names another: every clip sounds like the same person.
export const DOCS_VOICE = { name: DEFAULT_VOICE, speed: 0.95 };

/** `voice:` as written (a name, or `{ name, speed }`) -> `{ name, speed }`. */
export const voiceOf = (v) => (typeof v === 'string' ? { name: v, speed: 1 } : { name: v?.name ?? DEFAULT_VOICE, speed: v?.speed ?? 1 });

/** Run the pinned HyperFrames CLI. Throws with its last lines when it fails. */
export function hyperframes(args, { cwd } = {}) {
  const r = spawnSync('pnpm', ['dlx', HYPERFRAMES, ...args], {
    cwd, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' },
  });
  if (r.status !== 0) throw new Error(`hyperframes ${args[0]} failed:\n${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n')}`);
  return r.stdout;
}

/**
 * The words of a line in caption groups, each timed in ms from the line's start. A group ends at a sentence's end, at
 * a comma once it has 3 words, or at `size` words. Times come from the transcript when it has as many words as the
 * script (its spelling can differ: the script's words are shown), else from the share of characters. Pure.
 */
export function chunks(text, durationMs, words = null, size = 5) {
  const mine = text.split(/\s+/).filter(Boolean);
  const timed = words && words.length === mine.length
    ? words.map((w) => ({ start: w.start * 1000, end: w.end * 1000 }))
    : (() => {
      const total = mine.reduce((n, w) => n + w.length + 1, 0);
      let at = 0;
      return mine.map((w) => { const start = at; at += ((w.length + 1) / total) * durationMs; return { start, end: at }; });
    })();
  const out = [];
  let first = 0;
  mine.forEach((w, i) => {
    const n = i - first + 1;
    if (i === mine.length - 1 || /[.?!]$/.test(w) || (/[,;:]$/.test(w) && n >= 3) || n >= size) {
      out.push({ text: mine.slice(first, i + 1).join(' '), start: Math.round(timed[first].start), end: Math.round(timed[i].end) });
      first = i + 1;
    }
  });
  // Each group stays until the next starts, so the captions never blink between words.
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  if (out.length) out[out.length - 1].end = Math.max(out[out.length - 1].end, Math.round(durationMs));
  return out;
}

/** Speak one line: `{ wav, durationMs, words }`, from the cache when this text and voice were spoken before. */
export function speak(text, voice, { out = OUT } = {}) {
  const v = voiceOf(voice);
  const key = crypto.createHash('sha256').update(JSON.stringify({ text, v, hf: HYPERFRAMES })).digest('hex').slice(0, 16);
  const dir = path.join(out, '.cache', 'voice', key);
  const meta = path.join(dir, 'line.json');
  if (fs.existsSync(meta)) return { wav: path.join(dir, 'line.wav'), ...JSON.parse(fs.readFileSync(meta, 'utf8')) };
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // The text goes through a file: no shell quoting to get wrong.
  fs.writeFileSync(path.join(dir, 'line.txt'), text);
  const said = JSON.parse(hyperframes(['tts', 'line.txt', '-o', 'line.wav', '-v', v.name, '-s', String(v.speed), '--json'], { cwd: dir }).trim().split('\n').pop());
  let words = null;
  try {
    hyperframes(['transcribe', 'line.wav', '-e', 'parakeet', '--json'], { cwd: dir });
    words = JSON.parse(fs.readFileSync(path.join(dir, 'transcript.json'), 'utf8')).map(({ text: w, start, end }) => ({ text: w, start, end }));
  } catch {
    // shortcut: no word timings without Parakeet (hyperframes models install parakeet); captions are then timed by length.
  }
  const result = { durationMs: Math.round(said.durationSeconds * 1000), words };
  fs.writeFileSync(meta, JSON.stringify(result));
  return { wav: path.join(dir, 'line.wav'), ...result };
}
