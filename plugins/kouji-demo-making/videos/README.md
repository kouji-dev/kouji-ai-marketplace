# Videos

Docs clips, daily showcases and launch videos, made from scripts. It was built for Orrery (its platform decisions 0036 and 0037 and plan 20, in its own repository) and is shipped here as it
runs there. Kept apart from the tests: nothing here imports a test script or a
test stream, and no test reads this folder.

**Built:** docs clips (`kind: demo`), voiced daily showcases (`kind: showcase`, in 16:9, 9:16 and 1:1) and launch
videos (`kind: launch`, 16:9 for YouTube and Product Hunt, 1:1 for X) of the terminal, on a real model, and `app:`
scenes of web pages in a headless browser, with an animated cursor and click ripples (playwright-recast). **Not built
yet:** recording the ADE (phase 3): its window has to be on screen while it records. The project skill `.claude/skills/video-script/` is the loop an agent follows
to write one.

```
videos/
├── pipeline/          code only: cli.mjs, schema.json, stages/, surfaces/, test/
├── scripts/           content only
│   ├── demos/<id>/video.yaml          one per docs clip; the folder name is the clip's id
│   ├── marketing/                     daily/ and launch/ (phases 2 and 4)
│   └── shared/worlds/                 presets (fresh/) and sample projects (sample-rust/)
└── out/               gitignored: what a render delivers (the cuts, post.txt) and the composed projects; the world templates
```

## Commands

```bash
pnpm videos:check [id]            # validate one script, or all; renders nothing
pnpm videos:render <id> [--draft] # one clip end to end; a demo lands in docs-site/media/
pnpm videos:preview <id>          # HyperFrames studio on the composed project, after a render
pnpm videos:stale [--draft]       # re-render every docs clip whose script changed or whose Orrery minor moved
pnpm videos:doctor                # what the pipeline needs, and the install line for what is missing
node --test videos/pipeline/test/pipeline.test.mjs   # the pipeline's tests (nothing is recorded or rendered)
```

`render` needs:

- a dev build (`pnpm orrery:build`): it reads `CARGO_TARGET_DIR/debug`, or the binary named by `ORRERY_VIDEOS_BIN`.
  Another worktree can relink the shared target's binary at any time, so copy the build out (with its `extensions/`
  folder beside it) and point `ORRERY_VIDEOS_BIN` at the copy;
- the model's key in the shell, `ANTHROPIC_API_KEY` for the default model, unless the world has `replies:`;
- VHS and ttyd (`winget install charmbracelet.vhs tsl0922.ttyd`), FFmpeg, PowerShell 7 and Node 22. HyperFrames is
  fetched by `pnpm dlx` at a pinned version.

## Write a clip

```yaml
# videos/scripts/demos/consent-a-write/video.yaml
# yaml-language-server: $schema=../../../pipeline/schema.json
kind: demo                       # a docs clip: voiced, loops, captions in a band under the 16:10 take
title: Answer a consent prompt
docs: use/permissions.md         # the page that embeds it; check fails if it does not
world:
  home: fresh                    # every shipped extension installed (without: [git] leaves some out)
  workspace: sample-rust         # the sample project, copied for each take
  terminal: 80x24                # columns x rows (80 by default: the text reads at docs width)
  # model: anthropic:claude-haiku-5-5   the default: the take calls it for real
  config: |                      # optional TOML for the sandbox: rules, never a provider or a key
    [permissions]
    allow = ["tool(*)"]
    ask = ["tool(builtin.write)"]
scenes:
  - terminal:
      - run: orrery              # waits, cut, until the session is built
      - type: Add a test for greeting in tests/greeting.rs. Do not run it.
        caption: A call that matches an ask rule waits for you
        say: A call that matches an ask rule waits for you. Here, every write asks first.
      - key: Enter
      - wait: { for: allow once, show: 3s, timeout: 120s }
        caption: The consent bar says what it wants to do
        say: The consent bar says what the agent wants to do, and which rule asked.
      - pause: 6s                # the bar stays while its keys are named
        caption: y allows once; a always, n denies, d always denies, e explains
        say: Press Y to allow it once. A always allows, N denies, D always denies, and E explains why it asked.
      - key: y
      - reply: 3s                # 3 s of the live turn, then a cut to its end
      - pause: 2.5s
```

