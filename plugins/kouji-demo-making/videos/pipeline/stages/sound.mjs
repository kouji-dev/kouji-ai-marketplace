// sound: the soundtrack of a motion launch, made here rather than sampled. The page says what it wants, next to the
// animations it times: window.SCORE (the music's mood from a time on) and window.SFX (a sound effect at a time). This
// synthesizes the score (pads, bass, plucks, a light kit, a drone) and the effects (whooshes, hits, clicks, chimes),
// lays the voice in, ducks the music under it, and writes one track at -15 LUFS. No samples, so no licences; every
// random is seeded, so a render gives the same file twice.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TYPING_MS } from '../surfaces/terminal.mjs';

export const SR = 48000;
const TAU = 2 * Math.PI;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const len = (s) => Math.max(1, Math.round(s * SR));

/** A seeded random in [-1, 1). */
export function noise(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
}

/** Simper's state-variable filter: low, band and high pass at once; the cutoff may move every sample. */
class SVF {
  constructor() { this.s1 = 0; this.s2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  run(x, fc, q = 0.707) {
    const g = Math.tan((Math.PI * Math.min(Math.max(fc, 10), SR * 0.45)) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.s2, v1 = a1 * this.s1 + a2 * v3, v2 = this.s2 + a2 * this.s1 + a3 * v3;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    this.lp = v2; this.bp = v1; this.hp = x - k * v1 - v2;
    return this;
  }
}

/** Freeverb (eight combs, four allpasses a side): `room` is the comb feedback, `damp` darkens the tail. */
class Reverb {
  constructor({ room = 0.88, damp = 0.3 } = {}) {
    const k = SR / 44100, mk = (n) => ({ buf: new Float32Array(Math.round(n * k)), i: 0, z: 0 });
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], alls = [556, 441, 341, 225];
    this.sides = [0, 23].map((d) => ({ c: combs.map((n) => mk(n + d)), a: alls.map((n) => mk(n + d)) }));
    this.room = room; this.damp = damp;
  }
  run(side, x) {
    let out = 0;
    for (const c of side.c) {
      const y = c.buf[c.i];
      c.z = y * (1 - this.damp) + c.z * this.damp;
      c.buf[c.i] = x + c.z * this.room;
      c.i = (c.i + 1) % c.buf.length;
      out += y;
    }
    for (const a of side.a) {
      const b = a.buf[a.i];
      a.buf[a.i] = out + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      out = b - out;
    }
    return out;
  }
  /** The wet signal of a stereo send. */
  process([L, R]) {
    const n = L.length, oL = new Float32Array(n), oR = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (L[i] + R[i]) * 0.02;
      oL[i] = this.run(this.sides[0], x);
      oR[i] = this.run(this.sides[1], x);
    }
    return [oL, oR];
  }
}

const peakOf = (...bufs) => bufs.reduce((m, b) => { for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i])); return m; }, 0);
const normalize = (b, to = 1) => { const p = peakOf(b); if (p > 0) for (let i = 0; i < b.length; i++) b[i] *= to / p; return b; };
// A fade over the first and last few milliseconds, so no sound starts or ends with a click.
const edges = (b, a = 0.002, r = 0.02) => { const na = len(a), nr = Math.min(len(r), b.length); for (let i = 0; i < na && i < b.length; i++) b[i] *= i / na; for (let i = 0; i < nr; i++) b[b.length - 1 - i] *= i / nr; return b; };
// Rise to a peak at `peak` (0..1 of the length), then fall away; both halves eased.
const hump = (p, peak) => (p < peak ? Math.sin(((p / peak) * Math.PI) / 2) ** 2 : Math.cos((((p - peak) / (1 - peak)) * Math.PI) / 2) ** 2);

/** Noise through two band-passes sweeping from `from` to `to` Hz (or up and back with `curve: 'hump'`): air moving. */
function whoosh({ dur = 0.7, from = 260, to = 3000, peak = 0.55, q = 1.1, curve = 'line', seed = 1 } = {}) {
  const n = len(dur), out = new Float32Array(n), rnd = noise(seed), f1 = new SVF(), f2 = new SVF();
  for (let i = 0; i < n; i++) {
    const p = i / n, u = curve === 'hump' ? Math.sin(p * Math.PI) : p;
    const fc = from * (to / from) ** u;
    out[i] = f2.run(f1.run(rnd(), fc, q).bp, fc, q).bp * hump(p, peak);
  }
  return edges(normalize(out));
}

