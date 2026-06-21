import * as THREE from 'three';

// Player states
export const State = {
  RIDING: 'riding',
  FREE_FLIGHT: 'freeFlight',
  DEAD: 'dead',
  WIN: 'win',
};

const GRAVITY = 400;         // px/s² downward
const SPLINE_DRAG = 0.5;     // drag coefficient while riding
const AIR_DRAG = 0.15;       // drag coefficient in free flight
const ACCELERATION = 400;    // accel along spline (px/s²)
const WORLD_BOTTOM = -600;   // below this = death
const SNAP_RADIUS = 40;      // max distance to snap onto a spline
const LAUNCH_T_GAP = 0.3;    // after launch, ignore re-attach within this t of the launch end

// Springyness: a 1-DOF damped oscillator along a FIXED world-space axis captured
// at attach (the lateral, non-tangential velocity direction). The axis stays put
// for the whole attachment, so a curving spline doesn't twist the spring feel.
// Express tuning as frequency + damping ratio.
const SPRING_FREQ = 1.0;     // Hz — lower = bigger, slower boings
const SPRING_DAMPING = 0.1;  // damping ratio ζ (0 = lossless, 1 = critical). Lower this
                             // toward 0 for a stronger/longer-lived perpendicular kick-back
                             // on a well-timed release (it governs the on-rail spring decay).
// Strength of the directional spring ↔ travel coupling (see _updateRiding). The loaded
// spring's force, projected onto the (curving) rail tangent, speeds you up or slows you
// down depending on which way the rail turns; it's a pure diode (the spring can only lose
// energy this way — braking bleeds to heat, never winds the spring up). 0 = off (pure
// perpendicular spring). Main feel dial.
const SPRING_TURN_COUPLING = 1.0;
const _SPRING_OMEGA = 2 * Math.PI * SPRING_FREQ;
// Exported so the renderer can continue the same spring as a detached visual
// settle animation after launch (gameplay vs visuals share one decay law).
export const SPRING_K = _SPRING_OMEGA * _SPRING_OMEGA;     // stiffness (ω²)
export const SPRING_C = 2 * SPRING_DAMPING * _SPRING_OMEGA; // damping (2ζω)

export class Player {
  constructor(spline) {
    this.spline = spline;
    this.t = 0;              // parametric position on spline (0..1)
    this.speed = 0;          // scalar speed along spline (+ = forward)
    this.state = State.RIDING;

    // Free flight state
    this.position = new THREE.Vector2();
    this.velocity = new THREE.Vector2();
    this.rideDirection = 1;         // 1 = forward, -1 = backward along spline

    // Spring state, only meaningful while RIDING. Oscillates along springAxis,
    // a fixed world-space unit vector captured at attach time.
    this.springAxis = new THREE.Vector2(0, 1);
    this.dispN = 0;                 // displacement along springAxis
    this.velN = 0;                  // velocity along springAxis

    // Snapshot of the spring at the moment of the last launch, for the renderer's
    // detached visual settle animation. { spline, attachLong, axis, dispN, velN }.
    this.lastSpring = null;

    // Y below which the player dies. Defaults to WORLD_BOTTOM; Game overrides it
    // per level (just below the lowest point the level reaches).
    this.killY = WORLD_BOTTOM;

    // After a launch, blocks re-attaching to the launched end of the launch spline
    // until the player separates from it. { spline, t, point }. See _updateFreeFlight.
    this._launchGuard = null;
  }

  getState() {
    return this.state;
  }

  getSpeed() {
    return this.speed;
  }

  getPosition() {
    if (this.state === State.RIDING) {
      const ct = Math.max(0, Math.min(1, this.t));
      const foot = this.spline.pointAt(ct);
      if (this.dispN !== 0) {
        foot.add(this.springAxis.clone().multiplyScalar(this.dispN));
      }
      return foot;
    }
    return this.position.clone();
  }

  getRenderSnapshot() {
    return {
      position: this.getPosition(),
      state: this.state,
      spline: this.spline,
      t: this.t,
      offset: this.springAxis.clone().multiplyScalar(this.dispN),
    };
  }

  isOffBottom() {
    const pos = this.getPosition();
    return pos.y < this.killY;
  }