Then embed it in its page, on a line of its own: `![Answer a consent prompt](../media/consent-a-write.mp4)`.

| Step | Does | Visible time |
|---|---|---|
| `run: <command>` | types it at the shell and enters it; a bare `orrery` waits until the session is built (the hint `enter send`, or `until:`) | typing, then 0.4 s, a cut, 0.8 s |
| `type: <text>` | types it at 45 ms a character | typing + 0.9 s |
| `key: Down 2` | a key, repeated; a single lowercase letter is typed (`key: i`) | 45 ms a press + 0.4 s (Esc: 1 s) |
| `wait: <text>` | waits for the text anywhere on screen; `{ for, show: 1.5s, timeout: 60s }` shows more of the wait; `show: all` shows all of it (time it with `seconds:`) | 0.4 s, a cut, 0.8 s |
| `reply: 5s` | the agent's turn, live: a cut to its start (`Turn running`), that much of it at real speed, then a cut to its end (`enter send` again, up to 180 s) | the given time + 0.8 s |
| `pause: 1.5s` | holds | exactly that |
| `vhs: <lines>` | raw VHS commands, with `seconds:` their visible time | `seconds` |

On any step: `caption:` (on screen from that step until the next caption; `null` clears it), `say:` (the line spoken
from that step: the take leaves room for it) and `zoom:` (`rows a-b [cols c-d]` eases in on that box, `off` eases
out). A terminal scene with no `zoom:` follows the text: at each caption the camera frames what is on screen (a
command and its output), up to 2×, and stays whole on a full-screen app such as the TUI (`stages/follow.mjs`).

**Write the say line to add what the caption leaves out.** The caption says what is on screen (`/cost shows tokens and
cost, turn by turn`); the voice says it in spoken words and adds why it matters (`…so the bill is never a surprise`).
Speak a flag as words (`the json flag`, `with consent set to never`), never its bare name, which can read as the opposite.

**A docs clip speaks** (decision 0038): every captioned step has its `say:` line, written to be spoken (`slash
context`, `Oruh-ree` for the name), and `check` refuses a caption without one. The voice is the pipeline's docs voice
(`af_heart` at 0.95; `voice:` names another). The sound is the same for every clip and is never written in a script:
`demoSound` (`stages/sound.mjs`) derives it from the recorded steps (a key for each character typed and each key
pressed, a tap on a click, a pop when a caption comes in, air on a zoom, a chime to close) over one quiet bed, and
mixes it with the voice at -15 LUFS. In the docs the clip starts muted; its Sound button turns the voice on. A `setup:` list before `terminal:` runs hidden, before
the clip starts: an open session, a real answer already on screen. A setup that ends at the shell prompt (its last
step a `run:` with `until:`) is cleared before the clip, so files it wrote are there and its command is not.

**A web page** is an `app:` scene with a `url:`: a path served from `landing/` (the site as built, so run
`node scripts/site/build-docs.mjs` first for docs pages) or an `https://` address. Playwright drives headless
Chromium at 1280×800, drawn at 1.5× (the 1920×1200 frame); recast adds the cursor's path and a ripple on each click.

```yaml
  - url: /
    app:
      - pause: 1.2s
      - click: Install             # a link, button or tab by its name, else visible text
        caption: One line installs it
      - click: Windows
        zoom: target               # ease in on what this step clicked
      - pause: 2s
        zoom: off
```

