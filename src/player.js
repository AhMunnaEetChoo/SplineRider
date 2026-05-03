import * as THREE from 'three';

// Player states
export const State = {
  RIDING: 'riding',
  FREE_FLIGHT: 'freeFlight',
  DEAD: 'dead',
};

const GRAVITY = 400;         // px/s² downward
const SPLINE_DRAG = 0.3;     // drag coefficient while riding
const AIR_DRAG = 0.15;       // drag coefficient in free flight
const AIR_ACCEL = 400;       // weak horizontal accel in air (px/s²)
const ACCELERATION = 600;    // accel along spline (px/s²)
const WORLD_BOTTOM = -600;   // below this = death
const LAUNCH_BUFFER = 0.5;  // seconds before re-attaching after manual launch

export class Player {
  constructor(spline) {
    this.spline = spline;
    this.t = 0;              // parametric position on spline (0..1)
    this.speed = 0;          // scalar speed along spline (+ = forward)
    this.state = State.RIDING;

    // Free flight state
    this.position = new THREE.Vector2();
    this.velocity = new THREE.Vector2();
    this.launchBuffer = 0;          // remaining buffer time before re-attach
    this.justLaunchedFrom = null;   // spline to skip during attachment check
  }

  getState() {
    return this.state;
  }

  getSpeed() {
    return this.speed;
  }

  getPosition() {
    if (this.state === State.RIDING) {
      return this.spline.pointAt(Math.max(0, Math.min(1, this.t)));
    }
    return this.position.clone();
  }

  isOffBottom() {
    const pos = this.getPosition();
    return pos.y < WORLD_BOTTOM;
  }

  launch(splineTangent, manual = false) {
    this.state = State.FREE_FLIGHT;
    this.position = this.spline.pointAt(Math.max(0, Math.min(1, this.t)));
    // Normalize tangent direction, apply speed magnitude
    const tlen = splineTangent.length();
    const dir = tlen > 0.0001 ? splineTangent.clone().divideScalar(tlen) : new THREE.Vector2(1, 0);
    this.velocity.copy(dir.multiplyScalar(this.speed));
    this.speed = 0;
    if (manual) {
      this.launchBuffer = LAUNCH_BUFFER;
    } else {
      this.justLaunchedFrom = this.spline;
    }
  }

  update(deltaTime, input, splines) {
    if (this.state === State.DEAD) return;

    // Tick down the launch buffer
    if (this.launchBuffer > 0) {
      this.launchBuffer -= deltaTime;
    }

    switch (this.state) {
      case State.RIDING:
        this._updateRiding(deltaTime, input, splines);
        break;
      case State.FREE_FLIGHT:
        this._updateFreeFlight(deltaTime);
        this._checkSplineAttachment(splines, input);
        break;
    }

    if (this.isOffBottom()) {
      this.state = State.DEAD;
    }
  }

  _updateRiding(dt, input, splines) {
    const forward = input.isDown('ArrowRight') || input.isDown('d');
    const backward = input.isDown('ArrowLeft') || input.isDown('a');
    const bothPressed = forward && backward;

    // Launch: both directions pressed simultaneously (manual launch)
    if (bothPressed) {
      const tangent = this.spline.tangentAt(this.t);
      this.launch(tangent, true);
      return;
    }

    // Acceleration input
    if (forward) {
      this.speed += ACCELERATION * dt;
    }
    if (backward) {
      this.speed -= ACCELERATION * dt;
    }

    // Gravity tangent projection
    const tangent = this.spline.tangentAt(this.t);
    const tlen = tangent.length();
    if (tlen > 0.0001) {
      const tangentDir = tangent.clone().divideScalar(tlen);
      // Gravity pulls down (-y), project onto tangent
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
      const endPos = this.spline.pointAt(1.0);
      const endTangent = this.spline.tangentAt(1.0);
      const travelDir = endTangent.clone().normalize();
      const connected = this._findConnectedSpline(endPos, travelDir, this.spline, splines);
      if (connected) {
        this._transferToSpline(connected);
      } else {
        this.launch(endTangent);
      }
    } else if (this.t <= 0.0 && this.speed < 0) {
      this.t = 0.0;
      const startPos = this.spline.pointAt(0.0);
      const startTangent = this.spline.tangentAt(0.0);
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

      const startPt = spline.pointAt(0);
      if (position.distanceTo(startPt) < 3) {
        const tng = spline.tangentAt(0);
        const tlen = tng.length();
        if (tlen > 0.0001) {
          const dir = tng.clone().divideScalar(tlen);
          if (dir.dot(travelDirection) > 0.85) {
            return { spline, t: 0 };
          }
        }
      }

      const endPt = spline.pointAt(1);
      if (position.distanceTo(endPt) < 3) {
        const tng = spline.tangentAt(1);
        const tlen = tng.length();
        if (tlen > 0.0001) {
          const dir = tng.clone().divideScalar(tlen);
          if (dir.dot(travelDirection) > 0.85) {
            return { spline, t: 1 };
          }
        }
      }
    }
    return null;
  }

  _transferToSpline(result) {
    this.spline = result.spline;
    this.t = result.t;
    this.justLaunchedFrom = null;
  }

  _updateFreeFlight(dt) {
    // Gravity
    this.velocity.y -= GRAVITY * dt;

    // Air drag
    this.velocity.x -= this.velocity.x * AIR_DRAG * dt;
    this.velocity.y -= this.velocity.y * AIR_DRAG * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  _checkSplineAttachment(splines, input) {
    // Don't attach while launch buffer is active or both directions held
    if (this.launchBuffer > 0) return;
    const forward = input.isDown('ArrowRight') || input.isDown('d');
    const backward = input.isDown('ArrowLeft') || input.isDown('a');
    if (forward && backward) return;

    for (const spline of splines) {
      if (spline === this.justLaunchedFrom) continue;
      // Walk along the spline to find the closest point
      const samples = 32;
      let bestDist = Infinity;
      let bestT = 0;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = spline.pointAt(t);
        const dist = this.position.distanceTo(pt);
        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }

      const attachDist = 30; // snap radius
      if (bestDist < attachDist) {
        // Attach to spline
        this.spline = spline;
        this.t = bestT;
        this.state = State.RIDING;

        // Project velocity onto tangent to preserve speed
        const tangent = spline.tangentAt(bestT);
        const tlen = tangent.length();
        if (tlen > 0.0001) {
          const tangentDir = tangent.clone().divideScalar(tlen);
          this.speed = this.velocity.dot(tangentDir);
        } else {
          this.speed = this.velocity.length();
        }
        this.justLaunchedFrom = null;
        return;
      }
    }
    // No attachment found — clear the exclusion
    this.justLaunchedFrom = null;
  }

  reset(spline) {
    this.spline = spline;
    this.t = 0;
    this.speed = 0;
    this.state = State.RIDING;
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.launchBuffer = 0;
    this.justLaunchedFrom = null;
  }
}
