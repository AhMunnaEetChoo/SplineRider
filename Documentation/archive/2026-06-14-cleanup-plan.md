# Spline Rider — Tidy-up & Onboarding Plan

> **Status: COMPLETE — 2026-06-14.**
> Executed:
> - **A. Docs:** rewrote `CLAUDE.md` (Catmull-Rom not Bezier, real physics constants,
>   closest-point attachment, game phases, added `colors.js` + level JSON schema) and
>   `README.md` (hold-to-ride, no air control, real editor modes).
> - **B. Dead code removed:** `Spline.arcLength` / `Spline.createLineGeometry`,
>   `Player.reset`, `Editor.addSpline`, `Editor._snapToNearestSpline` (also dead — found
>   during execution), `UIManager.updateHUD` stub, the `#win-message` div + `game.onReset`
>   hook. Deleted local `.DS_Store` files.
> - **C/#15–18:** editor knot z-depth unified to 10; `effects.js` now uses per-vertex
>   colours + per-particle fade (launch/death particles render orange and fade
>   individually — a deliberate **visual change**), trailing pool slots cleared to kill
>   ghost particles; dropped unused `playerState` param.
> - **C6 refactor:** moot — the duplicated helper (`_snapToNearestSpline`) was dead and
>   removed rather than extracted.
>
> **Deviation from plan:** orphan level files (`first_ride`, `gauntlet`, `pinball`,
> `rollercoaster`, `the_gap`) were **left as-is** at the author's request — kept on disk,
> still unlisted in `levels/index.json`. Not deleted, not wired in.

Goal: make the repo easier to read and faster for a fresh Claude session to onboard,
without changing gameplay. Two parts: **(A) doc/reality inconsistencies to fix** and
**(B) code/file cleanups**. Nothing here changes physics or level behaviour unless noted.

---

## A. Inconsistencies (docs describe a different game than the code)

The biggest onboarding hazard: `CLAUDE.md` and `README.md` describe a **cubic Bezier**
game with control-point handles and air control. The actual game is **Catmull-Rom**
through-points with hold-to-ride and no air control. A fresh session reading the docs
would build a wrong mental model immediately.

### CLAUDE.md
1. **Spline type** — Says "cubic Bezier splines" and `spline.js # Cubic Bezier math`.
   Code is **Catmull-Rom** through-points (`spline.js` header comment + `_catmullRomPoint`).
2. **Level format** — Says `{name, splines:[{p0,p1,p2,p3}], startSplineIndex, startT, goalPosition}`.
   Actual: `{name, startPosition, goalPosition, splines:[{points:[{x,y}...]}]}`.
   `startSplineIndex`/`startT` are *legacy* — only handled as a migration path in
   `storage._normalizeLevelData`; no current level file uses them.
3. **Physics constants** — Says "drag (0.3 riding, 0.15 air), acceleration (6000 riding,
   4000 air)". Actual (`player.js`): `SPLINE_DRAG = 0.5`, `AIR_DRAG = 0.15`,
   single `ACCELERATION = 400` (no separate riding/air values). Gravity 400 is correct.
4. **Attachment** — Says "trajectory-intersection… line-segment intersection. Frame-splitting
   applies partial free flight until intersection." Actual: `_updateFreeFlight` does
   **closest-point sampling** (`findClosestPointOnSpline`) within `SNAP_RADIUS = 40`,
   only while holding, only for points ahead of the velocity. No frame-splitting, no
   line-segment intersection.
5. **Renderer** — Says game view is a "merged continuous spline line" and editor view has
   "control points, handle lines, and markers". Actual: game view is **one tube mesh per
   spline**; editor view is **tube mesh + knot dots** (no handle lines — Catmull-Rom has
   no off-curve handles).
6. **`colors.js` missing** — Not listed in the architecture tree, though it's imported by
   `main.js`, `renderer.js`, `ui.js`, `effects.js` and drives the whole palette
   (loaded from `Art/vintage-voltage.hex`).
7. **`levels.js` description** — Says "plain data, not Spline instances" (true) but omits
   that it now **async-fetches** `levels/index.json` + each level file at import time
   (top-level `await`). Worth calling out since it affects load order.
8. **`editor.js` "standalone"** — It imports `spline.js` and is driven by a `renderer`
   handle; "standalone" undersells its coupling.

