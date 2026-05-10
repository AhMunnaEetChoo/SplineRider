# Tech Stack Research

## Decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Rendering** | Three.js | Lightweight (~168 KB gzipped), WebGPU/WebGL, massive ecosystem, full shader control |
| **Physics** | Hand-rolled | Simple enough — spline-constrained motion, gravity, drag, launch velocity |
| **Backend** | Supabase (deferred) | PostgreSQL, auth, file storage, generous free tier |
| **Hosting** | GitHub Pages (static) | Free, simple deploy for the built JS bundle |

## Engines Evaluated

### Three.js — Chosen
- Rendering library, not a full engine (bring your own game loop, physics, input)
- WebGPU production-ready since r171, WebGL 2.0 fallback
- Full custom GLSL/WGSL shaders, ShaderMaterial, post-processing
- Largest web 3D ecosystem (5M+ weekly downloads, 110k+ GitHub stars)
- MIT license

### Babylon.js — Strong alternative
- Full game engine with built-in physics (Havok), GUI, audio, particles
- Node Material Editor for visual shader creation
- Heavier than Three.js (~1.4 MB modular)
- Better "batteries included" but more opinionated
- Apache 2.0, Microsoft-backed

### Flame — Ruled out
- Flutter-based 2D game engine
- Experimental 3D (`flame_3d`) does not support web at all
- Web support for 2D requires CanvasKit/Skia renderer, has several API gaps
- Would work for 2D-only mobile/web but no 3D path

### Godot 4 — Ruled out
- MIT license, full 2D + 3D engine
- Web builds large (18-22 MB), mobile web performance lags behind JS-native engines
- Overkill for a focused 2D game

### PlayCanvas — Ruled out
- Mobile-first, cloud editor, tiny runtime (~300 KB)
- Less flexible for custom shader work
- Cloud editor is nice but less code-first

### Unity — Ruled out
- Dominant (55% web game market share)
- Heavy builds (35-50 MB), freemium license
- Massive overkill for this scope

## Backend Options (for future)

### Supabase — Recommended
- PostgreSQL 500 MB, 1 GB file storage, 50k MAUs
- Auth built-in (email, OAuth, anonymous)
- Edge functions (500k invocations/month)
- Free tier pauses after 1 week inactivity (solvable with cron ping)

### Alternatives
- **Firebase**: NoSQL 1 GiB, 5 GB storage. NoSQL only.
- **Cloudflare D1**: SQLite 500 MB, 5M rows read/day. No auth included.
- **Render**: PostgreSQL 1 GB, but 30-day expiration on free DB.

## Project Structure Plan

```
SplineRider/
├── index.html          # Entry point
├── src/
│   ├── main.js         # Bootstrap, game loop
│   ├── game.js         # Game state, orchestration
│   ├── spline.js       # Spline math (evaluation, tangent, arc length)
│   ├── player.js       # Player state, physics, input
│   ├── renderer.js     # Three.js setup, scene management
│   ├── level.js        # Level data, loading, serialization
│   ├── input.js        # Keyboard/touch input abstraction
│   ├── camera.js       # Camera follow logic
│   └── editor.js       # Level editor (future)
├── levels/             # Packaged level data
└── dist/               # Built output
```

## Notes

- Gameplay is 2D (side-view), built on Three.js for potential visual effects
- Physics hand-rolled: spline-constrained motion, gravity projection, drag, launch trajectories
- Spline representation: cubic Bezier chains (industry standard, good tooling, intuitive control points)
- Target: desktop + mobile browsers via GitHub Pages
