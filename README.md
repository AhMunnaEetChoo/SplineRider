# Spline Rider

A 2D side-view browser game where a particle rides Catmull-Rom splines. Hold to ride along a curve, release to launch into free flight, and reach the goal as fast as you can. Built with hand-rolled physics and Three.js for rendering — no game engine.

## How to Play

The only control is **hold**. Hold to ride forward along the spline you're on; release to launch off it along its tangent. While airborne, gravity pulls you down — keep holding and you'll re-attach to the nearest spline within range. Reach the goal ring to win.

**Mouse and keyboard:**
- **Hold Space / Left Click** — ride the current spline; release to launch
- **R** — restart the level
- **Escape / P** — pause

**Touch (mobile):**
- **Hold anywhere** on screen to ride; release to launch
- Pause and restart buttons appear in the top-right during play

There is no left/right steering — momentum, gravity, and where you launch from are the whole game.

## Level Editor

Spline Rider includes a built-in click-and-drag level editor. The toolbar mode button cycles through four modes:

- **Freehand** — draw a spline by dragging; drag from an endpoint to extend it, long-press a knot to drag it
- **Straight** — drag to lay down straight two-point segments
- **Knots** — click to drop knot points one at a time; long-press to finish the spline
- **Pan** — drag to move the camera

Plus:

- **Click and drag** the start marker or goal marker to reposition them
- **- Spline** deletes the selected spline
- **Save** levels to browser storage, **Load** them back (via the **☰ More** menu)
- **Export** copies level JSON to clipboard, **Import** loads from JSON
- **Test** play your level directly, returning to the editor on win/death

## Running Locally

No build step or package manager required. Serve the root directory with any HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Three.js is loaded at runtime via CDN import map.

## Tech Stack

- **Three.js** (r171) — rendering only (no physics engine)
- **Vanilla JS** modules — no bundler, no framework
- **localStorage** — level persistence and best times
- **GitHub Pages** — static hosting with GitHub Actions deploy