| App step | Does | Visible time |
|---|---|---|
| `click: <name>` | moves the cursor there (0.7 s), clicks | 0.7 s + the click + 0.4 s |
| `fill: { <label>: <text> }` | clicks the field by its label, types at 45 ms a character | typing + 0.9 s |
| `type: <text>`, `key: <key>` | as in the terminal (`Down` is the arrow key) | as in the terminal |
| `wait: <text>` | until the text is on the page | all of it: app takes are real time |
| `scroll: 600` | scrolls smoothly by that many CSS pixels (negative: up) | about 0.6 s + 0.4 s |
| `pause: 1.5s` | holds | exactly that |

**The world's model.** With no `replies:`, the take calls `world.model` for real (default
`anthropic:claude-haiku-5-5`). With `replies:` (a list of `text`, `tool` + `input`), it replays them through the fixture
provider instead: no key, no cost, the same every take. A world has one or the other.

## Write a daily showcase

A showcase speaks over a demo: `uses:` takes the demo's world and steps, and each of its captioned beats gets one
`say:` line. The voice is made first (Kokoro, through `hyperframes tts`; word timings from Parakeet, through
`hyperframes transcribe`), the beats are padded so no line runs into the next, then the take is recorded and composed
three times.

```yaml
# videos/scripts/marketing/daily/2026-11-09-context/video.yaml
# yaml-language-server: $schema=../../../../pipeline/schema.json
# From da7f6d41 (2026-11-06): /context and orrery context.
kind: showcase
title: See what your agent sends the model
voice: af_heart                  # or { name: am_adam, speed: 0.95 }; pnpm dlx hyperframes@0.9.20 tts --list
uses: demos/context-window       # one say line per captioned beat of it, in order
hook:
  text: What is your agent sending the model?
  say: Ever wondered what your agent actually sends the model?
say:
  - In Orrery, type slash context.
  - Every part of the window, in tokens. The prompt, the tools, the results, the messages.
  - And when it will compact, and who does it.
end:
  text: getorrery.dev
  say: Orrery. Nothing hidden.
post: "New in Orrery: /context shows what fills your model's context window, part by part. getorrery.dev"
```

`pnpm videos:render 2026-11-09-context [--draft]` writes `videos/out/2026-11-09-context/2026-11-09-context-16x9.mp4`,
`-9x16.mp4`, `-1x1.mp4` and `post.txt`. Nothing is copied into the docs and nothing is posted.

