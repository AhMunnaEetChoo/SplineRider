# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Spline Rider is a 2D side-view browser game where a particle rides Catmull-Rom splines. The player holds to ride forward along a spline, releases to launch into free flight, and is pulled by gravity until they re-attach to another spline. Hand-rolled physics, no engine — just Three.js for rendering.

## Development

No build step, no package manager. Serve the root directory with any HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Three.js is loaded at runtime via import map from CDN (`index.html`).

There are no tests, no linter, no bundler.

## Workflow

Solo toy project, one author at a time — no branch-per-change ceremony. Commit directly to `main`. The only caveat: **pushing to `main` auto-deploys** to GitHub Pages (`.github/workflows/deploy.yml`), so push when you're ready to publish, not as a backup. Reach for a branch + PR only when you specifically want to push WIP without deploying, or to run PR-based review tooling.

## Creator / Claude explicit split

Do not modify the contents of `Human` - this is where author intent lives. Use the `Documentation` folder to create others for plans, ideation and docs.

## Architecture

```
src/
├── main.js       # Entry point: screen state machine, composed input, game loop
├── game.js       # Level-data-driven orchestrator with callbacks (onWin, onDeath, etc.)
├── player.js     # All player physics: riding, free flight, launch, attachment, transfer
├── spline.js     # Catmull-Rom math: pointAt, tangentAt, paramDelta, tube geometry
├── renderer.js   # Three.js scene setup, dual-mode (game/editor) rendering
├── input.js      # Keyboard state tracking with justPressed support
├── touch.js      # Mouse/touch input provider (same interface as input.js)
├── ui.js         # DOM screen manager (start, win, death, pause, level select, editor toolbar)
├── editor.js     # Click-and-drag level editor (canvas mouse/touch handlers)
├── storage.js    # localStorage CRUD for levels and best times
├── levels.js     # Built-in level loader: async-fetches levels/index.json + each level file
├── colors.js     # Palette loaded from Art/vintage-voltage.hex; sets CSS vars + JS color helpers
└── effects.js    # Particle effects system (THREE.Points + additive blending)
```

**Module dependency order:** `spline.js`, `input.js`, `touch.js`, and `colors.js` have no internal deps. `player.js` imports `spline.js`. `renderer.js` imports `spline.js` and `colors.js`. `game.js` imports `player.js`, `spline.js`, and `levels.js`. `editor.js` imports `spline.js` and is driven by a `renderer` handle passed in. `main.js` wires everything together — nothing imports from `main.js` (though it exports `renderer`).

Note: `levels.js` and `colors.js` both run top-level `await` at import time (level fetch, palette fetch), so `main.js` awaits `initColors()` before constructing anything.

## Key design details

- **Physics are hand-rolled** — no physics engine. Constants live in `player.js`: gravity (`GRAVITY = 400` px/s²), drag (`SPLINE_DRAG = 0.5` riding, `AIR_DRAG = 0.15` air), and a single `ACCELERATION = 400` px/s² applied along the spline while riding. `WORLD_BOTTOM = -600` is the death plane.
- **Splines are Catmull-Rom** through-points, not Bezier. A spline is an array of `points` the curve passes through; there are no off-curve control handles. `spline.js` evaluates each segment with the standard Catmull-Rom basis (`_catmullRomPoint` / `_catmullRomTangent`).
- **Spline riding** uses a scalar speed along the parametric curve. `paramDelta(t, speed, dt)` converts speed to a t-step using an arc-length table so motion is roughly constant-speed regardless of segment spacing.
- **Launch** transitions the player from RIDING to FREE_FLIGHT, converting scalar speed to a velocity vector along the spline's tangent direction. Releasing the hold launches immediately.
- **Attachment** (FREE_FLIGHT → RIDING) happens only while holding: each frame the player samples the closest point on every spline (`findClosestPointOnSpline`), and if the nearest point ahead of the velocity is within `SNAP_RADIUS = 40`, it attaches there and converts velocity into scalar speed. There is no trajectory/line-segment intersection or frame-splitting.
- **Direct transfer**: when a spline endpoint physically connects (within 3px) to another spline's start/end with a matching tangent (dot > 0.85), the player transfers without entering free flight (`_findConnectedSpline` / `_transferToSpline`).
- **No air control** — there is no left/right steering. The only input is hold (space / left mouse / touch), plus `R` to reset and `Escape`/`P` to pause.
- **Game phases** (`game.js`): `prebuffer` (0.5s settle) → `ready` (shows "Hold To Ride!", waits for hold) → `playing`. The timer only accumulates during `playing`. `onPhaseChange('ready'|'go')` drives the UI overlays.
- **The world is 2D** but built on Three.js for rendering. The orthographic camera looks down the Z axis; everything lives near z=0.
- **Levels are stored** as plain data — see schema below — and deserialized to `Spline` instances at load time in `game.js`.
- **The renderer has two modes**: game view (one tube mesh per spline) and editor view (one tube mesh per spline plus draggable knot dots). Only one view group is attached to the scene at a time.
- **Input is composed**: keyboard (`input.js`) + mouse/touch (`touch.js`) wrapped into a single provider in `main.js` with a matching `isDown` / `consumeJustPressed` interface. The logical `'hold'` key maps to space or touch-hold.
- **Screens**: START → PLAY | EDITOR | LEVELS. PLAY → WIN | DEATH | PAUSE. The editor has a test-play mode that returns to the editor on win/death.

## Level JSON schema

Levels are plain JSON, both in `levels/*.json` (built-in) and localStorage (user-saved):

```json
{
  "name": "First Ride",
  "startPosition": { "x": -500, "y": 260 },
  "goalPosition":  { "x": 600, "y": -200 },
  "splines": [
    { "points": [ { "x": -500, "y": 200 }, { "x": -300, "y": 100 }, ... ] }
  ]
}
```

- `splines[].points` is the through-point list for one Catmull-Rom spline (min 2 points).
- `startPosition` is where the particle spawns; `goalPosition` is the goal ring (win within `WIN_RADIUS = 40`).
- **Legacy:** older saves used `startSplineIndex` + `startT` instead of `startPosition`; `storage._normalizeLevelData` migrates these on load. New code should only emit `startPosition`.
- `levels/index.json` is the manifest — an array of filenames. **A level file must be listed there to be loaded** as a built-in. The first entry is `DEFAULT_LEVEL`.