/** A low body falling in pitch, a short crack on top: an impact. */
function hit({ dur = 2.4, f0 = 130, f1 = 42, decay = 0.9, crack = 0.8, seed = 2 } = {}) {
  const n = len(dur), out = new Float32Array(n), rnd = noise(seed), lp = new SVF();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.05))) / SR;
    const body = Math.sin(ph) * Math.exp(-t / decay);
    const top = lp.run(rnd(), 2800, 0.6).lp * Math.exp(-t / 0.04) * crack;
    out[i] = Math.tanh((body + top) * 1.6);
  }
  return edges(normalize(out), 0.001, 0.2);
}

/** Inharmonic partials with their own decays: a struck bell. */
function bell(note, dur = 2.2, bright = 1) {
  const f = mtof(note), n = len(dur), out = new Float32Array(n);
  const parts = [[1, 1, 1.3], [2.0, 0.45 * bright, 0.8], [3.01, 0.22 * bright, 0.45], [4.17, 0.14 * bright, 0.3], [5.43, 0.08 * bright, 0.2]];
  for (const [r, a, d] of parts) {
    if (f * r > SR * 0.45) continue;
    const w = (TAU * f * r) / SR;
    for (let i = 0; i < n; i++) out[i] += a * Math.sin(w * i) * Math.exp(-i / SR / d);
  }
  return out;
}

/** Karplus-Strong: a noise burst circling a delay line as long as one period: a plucked string. */
function pluck(note, dur = 1.6, bright = 0.55, seed = 4) {
  const N = Math.max(2, Math.round(SR / mtof(note))), line = new Float32Array(N), rnd = noise(seed);
  let z = 0;
  for (let i = 0; i < N; i++) { z += bright * (rnd() - z); line[i] = z; }
  const n = len(dur), out = new Float32Array(n), hp = new SVF();
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    line[idx] = 0.5 * (cur + prev) * 0.997;
    prev = cur;
    idx = (idx + 1) % N;
    out[i] = hp.run(cur, 60).hp;
  }
  return edges(out, 0.002, 0.3);
}

/** A short click: band-passed noise and a tone, both gone in milliseconds. */
function click({ fc = 2600, tone = 1800, decay = 0.006, seed = 5 } = {}) {
  const n = len(0.08), out = new Float32Array(n), rnd = noise(seed), bp = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = bp.run(rnd(), fc, 1.5).bp * Math.exp(-t / decay) * 1.6 + Math.sin(TAU * tone * t) * Math.exp(-t / (decay * 1.6)) * 0.5;
  }
  return edges(normalize(out), 0.0005, 0.02);
}

/** A tone that drops in pitch as it fades: a UI pop. */
function pop({ base = 560, drop = 1.7, dur = 0.16 } = {}) {
  const n = len(dur), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * base * (1 + (drop - 1) * Math.exp(-t / 0.018))) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.05);
  }
  return edges(normalize(out), 0.001, 0.03);
}

/** Noise rising to an abrupt stop, brightening as it comes: a reversed cymbal into a hit. */
function swell({ dur = 1.1, seed = 6 } = {}) {
  const n = len(dur), out = new Float32Array(n), rnd = noise(seed), f = new SVF(), h = new SVF();
  for (let i = 0; i < n; i++) {
    const p = i / n;
    out[i] = h.run(f.run(rnd(), 1500 + 9000 * p * p, 0.8).lp, 900).hp * p ** 2.6;
  }
  return edges(normalize(out), 0.01, 0.006);
}

/** Copy `src` into `dst` from sample `at`, scaled. */
const add = (dst, src, at = 0, g = 1) => { for (let i = 0, j = at; i < src.length && j < dst.length; i++, j++) if (j >= 0) dst[j] += src[i] * g; return dst; };
const join = (dur, parts) => { const out = new Float32Array(len(dur)); for (const [b, at, g] of parts) add(out, b, len(at), g); return out; };