The frames are the docs page's (`design/landing/landing.dc.html#docs`, the clip frames on Extend · Install): a hook card, the take in a box
with the spoken words as captions under it (never over the TUI's input row), 9:16 with the title above the take, and
an end card with the wordmark.

## Write a launch video

A launch strings cards and takes together, spoken throughout. A `uses:` scene records that demo again, live; its
`say:` is one line spoken from the take's start, or a list with one line per captioned beat. A `terminal:` scene runs
in the launch's own `world:`, with `say:` on its steps.

```yaml
# videos/scripts/marketing/launch/product-hunt/video.yaml
kind: launch
title: Orrery, the agent you shape
voice: { name: af_heart, speed: 0.95 }
music: { track: shared/music/<track>.mp3, under-voice: -18dB }   # optional; <track>.licence.md must sit beside it
scenes:
  - card: hook                   # its text as a title
    text: Your agent. Your rules.
    say: Every coding agent makes its choices for you. Orrery lets you make them.
  - uses: demos/consent-a-write
    say: Nothing touches your files until you say so. A rule asks first, and you answer with one key.
  - card: cta                    # the wordmark over its text
    text: Free and open source · getorrery.dev
    say: Orrery. Free and open source, at get orrery dot dev.
post: "Orrery: the coding agent you shape. getorrery.dev"
```

`pnpm videos:render <id> [--draft]` writes `videos/out/<id>/<id>-16x9.mp4` and `-1x1.mp4`, and `post.txt`. The frames
are the showcase's.

### Motion launches

A launch made as motion design (kinetic type, animated UI, the product's footage framed inside it) adds `motion:`, an
HTML page beside the script: a HyperFrames composition written by hand, with GSAP. The script keeps what changes
between renders: the spoken `beats:`, and the footage as `terminal:` scenes with an `id:`, recorded live.

```yaml
kind: launch
voice: { name: af_heart, speed: 0.95 }
motion: motion.html
world: { home: fresh, workspace: sample-rust, terminal: 80x24 }
scenes:
  - id: session                  # the page plays it with data-take="session"
    terminal:
      - run: orrery
      - type: Add a test for greeting in tests/greeting.rs. Do not run it.
      - key: Enter
        mark: consent            # the page starts a video here with data-from="consent"
      - wait: { for: allow once, show: 3s }
beats:                           # in order; each lasts its line, a lead and a tail, or min
  - id: open
    say: Coding agents got good. Really good.
    min: 3.4s
```

The render fills the page in: every `data-beat="<id>"` element gets that beat's `data-start` and `data-duration`, a
`data-take` video its clip from the `data-from` mark, `{{total}}` the length, `<!--voices-->` the voice clips. Before the
page's scripts it defines `window.BEATS` (`{ id: { start, duration, words: [[word, at]] } }`, seconds, the words timed
from the voice's transcript) and `window.MARKS` (`{ take: { mark: seconds into the take } }`), so the timeline can land
an animation on a spoken word or a keypress. The page also gets `orr-logo.js`, `tokens.css` and the site's provider and
agent marks by file name (`ai-claude.svg`, `ai-openai.svg`, `ai-gemini.svg`, `agent-claude-code.svg`, `agent-codex.svg`,
`agent-pi.svg`, from `landing/brand/`). The root's `data-fps` sets the frame rate; the launch uses 60 for smooth
motion.

The ADE, Orrery Cloud and the phone come from their boards in `design/` (the mockups the apps match), never drawn
again in the page. `stills:` shoots each one headless at 2x, before the takes run, into the page's folder as
`<id>.png`. A still can click a button first (the prototypes answer: `click: Allow once` gives the allowed state),
replace text (`text:`), hide parts (`hide:`, Playwright selectors: CSS or `text=…`) and measure the boxes the page
needs (`find:`). The page reads them as `window.STILLS` (`{ id: { w, h, find: { name: [[x, y, w, h], …] } } }`, in
board pixels) and moves a part of a shot over the rest: a rail row, a menu, a question sheet.

`board:` is an app page of `design/` and its section, `ade/ade#needs-you` (`#app`, the prototype, when left out). `start:`
opens that section's prototype at one of its states, drawn still (`agent`, `session`, `home`, `push`, `consent`: the
`start` property on the page), and `size:` sets the shot when it is not the page's own (`390x844` for the phone). The
shot is the section alone: the page's section index is left out.

```yaml
stills:
  - { id: ade, board: ade/ade, start: agent, find: { rows: .rail-row } }   # the rows, cropped from this shot
  - { id: ade-rail, board: ade/ade, start: agent, hide: [.rail-row] }       # the same window, its rail empty
  - { id: ade-after, board: ade/ade, start: agent, click: Allow once }      # the prototype's allowed state
  - { id: phone, board: phone/phone, start: home, size: 390x844 }            # the phone, at phone size
  - { id: ade-needs, board: ade/ade#needs-you }                              # a section with no prototype
```

A motion page can ask for a soundtrack, made by the render (`stages/sound.mjs`) rather than sampled: `window.SCORE`
lists the music's mood from a time on, and `window.SFX` an effect at the time of the motion it belongs to, computed
with the same times the timeline uses, so sound and picture cannot drift apart.

```js
window.SCORE = [{ at: 0, mood: 'open' }, { at: T('catch'), mood: 'dark' }, { at: T('meet'), mood: 'lift' }];
window.SFX = [{ name: 'hit', at: T('meet'), gain: 0.85 }, { name: 'tap', at: tap1, gain: 0.45, pan: 0.6 }];
```

The render loads the filled page headless to read them, synthesizes the music (pads, bass, plucks, a light kit, a
drone, 100 BPM; moods `open`, `dark`, `lift`, `drive`, `focus`, `tense`, `night`, `build`, `resolve`) and the effects
(`whoosh`, `whoosh-up`, `whoosh-down`, `whoosh-long`, `suck`, `swirl`, `slide`, `slide-down`, `swell`, `hit`,
`hit-soft`, `thud`, `stamp`, `lock`, `rattle`, `tick`, `tap`, `key`, `pop`, `pluck`, `chime`, `notify`, `success`,
`data`, `alert`, `glitch`, `dissolve`, `roll`; `gain` 1 peaks at -10 dBFS, `pan` -1 to 1, `pitch` in semitones,
`seed` varies a noisy one), lays the voice in, ducks the music 9 dB under it, and writes one track, `sound.wav`, at
-15 LUFS and -1.5 dBTP. The page then plays that track instead of the voice clips. A mood starts its own bars and
its chord progression from the top, so a mood placed on a cut puts the downbeat on that cut.

The example page also directs its look with small helpers on the same timeline, worth copying: `grade` (the
background light's colour by act), `shake` and `punch` (the camera takes a hit: everything framed sits in `#cam`),
`whip` (a few frames of blur on a fast cut), `sweep` (a streak of light on a reveal), `sparks`, drifting dust and
film grain.

The Product Hunt launch is the example: `scripts/marketing/launch/product-hunt/motion.html`, a real CSS 3D stack for
the harness, the live session inside, then the ADE, Cloud web and the phone as shots of their boards, and its cue
sheet at the end of the script.

## How it works

`check` (schema + lint) → `world` (a sandbox, below) → the steps become a VHS tape with every step's start time known
→ VHS records the take → the recorded length calibrates the times → HyperFrames composes the take, the captions and
the zoom, with the caption in a band under the take (never over a row of it) → FFmpeg makes the 1280×900 clip and its
poster → `docs-site/media/<id>.{mp4,jpg,json}`.

A world is built once per (preset, `without`, binary) under `videos/out/.cache/worlds/` and copied for each take to
`C:\demo`, the take's HOME, so tool lines read `C:\demo\sample-rust\src\lib.rs` (`ORRERY_VIDEOS_WORLDS` moves it).
Every take uses that one folder: a take empties it first, and only when the last take marked it (`.orrery-videos`);
a folder of anyone else's is refused, never deleted. Its config gets the model (`[providers] default`,
`[providers.<id>] model`) and a cap per run (`[budget] maxTurns = 20`, `maxUsd = 0.25`). The take's shell removes every
`ORRERY_*` variable, `CARGO_TARGET_DIR` and every `*_API_KEY` but the model's own; it sets HOME to the sandbox (with
`RUSTUP_HOME` and `CARGO_HOME` pinned first, so the agent can still run cargo), a `> ` prompt and no history
prediction, and turns a bare `orrery` into the copied binary. `ORRERY_GRAPHICS=none` keeps the banner in half blocks.

