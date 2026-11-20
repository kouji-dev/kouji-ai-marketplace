// terminal: a scene's steps -> a VHS tape, and the time every step starts in the recorded clip.
//
// VHS reports no per-command time, so visible time is made predictable (decision 0036 §4): typing at a fixed
// speed, a fixed beat after every action, exact pauses, and every wait shows WAIT_SHOW of waiting before the rest
// is hidden (a jump cut). compile() returns the tape and the timeline together, so they cannot disagree.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Measured in plan 20's phase 0: on Windows VHS keeps real time at 1920x1200 only up to 15 fps.
export const FRAME = { width: 1920, height: 1200, padding: 40, fps: 15 };
export const TYPING_MS = 45;
export const BEAT_MS = 400; // after a key, so the screen settles before the next action
export const TYPED_MS = 900; // after typing: the list search filters on a delay, and a key sent sooner acts on the unfiltered list
export const MODE_KEY_MS = 1000; // after Escape: the TUI changes mode and drops keys sent sooner
export const WAIT_SHOW_MS = 400; // how much of a wait is shown before the cut
export const AFTER_WAIT_MS = 800; // the result, held after the cut
// The hint under the input once the session is built and idle: at the start and after each turn. Not the
// placeholder `Ask anything`, which shows while extensions still start and a message would only queue.
export const READY = 'enter send';
export const BUSY = 'Turn running'; // the input while the agent's turn runs
export const REPLY_TIMEOUT = '180s'; // how long a real turn may take before the take fails

