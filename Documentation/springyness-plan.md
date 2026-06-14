# Springyness — Staged Implementation Plan

> **Status: Stage 1 IMPLEMENTED — 2026-06-14, awaiting playtest.** Source intent:
> `Human/Ideation.md` (do not edit that file). Stage 2 (visual ripple) is deferred.
> Code: `spline.normalAt`, spring state + integration in `player.js`, win/death freeze in
> `game.js`. Tuning knobs: `SPRING_FREQ` / `SPRING_DAMPING` at the top of `player.js`.

## Core model (both stages)

Springyness = a **1-DOF damped harmonic oscillator along a fixed world-space axis**
(`springAxis`) = the **rail normal frozen at the moment of attach**, with its origin riding
the *moving* foot-point `pointAt(t)`. The rail is the rest position; the player bobs along
`springAxis` while `t` advances along the curve. This keeps a clean split: the tangential
inflow becomes rail-aligned travel (`speed`), the perpendicular inflow becomes the spring.

> **Iteration (2026-06-14):** the spring originally oscillated along the *live* spline
> normal `normalAt(t)`. On curving splines the rotating normal twisted the bob direction and
> felt confusing/unnatural. Replaced with a **fixed axis captured at attach** held constant
> until the next launch. This also makes spline-to-spline transfer trivial (a world-fixed
> axis just carries over; no reprojection). `spline.normalAt` was removed as unused.
>
> Note: the fixed axis is seeded as the rail normal at attach. (An earlier wording said
> "lateral velocity direction" — in 2D that's *identical* to the rail normal, since
> `velocity − (v·T)T = (v·N)N`, so the code now just states it directly as the normal.)

Velocity at the moment of attachment splits:
- **Tangential** `v·T` → ride speed (unchanged from current `_updateFreeFlight` attach).
- **Normal** `v·N` (`N` = `T` rotated 90°) → currently discarded; instead it **seeds the
  oscillator's velocity**.

Keep it strictly 1-D and normal-only. Tangential energy is already fully captured by ride
speed; a 2-D displacement would double-count it.

## Decision log

- **Spring offset counts for game logic (win/lose).** [Author, 2026-06-14] — the rendered
  dot's offset position is the canonical position for goal and death-plane checks, enabling
  puzzle design around boing reach. Implementation: `Player.getPosition()` returns
  `pointAt(t) + N·dispN` while riding, and everything (render, win, death, effects, launch
  start) reads it.
- **No gravity sag on the spring in v1.** Rest position is `dispN = 0` for predictability
  ("same hit → same boing", per Ideation line 11). Revisit in a later stage.
- **No tangential/curvature coupling in v1** (Ideation lines 17, 19 deferred to v3).
- **Displacement bounding: NO CLAMP.** [Author, 2026-06-14] — reach is whatever the physics
  gives; raw and skill/exploit-driven. Energy is still bounded by damping (`ζ ≥ 0`), so the
  spring can't manufacture velocity; only the *position* reach is unbounded.
- **Feel scale: PRONOUNCED / traversal mechanic.** [Author, 2026-06-14] — default
  `SPRING_FREQ = 2.0 Hz`, `SPRING_DAMPING = 0.1`. Big, readable boings that matter for
  reaching places.

---

## Stage 1 — Gameplay spring (v1)

### Player state (`player.js`)
Add to `Player`:
- `this.dispN = 0` — scalar displacement along the local normal.
- `this.velN = 0` — scalar normal velocity.

Reset these on `launch()`, on attach, and on `loadLevel` spawn.

### Normal helper (`spline.js` or inline)
`normalAt(t)` = `tangentAt(t)` normalized, rotated 90° → `(-T.y, T.x)`. Sign convention fixed
(consistent left normal); the oscillator handles both swing directions regardless.

### Attach (`_updateFreeFlight`, the snap branch)
Where it currently computes `dot = velocity·tangentDir; speed = dot` and drops the rest:
- `speed = velocity · T` (as now).
- `velN = velocity · N` (newly retained).
- `dispN = 0` (we attach *at* the rail; the inflow becomes spring velocity).