// The effects the page can ask for, by name. `pitch` moves a tuned one by semitones; `seed` varies a noisy one.
const EFFECTS = {
  whoosh: ({ seed }) => whoosh({ seed }),
  'whoosh-up': ({ seed }) => whoosh({ dur: 0.6, from: 300, to: 4200, peak: 0.75, seed }),
  'whoosh-down': ({ seed }) => whoosh({ dur: 0.7, from: 3400, to: 220, peak: 0.3, seed }),
  'whoosh-long': ({ seed }) => whoosh({ dur: 1.5, from: 180, to: 2600, curve: 'hump', peak: 0.5, q: 0.9, seed }),
  suck: ({ seed }) => whoosh({ dur: 0.75, from: 3600, to: 160, peak: 0.88, seed }),
  slide: ({ seed }) => whoosh({ dur: 0.32, from: 700, to: 2400, peak: 0.6, q: 1.6, seed }),
  'slide-down': ({ seed }) => whoosh({ dur: 0.3, from: 2200, to: 600, peak: 0.4, q: 1.6, seed }),
  swell: ({ seed }) => swell({ seed }),
  hit: ({ seed }) => hit({ seed }),
  'hit-soft': ({ seed }) => hit({ dur: 1.6, f0: 110, f1: 50, decay: 0.5, crack: 0.25, seed }),
  thud: ({ seed, pitch }) => hit({ dur: 0.6, f0: 170 * 2 ** (pitch / 12), f1: 58 * 2 ** (pitch / 12), decay: 0.12, crack: 0.5, seed }),
  stamp: ({ seed }) => join(0.7, [[hit({ dur: 0.7, f0: 190, f1: 60, decay: 0.14, crack: 1.2, seed }), 0, 1], [whoosh({ dur: 0.09, from: 1600, to: 900, peak: 0.1, seed: seed + 1 }), 0, 0.5]]),
  lock: ({ seed }) => join(0.4, [[click({ fc: 3200, tone: 1870, decay: 0.012, seed }), 0, 1], [bell(98, 0.25, 0.6), 0, 0.12], [click({ fc: 2700, tone: 2930, decay: 0.01, seed: seed + 1 }), 0.11, 0.8]]),
  rattle: ({ seed }) => { const r = noise(seed); return join(0.55, [0, 0.07, 0.13, 0.22, 0.29, 0.38].map((t, i) => [click({ fc: 2400 + 600 * r(), tone: 1500 + 400 * r(), decay: 0.008, seed: seed + i }), t, 0.5 + 0.4 * Math.abs(r())])); },
  tick: ({ seed, pitch }) => click({ fc: 3000 * 2 ** (pitch / 12), tone: 2000 * 2 ** (pitch / 12), decay: 0.004, seed }),
  tap: ({ seed }) => join(0.12, [[click({ fc: 1800, tone: 2400, decay: 0.006, seed }), 0, 1], [pop({ base: 900, drop: 1.3, dur: 0.06 }), 0, 0.3]]),
  key: ({ seed }) => { const r = noise(seed); return join(0.1, [[click({ fc: 2600 + 500 * r(), tone: 200 + 40 * r(), decay: 0.007, seed }), 0, 1]]); },
  pop: ({ pitch }) => pop({ base: 560 * 2 ** (pitch / 12) }),
  pluck: ({ pitch, seed }) => normalize(pluck(69 + pitch, 1.6, 0.55, seed)),
  chime: ({ pitch }) => edges(normalize(bell(84 + pitch, 2.4)), 0.001, 0.2),
  notify: () => normalize(join(1.6, [[bell(88, 1.4, 0.7), 0, 0.8], [bell(93, 1.5, 0.7), 0.12, 1]])),
  success: () => normalize(join(2.2, [[bell(84, 1.8, 0.6), 0, 0.7], [bell(88, 1.8, 0.6), 0.05, 0.6], [bell(91, 2, 0.6), 0.1, 0.7]])),
  data: () => normalize(join(0.3, [76, 81, 86].map((m, i) => [pop({ base: mtof(m), drop: 1.15, dur: 0.06 }), i * 0.05, 0.8]))),
  alert: () => normalize(join(0.3, [[pop({ base: 660, drop: 1.05, dur: 0.07 }), 0, 1], [pop({ base: 660, drop: 1.05, dur: 0.07 }), 0.11, 1]])),
  glitch: ({ seed }) => {
    const r = noise(seed), out = new Float32Array(len(0.6));
    for (let k = 0; k < 9; k++) {
      const at = len(Math.abs(r()) * 0.5), n = len(0.02 + Math.abs(r()) * 0.04), f = 200 + Math.abs(r()) * 1800;
      for (let i = 0; i < n && at + i < out.length; i++) out[at + i] += (Math.sin((TAU * f * i) / SR) > 0 ? 0.5 : -0.5) * (1 - i / n) + r() * 0.2;
    }
    return edges(normalize(out));
  },
  dissolve: ({ seed }) => {
    const r = noise(seed + 7), out = whoosh({ dur: 0.9, from: 4000, to: 300, peak: 0.25, seed });
    for (let k = 0; k < 40; k++) add(out, click({ fc: 2000 + 3000 * Math.abs(r()), decay: 0.002, seed: seed + k }), len(Math.abs(r()) * 0.8), 0.25);
    return normalize(out);
  },
  roll: ({ seed }) => join(1.9, Array.from({ length: 14 }, (_, k) => [click({ fc: 3200, tone: 2200, decay: 0.003, seed: seed + k }), 1.8 * (k / 14) ** 1.7, 0.55])),
};
// Stereo ones: a swirl goes round, left to right and back.
const STEREO = {
  swirl: ({ seed }) => {
    const m = whoosh({ dur: 1.2, from: 300, to: 2400, curve: 'hump', peak: 0.5, seed }), L = new Float32Array(m.length), R = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) { const a = (Math.sin((i / m.length) * TAU) * 0.9 + 1) * Math.PI / 4; L[i] = m[i] * Math.cos(a); R[i] = m[i] * Math.sin(a); }
    return [L, R];
  },
};
export const EFFECT_NAMES = [...Object.keys(EFFECTS), ...Object.keys(STEREO)];

