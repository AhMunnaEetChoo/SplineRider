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

// Springyness: a 1-DOF damped oscillator along a FIXED world-space axis captured
// at attach (the lateral, non-tangential velocity direction). The axis stays put
// for the whole attachment, so a curving spline doesn't twist the spring feel.
// Express tuning as frequency + damping ratio.
const SPRING_FREQ = 1.0;     // Hz — lower = bigger, slower boings
const SPRING_DAMPING = 0.1;  // damping ratio ζ (0 = lossless, 1 = critical)
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

    // Spring (normal axis) — independent of tangential motion
    this._updateSpring(dt);

    // Auto-accelerate in the locked direction
    this.speed += ACCELERATION * this.rideDirection * dt;

    // Gravity tangent projection
    const tangent = this.spline.tangentAt(this.t);
    const tlen = tangent.length();
    if (tlen > 0.0001) {
      const tangentDir = tangent.clone().divideScalar(tlen);
      const gravTangent = -GRAVITY * tangentDir.y;
      this.speed += gravTangent * dt;
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
    this._wantsAttach = input.isDown('hold');

    if (this._wantsAttach) {
      let bestSpline = null;
      let bestT = 0;
      let bestDist = Infinity;

      for (const spline of splines) {
        const result = spline.findClosestPointOnSpline(this.position, 128);
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
