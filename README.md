# Spline Rider

A 2D side-view browser game where a particle rides cubic Bezier splines. Accelerate along curves, launch between them, and reach the goal as fast as you can. Built with hand-rolled physics and Three.js for rendering — no game engine.

## How to Play

**Mouse and Keyboard controls:**
- **Left Click** - hold to ride splines
- **R** — reset from last checkpoint
- **Escape / P** — pause

**Touch controls (mobile):**
On-screen buttons appear at the bottom of the screen — left, right, and launch (center).

When airborne, left/right gives weak horizontal air control. Gravity pulls you down. You re-attach to any spline your trajectory intersects.

## Level Editor

Spline Rider includes a built-in click-and-drag level editor:

- **Click and drag** control points to shape Bezier curves
- **Click and drag** the start marker (green triangle) or goal marker (yellow ring)
- **Add Spline / Delete Spline** buttons to manage splines
- **Save** levels to browser storage, **Load** them back
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