// How much of each effect goes to the hall: the big ones ring, the clicks stay dry.
const SEND = { hit: 0.5, 'hit-soft': 0.45, swell: 0.3, chime: 0.45, notify: 0.35, success: 0.45, pluck: 0.4, 'whoosh-long': 0.35, swirl: 0.35, thud: 0.25, stamp: 0.2, tick: 0.05, key: 0.03, tap: 0.08, click: 0.05 };

// ── the score ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const BPM = 100;
const BEAT = 60 / BPM, BAR = 4 * BEAT;
// Chords as MIDI notes: the first is the bass, the rest are the pad.
const CHORDS = {
  Am: [45, 57, 60, 64, 69], F: [41, 57, 60, 65, 69], C: [48, 55, 60, 64, 67], G: [43, 55, 59, 62, 67],
  Em: [40, 55, 59, 64, 67], Bb: [46, 58, 62, 65, 70], Cadd9: [36, 55, 60, 62, 64, 67],
};
// Each mood: its chords, a bar each, and how loud each part plays (0 is silent); `cut` is the pad's brightness.
export const MOODS = {
  open: { prog: ['C', 'G'], cut: 2000, pad: 0.45, bass: 0.45, kick: 0.55, hat: 0.18, arp: 0.32, drone: 0, pulse: 0 },
  dark: { prog: ['Am', 'Am', 'F', 'Em'], cut: 520, pad: 0.45, bass: 0.4, kick: 0, hat: 0, arp: 0, drone: 0.5, pulse: 0.22 },
  lift: { prog: ['F', 'C', 'G', 'Am'], cut: 2400, pad: 0.55, bass: 0.45, kick: 0, hat: 0, arp: 0.34, drone: 0, pulse: 0 },
  drive: { prog: ['F', 'C', 'G', 'Am'], cut: 2700, pad: 0.45, bass: 0.55, kick: 0.6, hat: 0.2, arp: 0.36, drone: 0, pulse: 0 },
  focus: { prog: ['F', 'C', 'G', 'Am'], cut: 1500, pad: 0.38, bass: 0.4, kick: 0, hat: 0.1, arp: 0.24, drone: 0, pulse: 0 },
  tense: { prog: ['Am', 'Bb'], cut: 900, pad: 0.42, bass: 0.5, kick: 0.45, hat: 0, arp: 0, drone: 0.3, pulse: 0.3 },
  night: { prog: ['Am', 'F'], cut: 640, pad: 0.38, bass: 0.3, kick: 0, hat: 0, arp: 0.12, drone: 0.25, pulse: 0 },
  build: { prog: ['F', 'C', 'G', 'G'], cut: 2500, pad: 0.45, bass: 0.5, kick: 0.5, hat: 0.18, arp: 0.36, drone: 0, pulse: 0 },
  resolve: { prog: ['Cadd9'], cut: 2300, pad: 0.6, bass: 0.45, kick: 0, hat: 0, arp: 0.16, drone: 0, pulse: 0 },
};

/** The mood playing at `t`: the last one that started at or before it. */
export const moodAt = (score, t) => {
  let m = score[0]?.mood ?? 'drive';
  for (const s of score) if (s.at <= t + 1e-6) m = s.mood;
  return MOODS[m];
};

/** The score as sections: each mood from its start to the next one's, the first from 0. */
export function sections(score, total) {
  const s = [...score].sort((a, b) => a.at - b.at).filter((x) => x.at < total);
  if (!s.length || s[0].at > 0) s.unshift({ at: 0, mood: s[0]?.mood ?? 'drive' });
  return s.map((x, i) => ({ s: x.at, e: s[i + 1]?.at ?? total, mood: MOODS[x.mood] }));
}

/**
 * Where the chords change. A section starts its own bar count and its progression from the top, so a change of mood
 * is a downbeat on the picture's cut (the bar before it is cut short); a chord held over bars is one segment.
 */
