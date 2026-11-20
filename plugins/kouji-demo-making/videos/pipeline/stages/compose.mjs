// compose: a demo's recorded take(s), captions and zoom -> a HyperFrames composition (index.html).
// Pure: compose() returns the HTML; render.mjs writes it beside the clips and renders it.
// The look follows design/landing/landing.dc.html#docs (the docs clip: callout chip bottom-left, terminal frame).
import { FRAME, zoomFor, zoomToBox } from '../surfaces/terminal.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sec = (ms) => Number((ms / 1000).toFixed(2));

/**
 * Captions and zooms of one scene, in seconds from the scene's start, scaled by `scale` (the recorded length
 * over the computed one: the calibration).
 */
export function cues(events, durationMs, { scale = 1, font, cols = 80 }) {
  const captions = [];
  const zooms = [];
  let open = null;
  for (const e of events) {
    const at = e.at * scale;
    if ('caption' in e.step) {
      if (open) open.end = at;
      open = e.step.caption ? { text: e.step.caption, start: at, end: durationMs * scale } : null;
      if (open) captions.push(open);
    }
    if (e.step.zoom === 'off') zooms.push({ at, to: { scale: 1, x: 0, y: 0 } });
    else if (e.step.zoom === 'target') zooms.push({ at, to: e.box ? zoomToBox(e.box) : null }); // an app step's element
    else if (e.step.zoom) zooms.push({ at, to: zoomFor(e.step.zoom, font, cols) });
  }
  return {
    captions: captions.map((c) => ({ text: c.text, start: sec(c.start), duration: sec(c.end - c.start) })),
    zooms: zooms.filter((z) => z.to).map((z) => ({ at: sec(z.at), ...z.to })),
  };
}

/** The band under a docs clip's terminal that holds its caption, so a caption never covers a row of the take. */
export const BAND = 150;

