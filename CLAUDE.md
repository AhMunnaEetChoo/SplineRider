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

## Architecture

```
src/
├── main.js       # Entry point: creates Renderer, Input, Game; runs the tick loop
├── game.js       # Level data (hardcoded spline array), orchestrates update per frame
├── player.js     # All player physics: riding, free flight, launch, attachment
├── spline.js     # Cubic Bezier math: pointAt, tangentAt, paramDelta, arc length
├── renderer.js   # Three.js scene setup, spline rendering, camera follow
└── input.js      # Keyboard state tracking with justPressed support
```

**Module dependency order:** `spline.js` and `input.js` have no internal deps. `player.js` imports `spline.js`. `renderer.js` is standalone. `game.js` imports `player.js` and `spline.js`. `main.js` wires everything together by importing `renderer.js`, `input.js`, and `game.js`.

**Avoid circular imports** — `main.js` is the root; nothing should import from it.

## Key design details

- **Physics are hand-rolled** — no physics engine. Gravity, drag, and acceleration are applied directly each frame.
- **Spline riding** uses a scalar speed along the parametric curve. `paramDelta(t, speed, dt)` converts speed to a t-step by dividing by tangent magnitude.
- **Launch** transitions the player from RIDING to FREE_FLIGHT, converting scalar speed to a velocity vector along the spline's tangent direction.
- **Attachment** has two paths:
  - **Direct transfer** (new): when a spline endpoint physically connects to another spline's start/end with a matching tangent, the player transfers without entering free flight — speed is preserved continuously.
  - **Proximity snap** (fallback): during free flight, the nearest point on nearby splines is sampled (32 samples each). If within 30px, the player's velocity is dot-projected onto the spline tangent to compute new scalar speed.
- **The world is 2D** but built on Three.js for potential visual effects. The orthographic camera looks down the Z axis; everything lives at z=0.
- **Levels are hardcoded** in `game.js` as an array of `Spline` objects. No level editor or serialization exists yet.
- **The goal** (end of the last spline) is rendered but has no win-detection logic.
