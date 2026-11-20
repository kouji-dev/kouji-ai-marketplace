---
name: video-script
description: Write and draft an Orrery video from a script — a docs clip of a feature, a daily showcase from the day's commits, or a brief — as videos/scripts/**/video.yaml, check it, render a draft on the real model and look at its frames. Use when asked for a demo clip, a docs video, a daily or feature showcase, a video for a commit, or a launch video. Never posts anything.
---

# Video scripts

The pipeline is `videos/` (plan 20, decisions 0036 and 0037): one `video.yaml` per video, recorded on the real
binary with a real model (Claude Haiku 5.5 by default). Read `videos/README.md` first: the steps, the world, the
limits. This skill is the loop an agent follows; the person reviews the YAML and the draft.

**Where the pipeline is.** This plugin ships it at `${CLAUDE_PLUGIN_ROOT}/videos/` (`pipeline/`, the two sample worlds
under `scripts/shared/worlds/`, and `README.md`), as it runs in the Orrery repository. A project without a `videos/`
folder copies that folder to its root, adds the four dependencies from `${CLAUDE_PLUGIN_ROOT}/package.json` and its
`videos:*` scripts, then runs `pnpm videos:doctor`. A project that already has `videos/` uses its own copy.

Before you rely on it:

- The world stage (`pipeline/stages/world.mjs`) builds Orrery sandbox homes and runs Orrery's dev build; another CLI
  needs its own world there.
- Clips land in `docs-site/media/` (`pipeline/paths.mjs`) and a `kind: demo` must name a `docs-site/` page.
- Rendering needs VHS, ttyd, FFmpeg, PowerShell 7 and Node 22, and a take calls a real model unless the world has
  `replies:`.

## 1. Pick what to show

- **From a docs page:** the flow the page explains, in the order it explains it.
- **From the day's commits:** `git log --since=<day> --format="%h %ad %s" --date=short main`, then keep the `feat` and
  user-facing `fix` commits. A good daily shows one thing a person can see or type (a command, a key, a screen) in
  under 25 s. Skip release, CI, refactor and docs-only commits. Name the commit in a comment at the top of the script.
- **From a brief:** the one sentence the video must prove.

If the feature has no docs clip yet, write the demo first (`kind: demo`, embedded in its docs page), then the
showcase on top of it with `uses:`.

## 2. Write the script

- A docs clip: `videos/scripts/demos/<id>/video.yaml`, `kind: demo`, `docs: <section>/<page>.md`, and the page embeds
  `![<title>](../media/<id>.mp4)` on a line of its own. It speaks: a `say:` line under every `caption:` (decision
  0037). Never write sound into it: every clip gets the same voice, bed and effects from the pipeline. Then tick its
  row in plan 20's Clip coverage, or add the row.
- A daily: `videos/scripts/marketing/daily/<yyyy-mm-dd>-<slug>/video.yaml`, `kind: showcase`, `voice: af_heart`,
  `uses: demos/<id>`, one `say:` line per captioned beat of that demo, `hook:` and `end:` cards, and `post:` (280
  characters at most).
- A launch: `videos/scripts/marketing/launch/<name>/video.yaml`, `kind: launch`: `card: hook` and `card: cta` scenes
  around `uses: demos/<id>` scenes, each with one `say:` line (or one per beat). Under a minute for Product Hunt; music
  only from `shared/music/` with its `.licence.md`.
- A launch as motion design (a product launch film, not a screen recording): `motion: motion.html` beside the script,
  `beats:` (one `say:` each) and footage as `terminal:` scenes with `id:` and `mark:` steps (`videos/README.md`, Motion
  launches). Tell a story, not a docs tour: the problem in the viewer's words, the turn, the value, the call to act.
  Land each animation on its spoken word (`W(beat, word)` or `times(beat, words)` in the example page), and give
  footage room with `min:`. Several products: one act each, its problem first, and each answer mirroring a problem
  shown earlier. Say what is not shipped yet the way the site does (`coming soon`), on screen and in the voice.
  Show the ADE, Cloud and the phone with `stills:` (shots of their `design/` boards, `videos/README.md`), never as UI
  drawn again in the page: move crops of a shot (`find:`), and cross-fade to the state after a `click:`.
  Give it a soundtrack: a `window.SCORE` mood per act (the problem `dark` or `tense`, the answer `lift` or `drive`, the
  close `resolve`) and a `window.SFX` cue for every motion a viewer should feel (a whoosh on a camera move, a hit on a
  reveal, a tap on a tap), at the same times the timeline uses. Keep effects under the voice (`gain` 0.2 to 0.5).
  Direct the look the same way (the example's helpers): change the light with the act (`grade`: cold for the problem,
  a bloom on the reveal), give each impact weight (`shake`, `punch`), blur a fast cut (`whip`), and mark a reveal
  (`sweep`, `sparks`). A scene whose light, camera and sound never change reads as slides.