## Limits

- **A render costs money and needs the network.** About 18K tokens a turn, 0.001 USD on Haiku 5.5. A take that loops
  stops at the per-run cap. A missing key fails before anything runs, naming the variable.
- **Every take is different.** The model words its answers its own way and can take another path: a parallel call,
  another tool. Scripts wait for what the product draws (the consent choices, the hint under the input), never for the
  model's words, and say what to do in the prompt (`Do not run it.`). Look at every render before committing it.
- **Terminal only, Windows only so far.** The tape uses PowerShell 7; macOS and Linux are untested.
- **15 fps.** VHS keeps real time at 1920×1200 only up to 15 fps on Windows (25 fps lost half the frames). Typing
  looks a little stepped; the composition is rendered at 30 fps.
- **Times are planned, then calibrated.** VHS reports no per-command time, so a clip's step times are computed and
  scaled by the recorded length; they land within a few frames, up to about 10 % off on a clip with many cuts. A
  visible wait (`show: all`) is a guess; use `reply:` for a turn.
- **Waits are cut.** Real loading time never shows, by design; `reply:` shows only the slice it names.
- **A render cleans up after itself, only when it works.** The takes, tapes, recordings and the take's world
  (`C:\demo`) are deleted; the cuts, `post.txt` and the composed projects (for `preview`) stay. A failed
  render keeps everything, to see why: delete `videos/out/<id>` by hand after. A file still locked is kept and named. A
  new build drops the world templates of the old one (about 0.5 GB each); `videos/out/bin/` is never touched.