/** The composition for a demo: one or more scenes, back to back. `scenes`: [{ clip, durationMs, cues }]. */
export function compose({ title, scenes }) {
  const { width } = FRAME;
  const height = FRAME.height + BAND;
  let t = 0;
  const layers = [];
  const tweens = [];
  scenes.forEach((s, i) => {
    const d = sec(s.durationMs);
    layers.push(`<div id="w${i}" class="view clip" data-start="${t}" data-duration="${d}" data-track-index="0"><video id="s${i}" class="take clip" src="${esc(s.clip)}" muted playsinline data-start="${t}" data-duration="${d}" data-track-index="2"></video></div>`);
    s.cues.captions.forEach((c, j) => {
      layers.push(`<div id="c${i}_${j}" class="callout clip" data-start="${sec(t * 1000 + c.start * 1000)}" data-duration="${c.duration}" data-track-index="1">${esc(c.text)}</div>`);
      tweens.push(`tl.from("#c${i}_${j}", { opacity: 0, x: -16, duration: 0.35, ease: "power2.out" }, ${sec(t * 1000 + c.start * 1000)});`);
    });
    s.cues.zooms.forEach((z) => {
      tweens.push(`tl.to("#s${i}", { scale: ${z.scale}, x: ${z.x}, y: ${z.y}, duration: 0.7, ease: "power2.inOut" }, ${sec(t * 1000 + z.at * 1000)});`);
    });
    t = sec(t * 1000 + s.durationMs);
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=JetBrains+Mono:wght@400&family=Space+Grotesk:wght@600&display=swap">
<link rel="stylesheet" href="tokens.css"><!-- ui/styles/tokens.css, graphite: copied in by render.mjs -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--well); }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: var(--font-ui); }
  .view { position: absolute; left: 0; top: 0; width: ${width}px; height: ${FRAME.height}px; overflow: hidden; }
  .take { display: block; width: 100%; height: 100%; transform-origin: 50% 50%; }
  .band { position: absolute; left: 0; right: 0; bottom: 0; height: ${BAND}px; background: var(--panel); border-top: 2px solid var(--hair); }
  .callout { position: absolute; left: 64px; right: 64px; bottom: 0; height: ${BAND}px; display: flex; align-items: center; gap: 22px;
    color: var(--ink); font-size: 46px; font-weight: 500; letter-spacing: -.01em; white-space: nowrap; }
  .callout::before { content: ""; flex: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${t}" data-width="${width}" data-height="${height}" data-fps="30">
<div class="band"></div>
${layers.join('\n')}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${tweens.join('\n  ')}
  window.__timelines["main"] = tl;
  tl.seek(0);
</script>
</body>
</html>
`;
}

/**
 * The showcase's three aspects (design/landing/landing.dc.html#docs, the clip frames): where the 16:10 take sits, and the
 * caption under it, never over the TUI's input row. 9:16 also carries the title above the take.
 */
export const ASPECTS = {
  '16x9': { width: 1920, height: 1080, box: { x: 192, y: 24, w: 1536, h: 960, framed: true }, caption: { top: 996, font: 44 }, card: 96 },
  '9x16': { width: 1080, height: 1920, box: { x: 0, y: 622, w: 1080, h: 675 }, title: { top: 150, height: 420, font: 76 }, caption: { top: 1380, font: 64 }, card: 84 },
  '1x1': { width: 1080, height: 1080, box: { x: 0, y: 96, w: 1080, h: 675 }, caption: { top: 820, font: 52 }, card: 80 },
};

export const LEAD_MS = 400; // a card shows this long before its line is spoken

/** How long a card stays: its line, the lead before it and `tail` after it, and never less than `min`. */
export const cardMs = (voice, min = 2200, tail = 700) => Math.max(min, (voice?.durationMs ?? 0) + LEAD_MS + tail);

/**
 * A showcase in one aspect: the hook card, the take(s) with the voice and its captions, the end card.
 * `hook` / `end`: { text, voice?: { src, durationMs } }. `scenes`: [{ clip, durationMs, cues: { zooms }, beats: [{ at
 * (ms, from the scene's start), src, durationMs, chunks: [{ text, start, end }] }] }]. Pure: returns the HTML.
 */
export function composeShowcase({ title, aspect, hook, end, scenes }) {
  return composeSegments({
    title,
    aspect,
    heading: hook.text,
    segments: [
      { kind: 'card', id: 'hook', title: hook.text, sub: 'orrery', voice: hook.voice, durationMs: cardMs(hook.voice) },
      ...scenes.map((s) => ({ kind: 'take', ...s })),
      { kind: 'card', id: 'end', logo: true, sub: end.text, voice: end.voice, durationMs: cardMs(end.voice, 2600, 1000) },
    ],
  });
}

/**
 * Cards and takes, back to back, in one aspect (a showcase, a launch). A card: { id, title?, sub?, logo?, voice?,
 * durationMs }, its line spoken LEAD_MS in. A take: { clip, durationMs, cues: { zooms }, beats }, in the aspect's box
 * with its beats' captions under it, and `heading` above it where the aspect has room (9:16). `music`: { src, volume }
 * under the whole video. Pure: returns the HTML.
 */
export function composeSegments({ title, aspect, segments, heading = null, music = null }) {
  const a = ASPECTS[aspect];
  const { width, height, box } = a;
  const k = box.w / FRAME.width; // the take is drawn at this scale: zoom shifts are in the take's own pixels
  const total = segments.reduce((n, s) => n + s.durationMs, 0);
  const layers = [];
  const tweens = [];
  const voice = (id, v, at) => {
    if (v) layers.push(`<audio id="${id}" class="clip" src="${esc(v.src)}" data-start="${sec(at)}" data-duration="${sec(v.durationMs)}" data-volume="1" data-track-index="5"></audio>`);
  };

  let t = 0;
  let c = 0;
  let i = 0;
  for (const s of segments) {
    if (s.kind === 'card') {
      const inner = s.logo
        ? `<orr-logo class="card-logo" wordmark size="${Math.round(a.card * 1.4)}"></orr-logo>`
        : `<div class="card-title">${esc(s.title)}</div>`;
      layers.push(`<div id="${s.id}" class="card clip" data-start="${sec(t)}" data-duration="${sec(s.durationMs)}" data-track-index="0">${inner}${s.sub ? `<div class="card-sub">${esc(s.sub)}</div>` : ''}</div>`);
      tweens.push(s.logo
        ? `tl.from("#${s.id} .card-logo", { opacity: 0, scale: 0.92, duration: 0.6, ease: "power2.out" }, ${sec(t + 100)});`
        : `tl.from("#${s.id} .card-title", { opacity: 0, y: 30, duration: 0.6, ease: "power2.out" }, ${sec(t + 100)});`);
      voice(`v-${s.id}`, s.voice, t + LEAD_MS);
    } else {
      // The wrapper is a root clip (laid out full-frame); the take is a clip nested in its box, timed from the start.
      layers.push(`<div id="w${i}" class="clip" data-start="${sec(t)}" data-duration="${sec(s.durationMs)}" data-track-index="1"><div class="box"><video id="s${i}" class="take clip" src="${esc(s.clip)}" muted playsinline data-start="${sec(t)}" data-duration="${sec(s.durationMs)}" data-track-index="2"></video></div></div>`);
      tweens.push(`tl.from("#w${i}", { opacity: 0, duration: 0.3 }, ${sec(t)});`);
      for (const z of s.cues.zooms) {
        tweens.push(`tl.to("#s${i}", { scale: ${z.scale}, x: ${Math.round(z.x * k)}, y: ${Math.round(z.y * k)}, duration: 0.7, ease: "power2.inOut" }, ${sec(t + z.at * 1000)});`);
      }
      s.beats.forEach((b, j) => {
        voice(`v${i}-${j}`, { src: b.src, durationMs: b.durationMs }, t + b.at);
        for (const ch of b.chunks) {
          layers.push(`<div id="c${c}" class="caption clip" data-start="${sec(t + b.at + ch.start)}" data-duration="${sec(ch.end - ch.start)}" data-track-index="4"><span>${esc(ch.text)}</span></div>`);
          tweens.push(`tl.from("#c${c}", { opacity: 0, y: 10, duration: 0.18, ease: "power2.out" }, ${sec(t + b.at + ch.start)});`);
          c++;
        }
      });
      if (a.title && heading) {
        layers.push(`<div id="t${i}" class="title clip" data-start="${sec(t)}" data-duration="${sec(s.durationMs)}" data-track-index="3"><span>${esc(heading)}</span></div>`);
        tweens.push(`tl.from("#t${i} span", { opacity: 0, y: 20, duration: 0.5, ease: "power2.out" }, ${sec(t)});`);
      }
      i++;
    }
    t += s.durationMs;
  }
  if (music) layers.push(`<audio id="music" class="clip" src="${esc(music.src)}" data-start="0" data-duration="${sec(total)}" data-volume="${music.volume}" data-fade-in="1" data-fade-out="2" data-track-index="6"></audio>`);

  const cap = a.caption;
  const tt = a.title ?? { top: 0, height: 0, font: 0 };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width}, height=${height}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=JetBrains+Mono:wght@400&family=Space+Grotesk:wght@600&display=swap">
<link rel="stylesheet" href="tokens.css"><!-- ui/styles/tokens.css, graphite: copied in by render.mjs -->
<script src="orr-logo.js"></script><!-- landing/orr-logo.js: the end card's wordmark, copied in by render.mjs -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--well); }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: var(--font-ui); }
  .box { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; overflow: hidden; background: var(--well);${box.framed ? ' border: 2px solid var(--hair); border-radius: var(--r-md);' : ''} }
  .take { display: block; width: 100%; height: 100%; transform-origin: 50% 50%; }
  .caption { position: absolute; left: 5%; right: 5%; top: ${cap.top}px; text-align: center; }
  .caption span { display: inline-block; font-size: ${cap.font}px; line-height: 1.25; font-weight: 600; color: var(--ink);
    background: color-mix(in srgb, var(--panel) 85%, transparent); border-radius: var(--r-sm); padding: ${Math.round(cap.font * 0.2)}px ${Math.round(cap.font * 0.5)}px; }
  .title { position: absolute; left: 8%; right: 8%; top: ${tt.top}px; height: ${tt.height}px; display: flex; align-items: center; justify-content: center; text-align: center; }
  .title span { font-family: var(--font-brand); font-weight: 600; font-size: ${tt.font}px; line-height: 1.15; letter-spacing: -.015em; color: var(--ink); text-wrap: balance; }
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(a.card / 3)}px; padding: 0 8%; text-align: center;
    background: radial-gradient(60% 80% at 30% 0%, rgba(var(--accent-rgb), .22), transparent 70%), var(--panel); }
  .card-title { font-family: var(--font-brand); font-weight: 600; font-size: ${a.card}px; line-height: 1.1; letter-spacing: -.015em; color: var(--ink); text-wrap: balance; }
  .card-sub { font-family: var(--font-mono); font-size: ${Math.round(a.card * 0.42)}px; color: var(--ink-3); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${sec(total)}" data-width="${width}" data-height="${height}" data-fps="30">
${layers.join('\n')}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${tweens.join('\n  ')}
  window.__timelines["main"] = tl;
  tl.seek(0);
</script>
</body>
</html>
`;
}