export const ms = (s) => (s.endsWith('ms') ? Number(s.slice(0, -2)) : Math.round(Number(s.slice(0, -1)) * 1000));
const vhsString = (s) => (s.includes('"') ? (s.includes('`') ? `'${s}'` : `\`${s}\``) : `"${s}"`);
const regex = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const KEYS = { Enter: 'Enter', Tab: 'Tab', Space: 'Space', Backspace: 'Backspace', Escape: 'Escape', Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right', PageUp: 'PageUp', PageDown: 'PageDown' };

/** `Down 2` -> { name: 'Down', count: 2 }. A single character is typed. */
export function parseKey(spec) {
  const [name, n] = spec.split(' ');
  return { name, count: n ? Number(n) : 1 };
}

/** Font size that fits `cols` columns across the frame (JetBrains Mono: a cell is 0.6 em wide). */
export function fontFor(cols) {
  return Math.floor((FRAME.width - 2 * FRAME.padding) / (cols * 0.6));
}

/** The height of one terminal row at that font size, in pixels (VHS line height 1.2). */
export const rowPx = (font) => font * 1.2;

/**
 * Compile one terminal scene. `setup` steps run hidden before the clip starts (an open session, a reply on
 * screen); they take no time in the clip and have no captions.
 * @returns {{ tape: string, events: {at:number, step:object, index:number}[], durationMs: number }}
 */
export function compile(steps, { output, ps1, cols = 80, ready = READY, setup = [] }) {
  const font = fontFor(cols);
  const lines = [
    `Output ${vhsString(output.split(path.sep).join('/'))}`,
    'Set Shell "pwsh"',
    `Set FontSize ${font}`,
    `Set Width ${FRAME.width}`,
    `Set Height ${FRAME.height}`,
    `Set Padding ${FRAME.padding}`,
    `Set Framerate ${FRAME.fps}`,
    `Set TypingSpeed ${TYPING_MS}ms`,
    'Set CursorBlink false', // a blink would differ frame to frame
    'Hide',
    `Type ${vhsString(`. ${ps1.split(path.sep).join('/')}; cls`)}`,
    'Enter',
    'Sleep 1s',
  ];
  let t = 0;
  let hidden = true;
  const events = [];
  const sleep = (n) => { if (n > 0) { lines.push(`Sleep ${n}ms`); if (!hidden) t += n; } };
  const typeText = (text) => { lines.push(`Type ${vhsString(text)}`); if (!hidden) t += text.length * TYPING_MS; };
  const hiddenWait = (text, timeout) => {
    sleep(WAIT_SHOW_MS);
    lines.push(...(hidden ? [`Wait+Screen@${timeout} /${regex(text)}/`] : ['Hide', `Wait+Screen@${timeout} /${regex(text)}/`, 'Show']));
    sleep(AFTER_WAIT_MS);
  };

  const play = (step, index) => {
    if (!hidden) events.push({ at: t, step, index });
    if (step.run !== undefined) {
      typeText(step.run);
      lines.push('Enter');
      if (!hidden) t += TYPING_MS;
      const until = step.until ?? (step.run.trim() === 'orrery' ? ready : null);
      if (until) hiddenWait(until, '60s');
      else sleep(BEAT_MS);
    } else if (step.type !== undefined) {
      typeText(step.type);
      sleep(TYPED_MS);
    } else if (step.key !== undefined) {
      const { name, count } = parseKey(step.key);
      if (KEYS[name]) lines.push(count > 1 ? `${KEYS[name]} ${count}` : KEYS[name]);
      else if (/^Ctrl\+/.test(name)) lines.push(name);
      else lines.push(`Type ${vhsString(name.repeat(count))}`);
      if (!hidden) t += count * TYPING_MS;
      sleep(name === 'Escape' ? MODE_KEY_MS : BEAT_MS);
    } else if (step.wait !== undefined) {
      const w = typeof step.wait === 'string' ? { for: step.wait } : step.wait;
      const timeout = w.timeout ?? '30s';
      if (w.show === 'all') {
        // Visible wait: timed from `seconds`, else assumed 2 s; the calibration after recording absorbs the rest.
        lines.push(`Wait+Screen@${timeout} /${regex(w.for)}/`);
        if (!hidden) t += Math.round((step.seconds ?? 2) * 1000);
        sleep(AFTER_WAIT_MS);
      } else if (w.show) {
        sleep(ms(w.show) - WAIT_SHOW_MS);
        hiddenWait(w.for, timeout);
      } else hiddenWait(w.for, timeout);
    } else if (step.reply !== undefined) {
      // The agent's turn, live: cut to its start, show `reply` of it at real speed, then cut to its end. The
      // visible part is fixed, so the timeline holds however long the model takes.
      lines.push(...(hidden ? [`Wait+Screen@60s /${regex(BUSY)}/`] : ['Hide', `Wait+Screen@60s /${regex(BUSY)}/`, 'Show']));
      sleep(ms(step.reply) - WAIT_SHOW_MS);
      hiddenWait(ready, REPLY_TIMEOUT);
    } else if (step.pause !== undefined) {
      sleep(ms(step.pause));
    } else if (step.vhs !== undefined) {
      lines.push(...String(step.vhs).trim().split(/\r?\n/));
      if (!hidden) t += Math.round(step.seconds * 1000);
    }
  };
  setup.forEach((step, index) => play(step, index));
  // A setup that ends at the shell prompt (a command and its own print) leaves nothing the clip needs: clear it.
  const last = setup.at(-1);
  if (last?.run !== undefined && last.until && last.run.trim() !== 'orrery') lines.push('Type "cls"', 'Enter', 'Sleep 500ms');
  hidden = false;
  lines.push('Show');
  steps.forEach((step, index) => play(step, index));
  return { tape: lines.join('\n') + '\n', events, durationMs: t };
}

/** Run VHS on a tape. Throws with the wait that timed out and the last screen, when one does. */
export function record(tapeFile, { env = process.env } = {}) {
  const r = spawnSync('vhs', [path.basename(tapeFile)], { cwd: path.dirname(tapeFile), env, encoding: 'utf8', timeout: 10 * 60 * 1000, shell: false });
  if (r.error?.code === 'ENOENT') throw new Error('vhs is not on PATH: winget install charmbracelet.vhs (and tsl0922.ttyd), then open a new terminal');
  if (r.status !== 0) {
    const log = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    fs.writeFileSync(tapeFile.replace(/\.tape$/, '.log'), log);
    const failed = /failed to execute command: (.*)/.exec(log);
    throw new Error(`vhs failed${failed ? `: ${failed[1]}` : ''}\n  the full log, with the last screen: ${tapeFile.replace(/\.tape$/, '.log')}`);
  }
}

/**
 * The zoom for `rows a-b [cols c-d]` at that font: the scale and shift (frame pixels) that bring the box to the
 * middle of the frame, as large as fits (at most 2x), never past the frame's edges. Columns default to them all.
 */
export function zoomFor(spec, font, cols = 80) {
  const m = /^rows (\d+)-(\d+)(?: cols (\d+)-(\d+))?$/.exec(spec);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
  const [c, d] = m[3] ? [Number(m[3]), Number(m[4])].sort((x, y) => x - y) : [1, cols];
  const h = rowPx(font);
  const w = font * 0.6;
  const P = FRAME.padding;
  return zoomToBox({ x: P + (c - 1) * w, y: P + (a - 1) * h, w: (d - c + 1) * w, h: (b - a + 1) * h });
}

/**
 * The zoom that brings a box (frame pixels) to the middle of the frame, as large as fits (at most 2x), never past the
 * frame's edges: a band of terminal rows, or the element an app step clicked.
 */
export function zoomToBox(box) {
  const { width: W, height: H, padding: P } = FRAME;
  const scale = Math.min(2, Math.max(1, Math.min((0.9 * (H - 2 * P)) / box.h, (0.94 * (W - 2 * P)) / box.w)));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const clamp = (v, max) => Math.max(-max, Math.min(max, v));
  const x = clamp(-(cx - W / 2) * scale, ((scale - 1) * W) / 2);
  const y = clamp(-(cy - H / 2) * scale, ((scale - 1) * H) / 2);
  return { scale: Number(scale.toFixed(3)), x: Math.round(x), y: Math.round(y) };
}