export function chordSegments(score, total) {
  const segs = [];
  for (const sec of sections(score, total)) {
    for (let k = 0; sec.s + k * BAR < sec.e - 1e-6; k++) {
      const s = +(sec.s + k * BAR).toFixed(4), e = Math.min(sec.e, +(s + BAR).toFixed(4)), chord = sec.mood.prog[k % sec.mood.prog.length];
      const last = segs[segs.length - 1];
      if (last && last.chord === chord) last.e = e;
      else segs.push({ s, e, chord });
    }
  }
  return segs;
}

// One band-limited saw (polyBLEP) step: `ph` in [0, 1), `dt` the phase step.
const saw = (ph, dt) => {
  let v = 2 * ph - 1;
  if (ph < dt) { const t = ph / dt; v -= t + t - t * t - 1; } else if (ph > 1 - dt) { const t = (ph - 1) / dt; v -= t * t + t + t + 1; }
  return v;
};

function kick() {
  const n = len(0.45), out = new Float32Array(n), rnd = noise(9);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (46 + 110 * Math.exp(-t / 0.035))) / SR;
    out[i] = Math.tanh(Math.sin(ph) * Math.exp(-t / 0.16) * 1.8) + rnd() * Math.exp(-t / 0.002) * 0.3;
  }
  return edges(normalize(out), 0.0005, 0.05);
}
const hat = () => { const n = len(0.08), out = new Float32Array(n), rnd = noise(10), f = new SVF(); for (let i = 0; i < n; i++) out[i] = f.run(rnd(), 8000).hp * Math.exp(-i / SR / 0.022); return edges(normalize(out), 0.0005, 0.01); };