### README.md
9. **Spline type** — "cubic Bezier splines" (same as #1).
10. **Touch controls** — "On-screen buttons appear at the bottom — left, right, and launch
    (center)." There are **no such buttons**. Touch is whole-screen hold (`touch.js`),
    plus a mobile pause/restart button top-right (`ui.js`).
11. **Air control** — "left/right gives weak horizontal air control." There is **no air
    control and no left/right input** anywhere in `player.js` / `input.js`.
12. **Re-attach** — "any spline your trajectory intersects" — actually closest point within
    `SNAP_RADIUS` while holding (same as #4).
13. **Reset** — "reset from last checkpoint" — there are **no checkpoints**; `R` restarts
    the whole level (`game.update` → `loadLevel`).
14. **Editor copy** — "drag control points to shape Bezier curves", "Add Spline / Delete
    Spline buttons", "start marker (green triangle)". Actual: modes are
    Freehand/Straight/Knots/Pan; there is **no Add Spline button** (only `- Spline`);
    start marker is an **accent-coloured circle**, not a green triangle.

### Code-level
15. **Editor knot z-depth** — `_buildEditorView` places knot dots at `z = 10`;
    `updateEditorSplineGeometry` re-places them at `z = 0.03`. After the first edit, dots
    jump draw-depth. Pick one (10 is consistent with markers).
16. **Duplicated magic number 40** — `WIN_RADIUS` (game.js), `SNAP_RADIUS` (player.js), and
    several editor hit radii are independent literals. Not a bug, but worth a comment that
    they're intentionally separate.
17. **`effects.emit` per-particle colour is dead** — each particle stores `p.color`, but
    rendering uses a single shared `PointsMaterial.color`/`opacity`, and `opacity` is
    overwritten by the *last* particle each frame. The `color`/`config.color` plumbing
    has no visible effect. Either wire up vertex colours or drop the per-particle colour.
18. **`effects.update(dt, playerState)`** — `playerState` param is never used.

---

## B. Dead code & orphan files (safe to remove)

Verified unused via grep across `src/` + `index.html`:

- `Spline.arcLength()` — defined, never called.
- `Spline.createLineGeometry()` — defined, never called (renderer uses tubes).
- `Player.reset()` — never called (`game.loadLevel` constructs a fresh `Player`).
- `Editor.addSpline()` — never called (no Add Spline button exists).
- `UIManager.updateHUD()` — no-op stub; the real HUD update is a module-level function in
  `main.js`. Confusingly same name.
- `index.html` `#win-message` div + `game.onReset` that hides it — the win screen is the
  `UIManager` overlay (`screens.win`); `#win-message` is never shown, only hidden on reset.
  Remove the div, the `onReset` callback, and the `onReset` hook if nothing else needs it.

**Orphan level files** (exist in `levels/` but absent from `index.json`, so never loaded):
`first_ride.json`, `gauntlet.json`, `pinball.json`, `rollercoaster.json`, `the_gap.json`.
Decide per file: add to `index.json` if wanted, otherwise delete. (`level_1.json` /
"First Ride" is the real first level; `first_ride.json` is a stale duplicate.)

**Housekeeping:** `.DS_Store` files in the working tree (root, `Art/`) are gitignored and
untracked — harmless but worth deleting locally.

---

## C. Suggested readability improvements

1. **Rewrite the CLAUDE.md "Key design details" + architecture** to match A1–A8. This is
   the highest-leverage change for onboarding. Add `colors.js` to the tree.
2. **Rewrite README "How to Play" + "Level Editor"** to match A9–A14 (hold-to-ride, no air
   control, real editor modes).
3. **Add a one-paragraph "level JSON schema"** to CLAUDE.md or a `levels/README.md`:
   the `{name, startPosition, goalPosition, splines:[{points}]}` shape, plus a note that
   `index.json` is the manifest and a file must be listed there to load.
4. **Name the physics phases** — `game.js` `gamePhase` strings (`prebuffer`/`ready`/
   `playing`) and `onPhaseChange('ready'|'go')` are slightly mismatched names; a short
   comment block mapping phase → overlay would help.
5. **Group constants** — a short comment in `player.js` noting which constants are tuning
   knobs (GRAVITY, drags, ACCELERATION) vs. thresholds (SNAP_RADIUS, WORLD_BOTTOM).
6. **Optional:** extract the repeated `_screenToWorld` / closest-point sampling loops in
   `editor.js` (`_findNearestCurve` and `_snapToNearestSpline` are near-identical) into one
   helper. Low priority, behaviour-neutral.

---

## Suggested order of execution

1. Docs first (CLAUDE.md, README.md) — zero risk, biggest onboarding win.
2. Delete verified dead code (B) — small, mechanical.
3. Resolve orphan levels (add to index.json or delete).
4. Fix code-level inconsistencies #15–#18 if desired (behaviour-neutral).
5. Optional refactors (C6).