  launch(splineTangent) {
    this.state = State.FREE_FLIGHT;
    const tlen = splineTangent.length();
    const dir = tlen > 0.0001 ? splineTangent.clone().divideScalar(tlen) : new THREE.Vector2(1, 0);

    // Launch from where the dot visibly is (foot + spring offset), and fold the
    // spring's velocity (along the fixed springAxis) into the exit velocity. With
    // damping this can never exceed the inflow, so timing a release to the first
    // return kicks you back.
    const foot = this.spline.pointAt(Math.max(0, Math.min(1, this.t)));
    this.position = foot.add(this.springAxis.clone().multiplyScalar(this.dispN));
    this.velocity.copy(dir.multiplyScalar(this.speed))
      .add(this.springAxis.clone().multiplyScalar(this.velN));

    // Hand the spring off to the renderer so the cable keeps wobbling at the
    // (now frozen) launch point until it settles, instead of snapping flat.
    this.lastSpring = {
      spline: this.spline,
      attachLong: this.spline.arcLengthAt(Math.max(0, Math.min(1, this.t))),
      axis: this.springAxis.clone(),
      dispN: this.dispN,
      velN: this.velN,
    };

    // Guard against the spring immediately yanking us back onto the spline we just
    // left: ignore re-attaches near this t until we separate (see _updateFreeFlight).
    const launchT = Math.max(0, Math.min(1, this.t));
    this._launchGuard = {
      spline: this.spline,
      t: launchT,
      point: this.spline.pointAt(launchT),
    };

    this.speed = 0;
    this.dispN = 0;
    this.velN = 0;
  }

  _updateSpring(dt) {
    // Semi-implicit (symplectic) Euler: update velocity before position.
    const accel = -SPRING_K * this.dispN - SPRING_C * this.velN;
    this.velN += accel * dt;
    this.dispN += this.velN * dt;
  }

  update(deltaTime, input, splines) {
    if (this.state === State.DEAD || this.state === State.WIN) return;

    switch (this.state) {
      case State.RIDING:
        this._updateRiding(deltaTime, input, splines);
        break;
      case State.FREE_FLIGHT:
        this._updateFreeFlight(deltaTime, input, splines);
        break;
    }

    if (this.isOffBottom()) {
      // Freeze at the death point (spring offset included) before leaving RIDING
      this.position.copy(this.getPosition());
      this.state = State.DEAD;
    }
  }

  _updateRiding(dt, input, splines) {
    const holding = input.isDown('hold');

    if (!holding) {
      const tangent = this.spline.tangentAt(this.t);
      this.launch(tangent);
      return;
    }

    // Spring (normal axis) — its own damped oscillation, independent of travel.
    this._updateSpring(dt);

    // Directional spring ↔ travel coupling. The loaded spring pushes the bead along its
    // fixed axis; the component of that push ALONG the rail tangent speeds you up or slows
    // you down depending on which way the rail turns. On a straight rail the axis stays
    // perpendicular (proj = 0) so there's no coupling — a well-timed release still kicks
    // you back. Diode: a boost draws its energy FROM the spring (clamped to what it holds);
    // a brake bleeds tangential energy to heat and leaves the spring untouched, so the
    // spring can only ever lose energy here — turning never winds springiness up.
    const tangent = this.spline.tangentAt(this.t);
    const tlen = tangent.length();
    const tangentDir = tlen > 1e-6 ? tangent.clone().divideScalar(tlen) : null;
    if (tangentDir && this.dispN !== 0) {
      const proj = this.springAxis.dot(tangentDir);                // 0 on a straight rail
      const s0 = this.speed;
      const s1 = s0 + (-SPRING_K * this.dispN * proj) * SPRING_TURN_COUPLING * dt;
      const dKE = 0.5 * (s1 * s1 - s0 * s0);
      if (dKE > 0) {
        const Es = 0.5 * (this.velN * this.velN + SPRING_K * this.dispN * this.dispN);
        const give = Math.min(dKE, Es);
        const scale = Es > 1e-9 ? Math.sqrt(Math.max(0, (Es - give) / Es)) : 0;
        this.velN *= scale;
        this.dispN *= scale;
        this.speed = give < dKE
          ? Math.sign(s0 || this.rideDirection) * Math.sqrt(s0 * s0 + 2 * give)
          : s1;
      } else {
        this.speed = s1;  // brake → energy to heat, spring left alone (no wind-up)
      }
    }

    // Auto-accelerate in the locked direction
    this.speed += ACCELERATION * this.rideDirection * dt;

    // Gravity tangent projection (reuses the tangent computed above)
    if (tangentDir) {
      this.speed += -GRAVITY * tangentDir.y * dt;
    }

    // Drag
    this.speed -= this.speed * SPLINE_DRAG * dt;

    // Update parametric position
    this.t += this.spline.paramDelta(this.t, this.speed, dt);

    // Check endpoints
    if (this.t >= 1.0) {
      this.t = 1.0;
      const endPos = this.spline.getEndPoint();
      const endTangent = this.spline.getEndTangent();
      const travelDir = endTangent.clone().normalize();
      const connected = this._findConnectedSpline(endPos, travelDir, this.spline, splines);
      if (connected) {
        this._transferToSpline(connected);
      } else {
        this.launch(endTangent);
      }
    } else if (this.t <= 0.0 && this.speed < 0) {
      this.t = 0.0;
      const startPos = this.spline.getStartPoint();
      const startTangent = this.spline.getStartTangent();
      const travelDir = startTangent.clone().normalize().multiplyScalar(-1);
      const connected = this._findConnectedSpline(startPos, travelDir, this.spline, splines);
      if (connected) {
        this._transferToSpline(connected);
      } else {
        this.launch(startTangent);
      }
    }
  }

