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
├── ui.js         # DOM screen manager (start, win, death, pause, level select, browse online, editor toolbar)
├── editor.js     # Click-and-drag level editor (canvas mouse/touch handlers)
├── storage.js    # localStorage CRUD for levels and best times; level JSON validate/normalize
├── online.js     # Online community level catalog: Supabase-backed list/get/upload (the only networking layer)
├── levels.js     # Built-in level loader: async-fetches levels/index.json + each level file
├── colors.js     # Palette loaded from Art/vintage-voltage.hex; sets CSS vars + JS color helpers
└── effects.js    # Particle effects system (THREE.Points + additive blending)
```

**Module dependency order:** `spline.js`, `input.js`, `touch.js`, and `colors.js` have no internal deps. `player.js` imports `spline.js`. `renderer.js` imports `spline.js` and `colors.js`. `game.js` imports `player.js`, `spline.js`, and `levels.js`. `editor.js` imports `spline.js` and is driven by a `renderer` handle passed in. `online.js` imports `storage.js` (reuses `importLevelJson` to validate remote levels). `main.js` wires everything together — nothing imports from `main.js` (though it exports `renderer`).

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
- **Input is composed**: keyboard (`input.js`) + mouse/touch (`touch.js`) wrapped into a single provider in `main.js` with a matching `isDown` / `consumeJustPressed` interface. The logical `'hold'` key maps to space or touch-hold. `input.js` `preventDefault`s keys globally, but **skips events whose target is an editable element** (`<input>`/`<textarea>`/contenteditable) so typing into the browse-search box and import textarea works.
- **Screens**: START → PLAY | EDITOR | LEVELS | ONLINE. PLAY → WIN | DEATH | PAUSE. The editor has a test-play mode that returns to the editor on win/death. `main.js` owns a module-level `currentScreen`; **always route through the local `showScreen(id)` (not `ui.showScreen` directly)** when a screen's logic depends on `currentScreen` (e.g. ONLINE's async render guard).

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
- **Validation/cleanup** lives in `storage.importLevelJson` (used for clipboard import *and* for ingesting online levels). It **drops degenerate splines with `<2` points** (a stray single-point editor click) rather than rejecting the whole level, derives a missing `goalPosition` from the last point, and runs `_normalizeLevelData`. The editor also discards a freehand spline if the click is released in place before reaching drag distance (`editor.js` `_onMouseUp`), so 1-point splines are avoided at the source too.

## Online level catalog

Players can publish levels to a shared catalog and play/search others' levels. The site is **static (GitHub Pages) — there is no backend to extend**, so the catalog lives in **Supabase** (hosted Postgres + auto REST API), reached directly from the browser.

- **`src/online.js` is the only networking layer.** It exposes `listLevels({search, author})`, `getLevel(id)`, `uploadLevel({name, author, data, authorTimeMs})`, and `isConfigured()`. `SUPABASE_URL` + `SUPABASE_ANON_KEY` are plain constants at the top (the anon key is public by design; row-level security gates it to public read + insert only). supabase-js is loaded via a **lazy dynamic `import()`** (mapped in `index.html`'s import map) so a CDN/network failure degrades gracefully instead of breaking the app — online buttons just toast an error.
- **Backend setup is documented in `Documentation/online-levels-setup.md`** (table DDL, RLS policies, trigram search index). The `levels` table adds columns the local JSON doesn't have: server-generated `id` (the canonical identity — names are display-only), `author`, `created_at`, `author_time_ms`, and a reserved-but-unused `edit_token`. The level geometry itself is stored in a `data` jsonb column in the same shape as the JSON schema above.
- **Upload is gated on proof-of-completion.** The editor has no dirty-tracking by default, so an `editor.onModified` callback (fired liberally from every mutation path) lets `main.js` compare a name-independent content key (`_levelContentKey`) against `provenLevelKey`. Beating the level in **test-play** (`game.onWin`'s `isTestPlay` branch) records that key + the time; any edit changes the key and disables the Upload button (`ui.setUploadEnabled`). The gate is an honesty mechanism, **not security** — it's client-side and bypassable.
- **Browse Online** (`ui.js` `online` screen) lists name/author/date, has a debounced search matching name OR author, and an author drill-down. `main.js` `_showOnlineBrowse` / `_loadOnlineList` / `_playOnlineLevel` drive it. Remote levels are validated through `importLevelJson` before play.
- **Share links** are `?level=<id>`. On startup `main.js` reads the param and, if present, loads that level straight into play (graceful fallback to the start screen on failure). Upload shows a share modal with copy-to-clipboard.
- **Author identity** is just a local display name in `localStorage` (`splineRider_authorName`) — no accounts. Clashes/spoofing and lack of moderation are accepted MVP trade-offs.
