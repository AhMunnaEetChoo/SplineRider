# Stage 2 — Ball↔Spline Connection + Cheap Spline Renderer

> **Status: IDEATION — 2026-06-14.** Supersedes the "Stage 2" sketch in
> `springyness-plan.md` (which assumed deforming the baked tube). Source intent:
> `Human/Ideation.md` ("ripples travel up the spline chain", "electric gradients").

## Goals

1. **Connection:** the ball should look attached to the spline — when it springs, the rail
   should visibly bend/pull toward it at the attach point instead of the ball floating off a
   static tube (the current v1 limitation).
2. **Renderer requirements (author):**
   - controllable **thickness**;
   - ability to apply **custom shaders/materials along the spline** (target: electric
     gradient radiating from the attach point);
   - **smooth, curvy** look.
3. **Cheap** — no per-frame geometry rebuilds.

## Why the current `TubeGeometry` is the wrong tool here

`spline.createTubeGeometry` builds a `THREE.TubeGeometry` from a `CatmullRomCurve3`:
`tubularSegments × radialSegments` vertices, with Frenet-frame computation. It's built once
today, which is fine for a static rail — but **deforming it per frame means rebuilding the
whole thing every frame** (reallocating buffers, recomputing frames). That's the expensive
path you flagged. It also gives us no easy hook for custom shading along the curve.

## Options surveyed

| Approach | Thickness | Custom shader | Cheap per-frame deform | Smooth | Notes |
|---|---|---|---|---|---|
| Keep `TubeGeometry`, rebuild | yes | hard | ❌ rebuild cost | yes | what we're moving away from |
| `Line2`/`LineMaterial` (fat lines) | yes (px or world) | ⚠️ awkward (fixed shader; extendable but fiddly) | ✅ `setPositions` | yes | great for plain thick lines; per-vertex color works, but custom GLSL is painful — bad fit for the electric effect |
| `MeshLine` (lib) | yes | ✅ supports custom mat | ✅ `setPoints` | yes | basically a packaged ribbon; **extra CDN dep**, against the hand-rolled ethos |
| **Hand-rolled 2D ribbon (expanded polyline) + ShaderMaterial** | ✅ uniform | ✅ full GLSL | ✅✅ (see below) | yes | **recommended** — fits all three requirements + the future shader work |

This is a 2D side-view game, so a flat **ribbon** (the centerline expanded sideways by a
half-width) is all we need — no rounded 3D cross-section. A ribbon is the cheapest thing that
satisfies every requirement, and it's the natural canvas for "shading along the curve."

## Recommended: static ribbon, animated entirely by uniforms

The key insight: **the spline shape is fixed.** So build the ribbon geometry **once per
spline** and never touch its buffers again — animate the connection bump *and* the electric
gradient purely through shader **uniforms**. Per-frame CPU cost ≈ setting a few uniforms.
All the work moves to the GPU vertex/fragment shaders.

### Geometry (built once per spline)

Sample the centerline at `numSegments × SUB_PER_SEGMENT` points. For each sample emit **two**
vertices (the two ribbon edges). Static per-vertex attributes:

- `aCenter` (vec2) — centerline point (rest, undeformed).
- `aNormal` (vec2) — unit normal at that point (for width + bump direction).
- `aAcross` (float, ±1) — which edge (for width offset + across-ribbon shading).
- `aLong` (float) — **arc length from the spline start** (use the existing `_arcTable`).
  Drives the gradient and the bump falloff in a curvature-consistent way.

Index as a triangle strip / two-tri quads between consecutive samples. ~2K verts/spline; for
a handful of splines this is a one-time few-thousand-vertex build.

### Vertex shader — thickness + connection bump (uniform-driven)

```glsl
uniform float uHalfWidth;     // live thickness control  (req #1)
uniform vec2  uOffset;        // ball spring offset = springAxis * dispN (world)
uniform float uAttachLong;    // arc length of the ball's foot point
uniform float uFalloff;       // bump width (world units)

float bump = exp(-pow((aLong - uAttachLong) / uFalloff, 2.0));  // gaussian
vec2 center = aCenter + uOffset * bump;                          // rail pulls to ball
vec2 pos    = center + aNormal * (uHalfWidth * aAcross);
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
```

