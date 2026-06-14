# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Spline Rider is a 2D side-view browser game where a particle rides cubic Bezier splines. The player accelerates forward/backward along splines, launches between them, and is pulled by gravity. Hand-rolled physics, no engine — just Three.js for rendering.

## Development

No build step, no package manager. Serve the root directory with any HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Three.js is loaded at runtime via import map from CDN (`index.html`).

There are no tests, no linter, no bundler.

## Creator / Claude explicit split

Do not modify the contents of `Human` - this is where author intent lives. Use the `Documentation` folder are create others for plans, ideation and docs.

## Architecture

```
src/
├── main.js       # Entry point: screen state machine, composed input, game loop
├── game.js       # Level-data-driven orchestrator with callbacks (onWin, onDeath, etc.)
├── player.js     # All player physics: riding, free flight, launch, attachment
├── spline.js     # Cubic Bezier math: pointAt, tangentAt, paramDelta, arc length
├── renderer.js   # Three.js scene setup, dual-mode (game/editor) rendering
├── input.js      # Keyboard state tracking with justPressed support
├── touch.js      # Mobile touch controls (same interface as input.js)
├── ui.js         # DOM screen manager (start, win, death, pause, level select, editor toolbar)
├── editor.js     # Click-and-drag level editor (canvas mouse/touch handlers)
├── storage.js    # localStorage CRUD for levels and best times
├── levels.js     # Built-in level catalog (plain data, not Spline instances)
└── effects.js    # Particle effects system (THREE.Points + additive blending)
```

**Module dependency order:** `spline.js` and `input.js` have no internal deps. `player.js` imports `spline.js`. `renderer.js` imports `spline.js`. `game.js` imports `player.js`, `spline.js`, and `levels.js`. `editor.js` is standalone. `main.js` wires everything together — nothing imports from `main.js`.

## Key design details

- **Physics are hand-rolled** — no physics engine. Gravity (400 px/s²), drag (0.3 riding, 0.15 air), and acceleration (6000 px/s² riding, 4000 px/s² air) are applied directly each frame.
- **Spline riding** uses a scalar speed along the parametric curve. `paramDelta(t, speed, dt)` converts speed to a t-step by dividing by tangent magnitude.
- **Launch** transitions the player from RIDING to FREE_FLIGHT, converting scalar speed to a velocity vector along the spline's tangent direction.
- **Attachment** uses trajectory-intersection: the player's projected motion line is tested against spline segments for line-segment intersection. Frame-splitting applies partial free flight until intersection, then attaches and rides the remainder.
- **Direct transfer**: when a spline endpoint physically connects to another spline's start/end with a matching tangent (dot > 0.85), the player transfers without entering free flight.
- **The world is 2D** but built on Three.js for rendering. The orthographic camera looks down the Z axis; everything lives at z=0.
- **Levels are stored** as plain data (`{name, splines: [{p0,p1,p2,p3}], startSplineIndex, startT, goalPosition}`) and deserialized to Spline instances at load time.
- **The renderer has two modes**: game view (merged continuous spline line) and editor view (per-spline rendering with control points, handle lines, and markers).
- **Input is composed**: keyboard + touch wrapped into a single input provider with matching `isDown` interface.
- **Screens**: START → PLAY | EDITOR | LEVEL_SELECT. PLAY → WIN | DEATH | PAUSE. Editor has test-play mode that returns to editor on win/death.