- **Say the name, but not over the closing wordmark:** spell it `Oruh-ree` (Kokoro reads "Orrery" as "Ori"):
  `Meet Oruh-ree.`, `The Oruh-ree ADE…`. The last card shows the wordmark, and its line leaves the name out
  (`Nothing hidden.`, `Build the agent you want.`).

```yaml
kind: showcase
title: See what your agent sends the model
voice: af_heart
uses: demos/context-window
hook: { text: What is your agent sending the model?, say: Ever wondered what your agent actually sends the model? }
say:
  - In Orrery, type slash context.
  - Every part of the window, in tokens. The prompt, the tools, the results, the messages.
  - And when it will compact, and who does it.
end: { text: getorrery.dev, say: Nothing hidden. }   # the card shows the wordmark: the voice leaves the name out
post: "New in Orrery: /context shows what fills your model's context window, part by part. getorrery.dev"
```

Rules that keep a take working:

- **Prompts say what to do and what not to:** `Add a test for greeting in tests/greeting.rs. Do not run it.` The model
  is real; leave it room to take another path and the take fails or shows something else.
- **Wait for what the product draws**, never for the model's words: the hint `enter send` (a turn ended, via
  `reply:`), the consent choices `allow once`, a command's own output.
- **Show a turn with `reply: <time>`**: 3 to 6 s of it, then a cut to its end.
- **A web page is an `app:` scene with `url:`** (`/` is the site in `landing/`): `click:` by a link's or button's name,
  `fill:`, `scroll:`, `zoom: target`. It records headless in real time; the ADE is not recorded yet.
- **Write `say:` lines to be spoken**: `slash context`, not `/context`. The captions show these words.
- **Captions and say lines are short:** a caption under 70 characters; a say line one or two sentences.
- **The caption says what, the voice adds why:** `/cost shows tokens and cost, turn by turn` on screen; `Slash cost
  shows the tokens and the cost of every turn, so the bill is never a surprise.` spoken. Speak a flag as words (`the
  json flag`, `with consent set to never`): a bare flag name can read as the opposite. Spell the name `Oruh-ree`.
- **Key names:** `Ctrl+R`, `Esc`, `Enter` on screen; `Control R`, `Escape` in the voice.
- **The world is a sandbox:** `world.config` sets rules (`[permissions]`), never a provider or a key. An `ask` that names
  a tool replaces the floor's `tool(*)`: add `allow = ["tool(*)"]` beside it.

## 3. Check, draft, look

```bash
pnpm videos:check <id>             # loop on this until it says ok
pnpm videos:render <id> --draft    # a demo lands in docs-site/media/; a showcase in videos/out/<id>/
```

`render` needs `ANTHROPIC_API_KEY` in the shell, VHS and ttyd on `PATH`, and `ORRERY_VIDEOS_BIN` pointing at a copy of
the dev build (`videos/README.md`, Commands). Each render calls the model for real: about 0.001 USD a turn.

Then look at the frames, not just the exit code:

```bash
ffmpeg -v error -i videos/out/<id>/<file>.mp4 -vf "fps=1,scale=480:-1,tile=5x4" -frames:v 1 videos/out/<id>/sheet.png
```

Check: nothing personal on screen (paths are `C:\demo\…`), the turn really ran (tool calls, a streamed answer),
each caption sits on the moment it names, the zoom lands on the right rows, the text is readable at 9:16. A
showcase's voice: `ffmpeg -i <file> -af silencedetect=noise=-35dB:d=0.35 -f null -` lists where speech is; it must
match the `<audio>` clips in `videos/out/<id>/project-16x9/index.html` and never overlap.

## 4. Hand over

Give the person the script, the draft paths, the post text, the model's cost (the footer's `$` in the take) and
anything the take showed that the docs do not say (a product bug goes into plan 20's open questions). **Never post**,
never commit, never render the final quality before they approve the draft.