### Integration (`_updateRiding`, each frame)
Semi-implicit (symplectic) Euler — velocity before position, matching existing physics:
```
const a = -K * dispN - C * velN;   // K = ω², C = 2ζω
velN  += a * dt;
dispN += velN * dt;
```
`ACCELERATION`, gravity-on-tangent, and drag continue to act on `speed`/`t` unchanged. The
spring axis is independent of the tangential axis.

### Position (`getPosition`)
While riding: `return pointAt(clamp(t)) + normalAt(clamp(t)) · dispN`.
Used by render, win check, death check, effects — all consistent with the decision above.

### Launch composition (`launch()`)
On release/launch, fold the spring into the exit velocity and start free flight from the
offset position:
- `position = pointAt(t) + N · dispN`  (start where the dot visibly is)
- `velocity = T_dir · speed + N · velN`
- reset `dispN = velN = 0`.

This makes the "release on the first return → shoot backwards at ≤ inflow speed" mechanic
*emergent and energy-safe*: at first return `velN ≈ -inflowNormal`, and with `ζ ≥ 0` it can
never exceed the inflow. No clamps needed for energy conservation.

### Direct transfer (`_transferToSpline`)
Carry `dispN`/`velN` across the seam (continuous riding, no free flight). Recompute against
the new spline's normal at the transfer `t` — sign may flip; preserve the world-space swing
by projecting the current world displacement onto the new normal.

### Render snapshot / interpolation (`game.js`)
The interpolated snapshot must carry the offset position so fast oscillation doesn't look
steppy between fixed steps. Two options: (a) include `dispN` in the snapshot and lerp it, or
(b) since `getPosition()` already bakes the offset into `position`, the existing
`position.lerp` covers it — verify this is sufficient and keep the simplest path.

### Tuning knobs (express in intuitive units)
- Frequency `f` (Hz), `ω = 2πf`. Peak displacement for a hit ≈ `velN/ω` (undamped). Lower
  `f` → bigger, slower boings; higher `f` → tighter, faster.
- Damping ratio `ζ`. `~0.1` = lively with a clear first-return window; higher settles faster.
- First-return timing window ≈ `1/(2f)`.
- Starting guess pending the "feel scale" answer below.

### Known edge cases (v1-acceptable, note for later)
- **Goal tunnelling:** at extreme speed the dot could swing through the goal ring between
  fixed steps. 60 Hz fixed step makes this rare; a swept check is a v1.1 if it bites.
- **Death by overshoot:** a downward boing past `WORLD_BOTTOM` now kills — *intended* per the
  decision, but worth a deliberate playtest pass.
- **Near-tangent hits:** tiny `velN` → imperceptible bob, no threshold/hard-snap needed.

### Verify
Run locally, attach at varying angles, confirm: glancing hits barely bob, perpendicular hits
boing hard; releasing at first return kicks back at ≤ inflow; offset visibly affects reaching
a goal placed just past a boing. Use `/run` to drive the app.

---

## Stage 2 — Visual ripple (v2, deferred)

Pure juice, decoupled from gameplay (which keeps reading the fixed spline). A 1-D wave along
the rope: nodes hold normal separation with neighbours, forced by the player's attach-point
`dispN`, ripples propagate up the chain.

**Perf is the real cost here** — the tube geometry is currently built once
(`createTubeGeometry`). Per-frame rebuilds are expensive. Approaches, cheapest first:
- displace existing tube vertices CPU-side along precomputed per-vertex normals;
- or a vertex-shader displacement driven by a uniform/attribute wave;
- or deform only a lightweight line representation while springing.

Plus Ideation's "sparks" and "ghost dark drawings of previous frames." All optional, all
after v1 ships and feels good.

---

## Out of scope (later stages, from Ideation)
- Tangential end-point spring (line 17).
- Curvature/centripetal springing while cornering (line 19).
- Gravity sag on the spring.