  _findConnectedSpline(position, travelDirection, excludeSpline, splines) {
    for (const spline of splines) {
      if (spline === excludeSpline) continue;

      const startPt = spline.getStartPoint();
      if (position.distanceTo(startPt) < 3) {
        const dir = spline.getStartTangent().normalize();
        if (dir.dot(travelDirection) > 0.85) {
          return { spline, t: 0 };
        }
      }

      const endPt = spline.getEndPoint();
      if (position.distanceTo(endPt) < 3) {
        const dir = spline.getEndTangent().normalize();
        if (dir.dot(travelDirection) > 0.85) {
          return { spline, t: 1 };
        }
      }
    }
    return null;
  }

  _transferToSpline(result) {
    // springAxis is world-fixed, so the spring (dispN/velN/springAxis) just
    // carries across the seam unchanged.
    this.spline = result.spline;
    this.t = result.t;
  }

  // Simulate free-flight physics without mutating state.
  // Returns { position, velocity } after dt seconds.
  _simulateFreeFlight(startPos, startVel, dt) {
    const endVelX = startVel.x - startVel.x * AIR_DRAG * dt;
    const endVelY = startVel.y - GRAVITY * dt - startVel.y * AIR_DRAG * dt;
    const avgVelX = (startVel.x + endVelX) * 0.5;
    const avgVelY = (startVel.y + endVelY) * 0.5;
    return {
      position: new THREE.Vector2(
        startPos.x + avgVelX * dt,
        startPos.y + avgVelY * dt
      ),
      velocity: new THREE.Vector2(endVelX, endVelY),
    };
  }

  _updateFreeFlight(dt, input, splines) {
    // Clear the launch guard once we've physically separated from the launch point.
    if (this._launchGuard && this.position.distanceTo(this._launchGuard.point) > SNAP_RADIUS) {
      this._launchGuard = null;
    }

    this._wantsAttach = input.isDown('hold');

    if (this._wantsAttach) {
      let bestSpline = null;
      let bestT = 0;
      let bestDist = Infinity;

      for (const spline of splines) {
        // On the just-launched spline, exclude the launched-end neighbourhood so the
        // spring can't yank us straight back (but the far end of a loop still attaches).
        const guarded = this._launchGuard && this._launchGuard.spline === spline;
        const result = guarded
          ? spline.findClosestPointOnSpline(this.position, 128, this._launchGuard.t, LAUNCH_T_GAP)
          : spline.findClosestPointOnSpline(this.position, 128);
        if (result.distance < bestDist) {
          // Only snap to points ahead of our velocity direction
          const velLen = this.velocity.length();
          if (velLen > 1) {
            const toPoint = result.point.clone().sub(this.position);
            if (toPoint.dot(this.velocity) <= 0) continue;
          }
          bestDist = result.distance;
          bestT = result.t;
          bestSpline = spline;
        }
      }

      if (bestSpline !== null && bestDist < SNAP_RADIUS) {
        this.spline = bestSpline;
        this.t = bestT;
        this.state = State.RIDING;
        this._launchGuard = null;
        const tangent = bestSpline.tangentAt(bestT);
        const tlen = tangent.length();
        if (tlen > 0.0001) {
          const tangentDir = tangent.clone().divideScalar(tlen);
          const dot = this.velocity.dot(tangentDir);
          this.speed = dot;
          this.rideDirection = dot >= 0 ? 1 : -1;
          // Cleanly split the inflow: the tangential component is rail-aligned travel
          // (speed), the perpendicular component is the spring. Freeze the spring axis
          // to the rail normal at attach so it stays fixed for the whole attachment.
          this.springAxis.set(-tangentDir.y, tangentDir.x);
          this.velN = this.velocity.dot(this.springAxis);
          this.dispN = 0;
        } else {
          this.speed = this.velocity.length();
          this.rideDirection = 1;
          this.springAxis.set(0, 1);
          this.velN = 0;
          this.dispN = 0;
        }
        return;
      }
    }

    // Projectile physics
    const result = this._simulateFreeFlight(this.position, this.velocity, dt);
    this.position.copy(result.position);
    this.velocity.copy(result.velocity);
  }
}