/** The music, as [L, R], following the score's moods. */
export function music(score, total) {
  const n = len(total), L = new Float32Array(n), R = new Float32Array(n);
  const padL = new Float32Array(n), padR = new Float32Array(n), bass = new Float32Array(n);
  const arpL = new Float32Array(n), arpR = new Float32Array(n), kit = new Float32Array(n), duck = new Float32Array(n).fill(1);
  const segs = chordSegments(score, total);
  // smoothed levels, one per part, following the mood at each sample
  const keys = ['cut', 'pad', 'bass', 'drone'], lv = Object.fromEntries(keys.map((k) => [k, moodAt(score, 0)[k]]));
  const lvAt = new Float32Array(n * keys.length);
  const glide = 1 - Math.exp(-1 / (0.6 * SR));
  let si = 0, mood = moodAt(score, 0);
  const sorted = [...score].sort((a, b) => a.at - b.at);
  for (let i = 0; i < n; i++) {
    while (si < sorted.length && sorted[si].at * SR <= i) mood = MOODS[sorted[si++].mood];
    keys.forEach((k, j) => { lv[k] += (mood[k] - lv[k]) * glide; lvAt[i * keys.length + j] = lv[k]; });
  }
  // the pad: two detuned saws a note a side, each chord fading in over the last one's release
  for (const { s, e, chord } of segs) {
    const notes = CHORDS[chord].slice(1), i0 = Math.max(0, len(s - 0.05)), i1 = Math.min(n, len(e + 2));
    for (const [side, cents] of [[padL, 7], [padR, -7]]) {
      for (const [k, m] of notes.entries()) {
        const dts = [mtof(m) * 2 ** (cents / 1200) / SR, mtof(m) * 2 ** (-cents / 2400) / SR];
        const ph = [((k * 0.37) % 1), ((k * 0.61 + 0.5) % 1)];
        for (let i = i0; i < i1; i++) {
          const t = i / SR, env = Math.min(1, (t - s + 0.05) / 0.5) * (t > e ? Math.exp(-(t - e) / 0.45) : 1);
          let v = 0;
          for (let o = 0; o < 2; o++) { v += saw(ph[o], dts[o]); ph[o] += dts[o]; if (ph[o] >= 1) ph[o] -= 1; }
          side[i] += v * env * 0.12;
        }
      }
    }
    // the bass: the chord's root and the octave under it, warm
    const f = mtof(CHORDS[chord][0]);
    let pb = 0;
    for (let i = i0; i < i1; i++) {
      const t = i / SR, env = Math.min(1, (t - s + 0.05) / 0.08) * (t > e ? Math.exp(-(t - e) / 0.2) : 1);
      pb += (TAU * f) / SR;
      bass[i] += Math.tanh((Math.sin(pb) + 0.3 * Math.sin(pb / 2)) * 1.2) * env;
    }
  }
  // the kit, the arpeggio and the clock tick, on the beat grid, as loud as the mood at each hit
  const K = kick(), H = hat(), arpNotes = (c) => { const x = CHORDS[c]; return [x[1], x[2], x[3], x[2], x[4], x[3], x[2], x[3]].map((m) => m + 12); };
  // each section counts its beats from its own start: the kick and the arpeggio come in on the cut
  let hits = 0;
  for (const sec of sections(score, total)) for (let b = 0; sec.s + b * BEAT < sec.e - 1e-6; b++) {
    for (const half of [0, 1]) {
      const t = sec.s + (b + half / 2) * BEAT, m = sec.mood, i = len(t);
      if (t >= sec.e) continue;
      hits++;
      if (!half && m.kick > 0.01 && (m !== MOODS.tense || b % 2 === 0)) {
        add(kit, K, i, m.kick);
        for (let j = i; j < Math.min(n, i + len(0.3)); j++) duck[j] = Math.min(duck[j], 1 - 0.3 * Math.exp(-(j - i) / SR / 0.11));
      }
      if (half && m.hat > 0.01) add(kit, H, i, m.hat * 0.5);
      if (!half && m.pulse > 0.01) add(kit, click({ fc: 1400, tone: 1100, decay: 0.006, seed: 30 + hits }), i, m.pulse * 0.6);
      if (m.arp > 0.01) {
        const seg = segs.find((x) => t >= x.s - 1e-6 && t < x.e) ?? segs[segs.length - 1];
        const note = arpNotes(seg.chord)[(b * 2 + half) % 8];
        const p = pluck(note, 1.4, 0.5, 40 + hits), g = m.arp * 0.5, pan = half ? 0.3 : -0.3;
        add(arpL, p, i, g * Math.cos(((pan + 1) * Math.PI) / 4) * 1.41);
        add(arpR, p, i, g * Math.sin(((pan + 1) * Math.PI) / 4) * 1.41);
      }
    }
  }
  // the arpeggio echoes left and right on a dotted eighth
  const d = len(BEAT * 0.75), fb = 0.35;
  for (let i = d; i < n; i++) { const l = arpL[i - d], r = arpR[i - d]; arpL[i] += r * fb; arpR[i] += l * fb; }
  // the pad through its filter, the drone under it in the dark moods
  const fL = new SVF(), fR = new SVF(), hpL = new SVF(), hpR = new SVF(), bl = new SVF(), wind = new SVF(), rnd = noise(11);
  for (let i = 0; i < n; i++) {
    const t = i / SR, o = i * keys.length, cut = lvAt[o] * (1 + 0.12 * Math.sin(TAU * 0.07 * t)), pad = lvAt[o + 1], bs = lvAt[o + 2], dr = lvAt[o + 3];
    const pl = hpL.run(fL.run(padL[i], cut, 0.9).lp, 140).hp * pad, pr = hpR.run(fR.run(padR[i], cut, 0.9).lp, 140).hp * pad;
    const b = bl.run(bass[i], 420).lp * bs * 0.4;
    const drone = dr * (0.35 * Math.sin(TAU * 55 * t) + 0.3 * Math.sin(TAU * 82.4 * t + 0.4 * Math.sin(TAU * 0.13 * t)) + wind.run(rnd(), 380, 0.7).lp * 0.6) * (0.75 + 0.25 * Math.sin(TAU * 0.11 * t));
    L[i] = (pl + b + drone) * duck[i] + kit[i] * 0.5 + arpL[i] * 0.7;
    R[i] = (pr + b + drone) * duck[i] + kit[i] * 0.5 + arpR[i] * 0.7;
  }
  // the hall on the pad and the arpeggio; then nothing under 35 Hz, which small speakers cannot play anyway
  const [wL, wR] = new Reverb({ room: 0.9, damp: 0.35 }).process([padL.map((x, i) => x * lvAt[i * keys.length + 1] + arpL[i] * 0.6), padR.map((x, i) => x * lvAt[i * keys.length + 1] + arpR[i] * 0.6)]);
  const sL = new SVF(), sR = new SVF();
  for (let i = 0; i < n; i++) { L[i] = sL.run(L[i] + wL[i] * 0.5, 35).hp; R[i] = sR.run(R[i] + wR[i] * 0.5, 35).hp; }
  // in over half a second, out over the last two and a half
  const fi = len(0.5), fo = len(2.5);
  for (let i = 0; i < fi; i++) { L[i] *= i / fi; R[i] *= i / fi; }
  for (let i = 0; i < fo; i++) { const g = (i / fo) ** 1.5; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  return [L, R];
}

// ── the mix ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const rms = (b, gate = 0) => { let s = 0, c = 0; for (const x of b) if (Math.abs(x) > gate) { s += x * x; c++; } return c ? Math.sqrt(s / c) : 0; };
const dbfs = (db) => 10 ** (db / 20);

/** Read any audio file as mono floats at SR, through FFmpeg. */
function readMono(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`sound: FFmpeg could not read ${file}: ${String(r.stderr).trim()}`);
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** A 32-bit float stereo WAV. */
export function wav([L, R]) {
  const n = L.length, b = Buffer.alloc(44 + n * 8);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 8, 28);
  b.writeUInt16LE(8, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { b.writeFloatLE(L[i], 44 + i * 8); b.writeFloatLE(R[i], 48 + i * 8); }
  return b;
}

/** What the page asked for, checked: every mood and effect named exists, every time is in the film. */
export function soundProblems({ score = [], sfx = [] }, total) {
  const out = [];
  for (const s of score) if (!MOODS[s.mood]) out.push(`SCORE: mood ${s.mood} at ${s.at} s is not one of ${Object.keys(MOODS).join(', ')}`);
  for (const c of sfx) {
    if (!EFFECT_NAMES.includes(c.name)) out.push(`SFX: ${c.name} at ${c.at} s is not one of ${EFFECT_NAMES.join(', ')}`);
    if (!(c.at >= 0 && c.at <= total)) out.push(`SFX: ${c.name} at ${c.at} s is outside the film (0 to ${total} s)`);
  }
  return out;
}

/**
 * The whole track: the music ducked under the voice, the effects, the voice clips (`voices`: [{ file, at }] in
 * seconds), as [L, R] floats. Levels are set by numbers, not by ear: the voice at -19 dBFS RMS while it speaks, the
 * music at `musicDb` (-26 dBFS RMS) before it ducks (by 9 dB under the voice), each effect's `gain` against a -10
 * dBFS peak.
 */
export function mix({ score = [], sfx = [], voices = [], total, musicDb = -26 }) {
  const problems = soundProblems({ score, sfx }, total);
  if (problems.length) throw new Error(`sound: the page asks for what does not exist:\n  ${problems.join('\n  ')}`);
  const n = len(total);
  // the voice: cleaned of rumble, evened out, then placed
  const voice = new Float32Array(n);
  for (const v of voices) {
    const x = readMono(v.file), hp = new SVF();
    let env = 0;
    for (let i = 0; i < x.length; i++) {
      const y = hp.run(x[i], 90).hp;
      env += (Math.abs(y) - env) * (Math.abs(y) > env ? 0.01 : 0.0004);
      const over = Math.max(0, 20 * Math.log10(env + 1e-9) + 24); // 3:1 above -24 dBFS
      x[i] = y * dbfs(-over * (2 / 3));
    }
    add(voice, x, len(v.at));
  }
  const vr = rms(voice, 0.01);
  if (vr > 0) for (let i = 0; i < n; i++) voice[i] *= dbfs(-19) / vr;
  // the music (none when the page asks only for effects), ducked where the voice is
  const [mL, mR] = score.length ? music(score, total) : [new Float32Array(n), new Float32Array(n)], mr = rms(mL);
  let env = 0;
  for (let i = 0; i < n; i++) {
    env += (Math.abs(voice[i]) - env) * (Math.abs(voice[i]) > env ? 0.004 : 0.00012);
    const g = (mr ? dbfs(musicDb) / mr : 1) * (1 - 0.65 * Math.min(1, env / 0.05));
    mL[i] *= g; mR[i] *= g;
  }
  // the effects, panned, with a send to the hall
  const fx = [new Float32Array(n), new Float32Array(n)], send = [new Float32Array(n), new Float32Array(n)];
  const cache = new Map();
  for (const [k, c] of sfx.entries()) {
    const seed = c.seed ?? 100 + k, pitch = c.pitch ?? 0, key = `${c.name}/${pitch}/${seed}`;
    if (!cache.has(key)) cache.set(key, STEREO[c.name] ? STEREO[c.name]({ seed, pitch }) : EFFECTS[c.name]({ seed, pitch }));
    const s = cache.get(key), [l, r] = Array.isArray(s) ? s : [s, s];
    const pan = Math.max(-1, Math.min(1, c.pan ?? 0)), g = (c.gain ?? 1) * dbfs(-10);
    const gl = Array.isArray(s) ? 1 : Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2, gr = Array.isArray(s) ? 1 : Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const at = len(c.at), wet = SEND[c.name] ?? 0.2;
    add(fx[0], l, at, g * gl); add(fx[1], r, at, g * gr);
    add(send[0], l, at, g * gl * wet); add(send[1], r, at, g * gr * wet);
  }
  const [hL, hR] = new Reverb({ room: 0.86, damp: 0.3 }).process(send);
  // a small room on the voice, so it sits in a space with the rest
  const [vL, vR] = new Reverb({ room: 0.62, damp: 0.5 }).process([voice, voice]);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = voice[i] + vL[i] * 0.35 + mL[i] + fx[0][i] + hL[i] * 0.6;
    R[i] = voice[i] + vR[i] * 0.35 + mR[i] + fx[1][i] + hR[i] * 0.6;
  }
  // a limiter at -1 dBFS: the gain falls at once on a peak and comes back over 150 ms
  let gain = 1;
  const rel = 1 - Math.exp(-1 / (0.15 * SR)), ceil = dbfs(-1);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i])), need = p * gain > ceil ? ceil / p : 1;
    gain = need < gain ? need : gain + (1 - gain) * rel;
    L[i] *= gain; R[i] *= gain;
  }
  return [L, R];
}

