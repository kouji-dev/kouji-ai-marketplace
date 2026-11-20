// showcase: a voiced video (plan 20, phase 2). `uses:` takes a demo's world and steps, and its captioned steps become
// the beats the voice speaks; the timeline then makes room for each line. Pure: render.mjs records and renders.
import { compile } from '../surfaces/terminal.mjs';

export const GAP_MS = 500; // silence after a line before the next beat starts; absorbs a few % of calibration

/** A demo's beats: the steps with a caption, in order. A showcase's `say:` list speaks one line per beat. */
export const beatsOf = (video) => video.scenes.flatMap((s) => (s.terminal ?? s.app ?? []).filter((st) => typeof st.caption === 'string'));

/**
 * A showcase's world and scenes, with `say` on the steps that speak and no captions (the voice's words are the
 * captions). With `uses`, `video.say[i]` goes on the demo's i-th captioned step.
 */
export function resolveShowcase(video, used = null) {
  const source = video.uses ? used : video;
  let i = 0;
  const scenes = source.scenes.map((scene) => {
    const key = scene.app ? 'app' : 'terminal';
    return {
      ...scene,
      [key]: scene[key].map((step) => {
        const { caption, ...rest } = step;
        if (!video.uses || typeof caption !== 'string') return rest;
        const line = video.say?.[i++];
        return line ? { ...rest, say: line } : rest;
      }),
    };
  });
  return { world: source.world, scenes };
}

/**
 * A launch's scenes as parts, in order: a card `{ kind: 'card', card, text, say }`, or a take `{ kind: 'take', world,
 * scenes }` whose steps carry `say`. A `uses:` scene records that demo again: its `say:` is one line spoken from the
 * take's first step, or one line per captioned beat. `readDemo(id)` returns a demo's parsed script.
 */
export function launchParts(video, readDemo) {
  return video.scenes.map((scene) => {
    if (scene.card) return { kind: 'card', card: scene.card, text: scene.text, say: scene.say ?? null };
    if (!scene.uses) return { kind: 'take', ...resolveShowcase({ world: video.world, scenes: [scene] }) };
    const take = resolveShowcase({ uses: scene.uses, say: Array.isArray(scene.say) ? scene.say : [] }, readDemo(scene.uses));
    if (typeof scene.say === 'string') {
      const key = take.scenes[0].app ? 'app' : 'terminal';
      const [first, ...rest] = take.scenes[0][key];
      take.scenes[0] = { ...take.scenes[0], [key]: [{ ...first, say: scene.say }, ...rest] };
    }
    return { kind: 'take', ...take };
  });
}

/**
 * The steps with pauses that make room for each spoken line: a beat (a step with `say`, up to the next one or the
 * scene's end) lasts at least its line plus GAP_MS. `lineMs(step)` is how long that step's line is spoken.
 */
export function makeRoom(steps, lineMs, opts) {
  const { events, durationMs } = compile(steps, opts);
  const at = new Map(events.map((e) => [e.index, e.at]));
  const beats = steps.map((_, i) => i).filter((i) => steps[i].say);
  const before = new Map(); // a step's index (or steps.length for the end) -> the pause to put before it, in ms
  beats.forEach((i, k) => {
    const next = beats[k + 1];
    const end = next === undefined ? durationMs : at.get(next);
    const short = lineMs(steps[i]) + GAP_MS - (end - at.get(i));
    if (short > 0) before.set(next ?? steps.length, Math.ceil(short / 100) * 100);
  });
  const out = [];
  steps.forEach((s, i) => {
    if (before.has(i)) out.push({ pause: `${before.get(i)}ms` });
    out.push(s);
  });
  if (before.has(steps.length)) out.push({ pause: `${before.get(steps.length)}ms` });
  return out;
}