At the foot point (`aLong == uAttachLong`) `bump == 1`, so the ribbon center =
`foot + springAxis·dispN` = exactly the ball's position → **perfect visual connection**. Away
from the foot the bump decays to 0 and the rest of the rail stays put. `uHalfWidth` gives live
thickness (req #1) for free.

Only the spline the ball is *currently riding* gets a nonzero `uOffset`; every other spline's
mesh keeps `uOffset = 0` (flat). Uniforms are per-mesh, set each frame in
`renderer.updatePlayer`.

### Fragment shader — base look + soft edges + future electric gradient (req #2)

```glsl
varying float vAcross;   // -1..1 across the ribbon
varying float vLong;
uniform float uTime;
uniform float uAttachLong;

float edge = smoothstep(1.0, 0.6, abs(vAcross));     // soft/rounded edge → smooth look
vec3  base = uBaseColor;
// electric gradient radiating from the attach point (later):
float d     = abs(vLong - uAttachLong);
float spark = exp(-d / uGlowLen) * (0.6 + 0.4 * sin(uTime * 30.0 - d * 0.1));
vec3  col   = base + uGlowColor * spark;
gl_FragColor = vec4(col, edge);
```

Additive blending + the `edge` feather give the curvy, glowing look and make the electric
effect (req #2's stretch goal) a drop-in later — it's just more fragment math on the same
geometry, no new buffers.

## Staging

- **2a — Connection (DONE, 2026-06-14).** Gaussian bump(s): `uOffset[]`, `uAttachLong[]`,
  `uFalloff`, `uHalfWidth`. Solves "ball looks attached." Static geometry, uniforms only.
  Extended past the single-bump sketch:
  - **Multi-bump:** the shader sums up to `MAX_BUMPS` (4) gaussian bumps per ribbon, so
    several springs can deform one ribbon at once (largest-amplitude-first).
  - **Detached settling springs:** on launch, `Player.launch` stashes the spring
    (`lastSpring`); `renderer.spawnSettlingSpring` continues it as a visual-only damped
    oscillator at the **frozen launch point** (attach point no longer advances) until it
    settles, instead of snapping flat. Integrated in the fixed-step loop
    (`renderer.updateVisualSprings`), sharing the exact decay law via exported
    `SPRING_K`/`SPRING_C`. A list of these is maintained so re-attaching to the same spline
    while a previous animation settles shows both.
  - **Colour:** ribbon brightened to `Colors.brighten(Colors.accent, 0.35)` for playtest
    visibility (tune in `_makeRibbonMaterial`).
- **2b — Traveling ripple (Ideation's "ripples up the chain").** Replace the single static
  bump with a 1-D wave along `aLong`, seeded by the ball's offset at the foot point. Cheapest
  GPU-friendly form: maintain a small **1-D displacement texture** (or uniform float array)
  of length = sample count, advanced on CPU each frame by a damped 1-D wave equation, sampled
  in the vertex shader by `aLong`. Still no geometry rebuild. Defer until 2a feels right.
- **2c — Electric gradient.** The fragment-shader sketch above. Pure shader work.

## Integration points (current code)

- `spline.js`: add `createRibbonGeometry()` (returns BufferGeometry with the attributes
  above; reuse `_arcTable` for `aLong`). Keep/retire `createTubeGeometry` once both game and
  editor views are migrated (another dead-code removal).
- `renderer.js`: `_buildGameView` / `_buildEditorView` build ribbon meshes with a shared
  `ShaderMaterial` (clone per spline for per-mesh uniforms). `updatePlayer` sets the ridden
  spline's `uOffset` (= `springAxis · dispN`, which the Player already computes), `uAttachLong`
  (arc length at `player.t` via `_arcTable`), and `uTime`; zeroes `uOffset` on the rest.
- `player.js`: expose what's needed — current foot `t`, and the world spring offset vector
  (`springAxis.clone().multiplyScalar(dispN)`); both already exist.
- Editor reuses the ribbon with `uOffset = 0` (no deform); knot dots unchanged.

## Cost

Per frame: set ~4–5 uniforms per spline + one `uTime`. No buffer reallocation, no
`needsUpdate` on positions. Geometry built once. This is dramatically cheaper than rebuilding
a tube and scales fine to many splines. 2b adds one small texture upload per frame (length ~
samples), still trivial.

## Open decisions (for confirmation before building)

1. **Bump falloff shape/width** — gaussian (smooth) vs a compact smoothstep (finite support,
   no far-field leak). Recommend gaussian; tune `uFalloff`.
2. **`aLong` in arc length vs raw `t`** — arc length (via `_arcTable`) looks more uniform;
   `t` is simpler. Recommend arc length.
3. **Material:** commit to a custom `ShaderMaterial` now (sets up 2c cleanly) vs ship 2a with
   a CPU-updated ribbon + `MeshBasicMaterial` and add the shader later. Recommend going
   straight to `ShaderMaterial` since the electric effect is an explicit goal.
4. **Scope of first PR:** 2a only, or 2a + retire `TubeGeometry`?