// A docs clip's bed is quieter than a launch's: it plays under an explanation, and it loops.
export const DOCS_MUSIC_DB = -33;
const CLICK_AFTER_MS = 700; // an app step clicks this long after it starts: the cursor travels first (surfaces/app.mjs)

/**
 * The sound every docs clip gets, from its recorded steps alone, so all clips sound alike: a quiet bed, a key for
 * each character typed and each key pressed, a tap on a click, a pop when a caption comes in, a breath of air on a
 * zoom, a chime to close. `scenes`: the takes back to back, [{ durationMs, scale, events: [{ at, step }] }].
 */
export function demoSound(scenes) {
  const sfx = [];
  const cue = (name, ms, gain, o = {}) => sfx.push({ name, at: +(Math.max(0, ms) / 1000).toFixed(3), gain, seed: 500 + sfx.length, ...o });
  let t0 = 0;
  cue('whoosh-up', 0, 0.16);
  for (const s of scenes) {
    for (const { at: planned, step } of s.events) {
      const at = t0 + planned * s.scale;
      const typed = step.type ?? step.run ?? (step.fill ? Object.values(step.fill).join('') : undefined);
      if (typed !== undefined) [...String(typed)].slice(0, 80).forEach((_, i) => cue('key', at + i * TYPING_MS * s.scale, 0.14));
      if (step.key !== undefined) cue('key', at, 0.3);
      if (step.click !== undefined) cue('tap', at + CLICK_AFTER_MS, 0.35);
      if (step.caption) cue('pop', at, 0.16, { pitch: 5 });
      if (step.zoom === 'off') cue('whoosh-down', at, 0.14);
      else if (step.zoom) cue('whoosh', at, 0.16);
    }
    t0 += s.durationMs;
  }
  if (t0 > 4000) cue('success', t0 - 1400, 0.2);
  return { score: [{ at: 0, mood: 'focus' }], sfx: sfx.filter((c) => c.at * 1000 <= t0) };
}