- **A motion launch is 16:9 only**, and takes no `music:` track (`check` refuses it beside `motion:`): its music is
  synthesized from the page's `SCORE`. The page is code: a layout change means editing it, and its animations are
  checked only by looking at the frames.
- **The soundtrack is synthesized, and checked by numbers, not by ear.** No samples and no licences, but it sounds
  like synthesis: pads and plucks, no real instruments, one key (A minor and C major), one tempo. Its levels are set
  by measurement (the voice at -19 dBFS RMS while it speaks, the music at -26 dBFS RMS before it ducks, the whole at
  -15 LUFS); a person must listen before it ships. An unknown mood or effect, or a cue outside the film, fails the
  render, naming it. It adds about 10 s to a render and a headless load of the page.
- **Motion pages animate with the GSAP timeline only.** No CSS animation, no `onUpdate` callbacks: HyperFrames seeks
  to each frame, and anything else is not on it. A GSAP transform on an element replaces its CSS `transform`: animate
  a wrapper when the CSS transform must stay (a rotation driven by a variable, an isometric tilt). Hide in CSS
  (`visibility: hidden; opacity: 0`) whatever enters later with a `fromTo` from `autoAlpha: 0`: the renderer showed
  such an element in its plain state before its entrance. Both, never `visibility` alone: render workers seek back and
  forth between chunks, a rewound `fromTo` restores the opacity from before it ran, and `autoAlpha` shows any opacity
  above 0 (every word of a line showed before it was spoken). `hyperframes snapshot --at 20,3.6` checks a backward
  seek. Draw from a seeded random, never `Math.random` or a GSAP
  `random` stagger: each render worker builds the timeline again, and two workers would draw two different films.
- **CSS 3D on a motion page is fragile.** Opacity, a filter or a fade on an element with `transform-style:
  preserve-3d` flattens it, so fade the faces, never the 3D containers. Overlays drawn in 2D over a 3D object do not
  turn with it: hold it still under them. A filter on a plain wrapper around the whole scene is safe (the example
  blurs `#cam` for a few frames on a cut): take it off after (`filter: none`), or every later frame renders through
  it. Keep the camera wrapper at rest between hits: a slow zoom on it makes small text swim.
- **Grain is only as good as the encode.** The example's film grain changes every frame; a `--draft` encode smooths
  most of it away and shows blocks in dark gradients. Judge grain and gradients on a standard render.
- **No motion blur.** HyperFrames turns its shutter blur (`data-motion-blur`) off in a render split across workers,
  which is how the pipeline renders; a motion page gets smooth motion from 60 fps instead, at about twice the render
  time and file size of 30.
- **The ADE, Cloud and the phone are their mockups, not recordings.** A still shows what `design/` draws, which can be
  ahead of or behind the shipped app; only `terminal:` scenes are live footage. A board's demo data shows as it is
  unless `text:` replaces it: the launch swaps the designer's machine names for neutral ones. A selector that matches
  nothing fails the render before the takes, naming the still and the selector. Each shot takes about 3 s and needs
  the network (the boards load their fonts from Google Fonts).