/** How long a beat of a motion launch lasts: its line, LEAD_MS before it and `tail` after, never less than `min`. */
export const beatMs = (voice, min = 0, tail = 450) => Math.max(min, voice ? voice.durationMs + LEAD_MS + tail : 0);

/**
 * An authored motion composition (`motion:` in a launch), filled in. Every `data-beat="<id>"` element gets that beat's
 * start and length; every `data-take="<id>"` video its clip, starting at the step marked `data-from="<mark>"`;
 * `{{total}}` becomes the length, `<!--voices-->` the spoken lines, and `window.BEATS` ({ id: { start, duration } },
 * seconds; `words`: [text, at] when the transcript has them) and `window.MARKS` ({ take: { mark: seconds into it } })
 * are defined before the page's own scripts. `beats`: { id: { start, duration, voice? } } in ms; `takes`:
 * { id: { src, marks: { mark: ms } } }. Pure: returns the HTML, and throws naming what is missing.
 */
export function fillMotion(html, { beats, takes, total, stills = {}, sound = null }) {
  const beat = (id) => {
    if (!beats[id]) throw new Error(`motion: the page uses beat ${id}; add it to the script's beats:`);
    return beats[id];
  };
  const out = html
    .replace(/data-beat="([a-z0-9-]+)"/g, (m, id) => `${m} data-start="${sec(beat(id).start)}" data-duration="${sec(beat(id).duration)}"`)
    .replace(/data-take="([a-z0-9-]+)"(?: data-from="([a-z0-9-]+)")?/g, (m, id, mark) => {
      const t = takes[id];
      if (!t) throw new Error(`motion: the page plays take ${id}; give a terminal scene id: ${id}`);
      const from = mark ? t.marks[mark] : 0;
      if (from === undefined) throw new Error(`motion: take ${id} has no step with mark: ${mark}`);
      return `${m} src="${esc(t.src)}" data-media-start="${sec(from)}" muted playsinline`;
    });
  // the voice clips, or the one track (stages/sound.mjs) that already holds them with the music and the effects
  const voices = sound
    ? [`<audio id="sound" class="clip" src="${esc(sound)}" data-start="0" data-duration="${sec(total)}" data-volume="1" data-track-index="9"></audio>`]
    : Object.entries(beats).filter(([, b]) => b.voice).map(([id, b]) =>
      `<audio id="v-${id}" class="clip" src="${esc(b.voice.src)}" data-start="${sec(b.start + LEAD_MS)}" data-duration="${sec(b.voice.durationMs)}" data-volume="1" data-track-index="9"></audio>`);
  const timing = Object.fromEntries(Object.entries(beats).map(([id, b]) => [id, {
    start: sec(b.start),
    duration: sec(b.duration),
    words: (b.voice?.words ?? []).map((w) => [w.text, sec(b.start + LEAD_MS + w.start * 1000)]),
  }]));
  const marks = Object.fromEntries(Object.entries(takes).map(([id, t]) => [id, Object.fromEntries(Object.entries(t.marks).map(([m, at]) => [m, sec(at)]))]));
  return out
    .replace('{{total}}', String(sec(total)))
    .replace('<!--voices-->', voices.join('\n'))
    .replace('</head>', `<script>window.BEATS = ${JSON.stringify(timing)};\nwindow.MARKS = ${JSON.stringify(marks)};\nwindow.STILLS = ${JSON.stringify(stills)};</script>\n</head>`);
}
