// replies: a script's `world.replies` as fixture-provider streams, one .jsonl per reply. orrery takes one
// `--provider fixture:<file>` per pass, in order, and the last repeats.
// A `text` reply streams in small chunks at a reading pace; a `tool` reply asks for one tool call, after its text.

const CHUNK = 12; // characters per text-delta
const DELAY = 28; // ms between deltas: about 430 characters a second

const jsonl = (lines) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

/** One .jsonl per reply. An empty list still answers once, so a stray prompt never hangs. */
export function repliesToStreams(replies) {
  const turns = replies.length ? replies : [{ text: 'Ready.' }];
  return turns.map((r, i) => {
    const lines = [{ t: 'started', id: `msg_video_${i + 1}` }];
    const text = String(r.text ?? '');
    for (let k = 0; k < text.length; k += CHUNK) lines.push({ delay_ms: DELAY, t: 'text-delta', text: text.slice(k, k + CHUNK) });
    if (r.tool) {
      const call = `0192f3a0-0000-7000-8000-${String(i + 1).padStart(12, '0')}`;
      lines.push({ t: 'tool-use-start', call, name: r.tool });
      lines.push({ t: 'tool-use-delta', call, json_fragment: JSON.stringify(r.input ?? {}) });
      lines.push({ t: 'tool-use-end', call });
      lines.push({ t: 'usage', usage: { input_tokens: 900, output_tokens: 40, cache_hits: 0 } });
      lines.push({ t: 'done', stop: 'tool-use' });
    } else {
      lines.push({ t: 'usage', usage: { input_tokens: 900, output_tokens: Math.ceil(text.length / 4), cache_hits: 0 } });
      lines.push({ t: 'done', stop: 'end-turn' });
    }
    return jsonl(lines);
  });
}

/** How long a text reply takes to stream, in ms: what a `wait: {show: all}` on it is timed from. */
export const streamMs = (text) => Math.ceil(String(text).length / CHUNK) * DELAY;