- **The voice says "Ori" for "Orrery".** Kokoro has no pronunciation markup through `hyperframes tts`: a motion
  launch spells it `Oruh-ree` in `say:` (no captions show the spelling); a captioned showcase still says it its own
  way. Over the closing wordmark the line leaves the name out: the card already shows it.
- **A clip breaks when the text it waits for changes.** It fails naming the step, with the last screen in
  `videos/out/<id>/scene-1.log`. Tests are not affected.
- **The consent bar's title can name the wrong tool** when the model runs two calls at once (plan 20, open
  questions): wait for `allow once`, not the title.
- **The banner's pixels can stay on screen** when an overlay covers it in VHS's terminal. Open overlays after a reply
  has scrolled the banner away (a hidden `setup:`), as `extensions-install` does.
- **Esc is swallowed for a moment** right after answering an install question; `extensions-install` cuts 4 s before it.
- **Heavy.** A render runs headless Chrome twice and FFmpeg: about 2 to 3 minutes a clip. One at a time, never beside
  cargo or Playwright. The first `orrery` start in a new world takes several seconds (cut by the wait).
- **One render at a time.** Every take runs in the same folder, `C:\demo`; two renders at once would empty each
  other's. They are too heavy to run side by side anyway.
- **The follow zoom reads pixels.** It frames everything that is not the background colour; a stray coloured cell (a
  cursor left at the bottom) widens the box, and a full-screen app is never zoomed. Name a `zoom:` where it guesses wrong.
- **80 columns by default** (`terminal: 80x24`): the text reads at docs width. A wider command output wraps; set
  `terminal: 100x28` on a clip that needs the width.
- **Paths.** The take shows `C:\demo\…`, never a home folder; the extension source in the sandbox config does
  name the build folder, so no clip should print that config.
- **Size.** Clips are committed (`docs-site/media/`): keep them under about 1 MB (18 s ≈ 450 to 800 KB). They are
  committed only when re-rendered.
- **Showcases are spoken in English** by Kokoro's voices (`hyperframes tts --list`); the first line spoken downloads the
  model (about 30 s). Lines are cached on their text and voice in `videos/out/.cache/voice/`.
- **The captions are the spoken words.** Write `say:` lines as they should sound (`slash context`), short, one or two
  sentences. Groups end at a sentence or a comma; without Parakeet (`hyperframes models install parakeet`) they are
  timed by length, not by the words.
- **A showcase reuses only demos** (`uses: demos/<id>`), and the demo's captions must match its `say:` list one for
  one; `check` says how many it needs.
- **9:16 shows a 100-column terminal at about half size.** Zooms carry the detail; keep a showcase's demo to a few
  rows that matter, or give it its own world with a narrower `terminal:`.
- **Three renders a showcase:** about 5 minutes at draft quality. Daily showcases are not committed; only their
  scripts are.
- **`post:` is text for the person to post.** The pipeline never posts.
- **A launch records every take again,** one world each, so it costs one model call per `uses:` scene and takes about
  as long as its demos together, plus two renders.
- **App scenes are real time.** Nothing is cut: a `wait:` shows the whole wait. Captions and zoom land on the logged
  step times, about 0.1 s from the frame. A spoken line makes the next spoken step wait for it.
- **App scenes are web pages only, headless.** The ADE is not recorded yet (plan 20, phase 3). A remote `https://`
  page is recorded as it is that day; the site in `landing/` is recorded as built in this checkout.
- **The cursor is drawn after recording**, from the clicks in Playwright's trace: it moves only between clicks, not
  over a hover or a scroll.
- **Music needs a licence.** `check` refuses a track without `<track>.licence.md` beside it. None is in the repository
  yet, so launches render without music. It plays at one level under everything (`under-voice`, default -18 dB), with
  no ducking.
