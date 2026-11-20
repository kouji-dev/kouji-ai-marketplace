# kouji-demo-making

Spoken demo videos from YAML scripts: a terminal or a web page recorded for real, captions, a voice, a sound bed and
effects, composed into docs clips, daily showcases and launch films. It is the videos pipeline built for Orrery, shipped
as it runs there, with the `video-script` skill an agent follows to write and draft a video.

## What is in it

| Path | What it is |
| :- | :- |
| `skills/video-script/SKILL.md` | The loop: pick what to show, write `video.yaml`, check it, render a draft, look at its frames |
| `videos/pipeline/` | The pipeline: `cli.mjs`, `schema.json`, its stages (world, voice, sound, compose, render), surfaces (terminal, app, board) and tests |
| `videos/scripts/shared/worlds/` | Two sample worlds: `fresh` and the `sample-rust` project |
| `videos/README.md` | Every step, field and command of a script |
| `package.json` | Its four dependencies and the `videos:*` scripts |

## Use it

```
/plugin marketplace add kouji-dev/kouji-ai-marketplace
/plugin install kouji-demo-making@kouji
```

Then ask for a demo video, or run `/kouji-demo-making:video-script`. The skill copies `videos/` into the project
when it has none.

## Limits

- **Made for Orrery.** The world stage builds Orrery sandbox homes and runs its dev build, and clips land in
  `docs-site/media/`. Another CLI needs its own world in `videos/pipeline/stages/world.mjs`.
- **Tools on the machine.** Rendering needs VHS, ttyd, FFmpeg, PowerShell 7 and Node 22; `videos:doctor` names
  what is missing. HyperFrames is fetched by `pnpm dlx` at a pinned version.
- **A real model.** A take calls the model the world names, with its key in the shell, unless the world has
  `replies:`. Every render costs money.
- **Windows first.** Built and run on Windows; other systems are untested.
- **None of Orrery's scripts.** Its docs clips and launch film are not shipped: the three tests that read them skip.