/** Write the track to `out` (16-bit WAV) at -15 LUFS integrated, -1.5 dBTP, measured by FFmpeg's loudnorm. */
export function soundtrack(opts, out) {
  const raw = `${out}.raw.wav`;
  fs.writeFileSync(raw, wav(mix(opts)));
  const target = 'I=-15:TP=-1.5:LRA=11';
  const m = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const j = JSON.parse(/\{[\s\S]*?\}/.exec(m.stderr.slice(m.stderr.lastIndexOf('[Parsed_loudnorm')))[0]);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `loudnorm=${target}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', String(SR), '-c:a', 'pcm_s16le', out], { encoding: 'utf8' });
  fs.rmSync(raw, { force: true });
  if (r.status !== 0) throw new Error(`sound: FFmpeg could not write ${path.basename(out)}: ${r.stderr.trim()}`);
  return { loudness: Number(j.input_i), peak: Number(j.input_tp) };
}

/** Load a filled page headless and read what it asks of the soundtrack: { score, sfx }. */
export async function readCues(project) {
  const { chromium } = await import('@playwright/test');
  const { serve } = await import('../surfaces/app.mjs');
  const site = await serve(project), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.base}/index.html`, { waitUntil: 'load' });
    // a boolean: a GSAP timeline has a then(), so waiting on the timeline itself waits for a paused one to finish
    await page.waitForFunction(() => !!window.__timelines?.main, null, { timeout: 30000 }).catch(() => {
      throw new Error(`sound: the page never built its timeline${errors.length ? `: ${errors.join('; ')}` : ''}`);
    });
    return await page.evaluate(() => ({ score: window.SCORE ?? [], sfx: window.SFX ?? [] }));
  } finally {
    await browser.close();
    site.close();
  }
}
