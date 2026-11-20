// follow: the zoom of a terminal take whose script names none. At each caption it frames the text on screen (a
// command and its output), so a few lines in the top corner read at docs width instead of sitting in an empty frame.
// A full-screen app (the TUI) fills the frame and stays unzoomed: its scripts name their zooms (`zoom: rows a-b`).
import { execFileSync } from 'node:child_process';
import { FRAME, zoomToBox } from '../surfaces/terminal.mjs';

export const SAMPLE = { width: 384, height: 240 }; // a fifth of the frame: a cell is still several pixels
const PAD = 48; // frame pixels kept around the text

/** One frame of a clip, `at` seconds in, as SAMPLE-sized grey pixels. */
export function frameAt(file, at) {
  return execFileSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, at).toFixed(2)), '-i', file, '-frames:v', '1',
    '-vf', `scale=${SAMPLE.width}:${SAMPLE.height},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 22 });
}

/**
 * The box (SAMPLE pixels) around everything that is not the background (the most common grey), or null on an empty
 * screen. A row or column counts only with two pixels of text in it, so a stray pixel does not stretch the box.
 */
export function contentBox(px, { width = SAMPLE.width, height = SAMPLE.height, threshold = 28 } = {}) {
  const hist = new Uint32Array(256);
  for (const v of px) hist[v]++;
  const bg = hist.indexOf(Math.max(...hist));
  const rows = new Uint32Array(height);
  const cols = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(px[y * width + x] - bg) > threshold) { rows[y]++; cols[x]++; }
    }
  }
  const first = (a) => a.findIndex((n) => n >= 2);
  const last = (a) => a.length - 1 - [...a].reverse().findIndex((n) => n >= 2);
  const y0 = first(rows);
  if (y0 < 0) return null;
  return { x0: first(cols), y0, x1: last(cols), y1: last(rows) };
}

/**
 * The zooms for a take's captions: `boxes[i]` is the text box at the end of caption i (or null). Text that fills most
 * of the frame, or would barely grow, is shown whole; a zoom that matches the one before is not repeated.
 * Returns [{ at, scale, x, y }] (seconds), the shape compose.mjs plays.
 */
export function followZooms(captions, boxes, { width = SAMPLE.width, height = SAMPLE.height } = {}) {
  const k = FRAME.width / width;
  const out = [];
  let cur = { scale: 1, x: 0, y: 0 };
  captions.forEach((c, i) => {
    const b = boxes[i];
    let to = { scale: 1, x: 0, y: 0 };
    if (b && b.y1 - b.y0 < 0.8 * height) {
      const box = { x: b.x0 * k - PAD, y: b.y0 * k - PAD, w: (b.x1 - b.x0 + 1) * k + 2 * PAD, h: (b.y1 - b.y0 + 1) * k + 2 * PAD };
      const z = zoomToBox(box);
      if (z.scale >= 1.15) to = z;
    }
    if (Math.abs(to.scale - cur.scale) < 0.1 && Math.abs(to.x - cur.x) < 60 && Math.abs(to.y - cur.y) < 60) return;
    out.push({ at: c.start, ...to });
    cur = to;
  });
  return out;
}

/** The zooms for one recorded take: the text box near the end of each caption, then followZooms. */
export function follow(file, captions) {
  const boxes = captions.map((c) => contentBox(frameAt(file, c.start + Math.max(0.1, c.duration - 0.2))));
  return followZooms(captions, boxes);
}
