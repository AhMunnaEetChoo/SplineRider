import * as THREE from 'three';

// Player states
export const State = {
  RIDING: 'riding',
  FREE_FLIGHT: 'freeFlight',
  DEAD: 'dead',
  WIN: 'win',
};

const GRAVITY = 400;         // px/s² downward
const SPLINE_DRAG = 0.3;     // drag coefficient while riding
const AIR_DRAG = 0.15;       // drag coefficient in free flight
const AIR_ACCEL = 4000;       // weak horizontal accel in air (px/s²)
const ACCELERATION = 6000;    // accel along spline (px/s²)
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
    if (this.state === State.DEAD || this.state === State.WIN) return;

    // Tick down the launch buffer
    if (this.launchBuffer > 0) {
      this.launchBuffer -= deltaTime;
    }

    switch (this.state) {
      case State.RIDING:
        this._updateRiding(deltaTime, input, splines);
        break;
      case State.FREE_FLIGHT:
        this._updateFreeFlight(deltaTime, input, splines);
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
    // Early exits: no attachment check, just raw free flight
    if (this.launchBuffer > 0) {
      const result = this._simulateFreeFlight(this.position, this.velocity, dt);
      this.position.copy(result.position);
      this.velocity.copy(result.velocity);
      return;
    }
    const forward = input.isDown('ArrowRight') || input.isDown('d');
    const backward = input.isDown('ArrowLeft') || input.isDown('a');
    if (forward && backward) {
      const result = this._simulateFreeFlight(this.position, this.velocity, dt);
      this.position.copy(result.position);
      this.velocity.copy(result.velocity);
      return;
    }

    // Air acceleration (horizontal only)
    if (forward) {
      this.velocity.x += AIR_ACCEL * dt;
    }
    if (backward) {
      this.velocity.x -= AIR_ACCEL * dt;
    }

    // Project full trajectory for this frame
    const projected = this._simulateFreeFlight(this.position, this.velocity, dt);
    const motionStart = this.position.clone();
    const motionEnd = projected.position;

    // Find closest spline intersection along the projected path
    let bestResult = null;
    let bestDist = Infinity;
    for (const spline of splines) {
      if (spline === this.justLaunchedFrom) continue;
      const result = this._intersectMotionWithSpline(motionStart, motionEnd, spline);
      if (result && result.dist < bestDist) {
        bestDist = result.dist;
        bestResult = result;
      }
    }

    if (bestResult && bestDist > 1) {
      // Frame split: intersection found ahead
      const totalDist = motionStart.distanceTo(motionEnd);
      const dt1 = totalDist > 0.0001 ? (bestDist / totalDist) * dt : 0;
      const dtRemainder = dt - dt1;

      // Apply free flight for dt1 (moves player to intersection point)
      if (dt1 > 0.0001) {
        const partial = this._simulateFreeFlight(this.position, this.velocity, dt1);
        this.position.copy(partial.position);
        this.velocity.copy(partial.velocity);
      }

      // Attach to the spline at intersection
      this.spline = bestResult.spline;
      this.t = bestResult.t;
      this.state = State.RIDING;
      const tangent = bestResult.spline.tangentAt(bestResult.t);
      const tlen = tangent.length();
      if (tlen > 0.0001) {
        const tangentDir = tangent.clone().divideScalar(tlen);
        this.speed = this.velocity.dot(tangentDir);
      } else {
        this.speed = this.velocity.length();
      }
      this.justLaunchedFrom = null;

      // Ride along the spline for the remainder of the frame
      if (dtRemainder > 0.0001) {
        this._updateRiding(dtRemainder, input, splines);
      }
    } else {
      // No intersection — full free flight
      this.position.copy(projected.position);
      this.velocity.copy(projected.velocity);
      this.justLaunchedFrom = null;
    }
  }

  // Find where the player's motion line segment intersects a spline.
  // Returns { spline, t, dist } for the closest intersection ahead, or null.
  _intersectMotionWithSpline(motionStart, motionEnd, spline) {
    const samples = 64;
    let bestDist = Infinity;
    let bestT = 0;

    for (let i = 0; i < samples; i++) {
      const t1 = i / samples;
      const t2 = (i + 1) / samples;
      const segStart = spline.pointAt(t1);
      const segEnd = spline.pointAt(t2);

      const hit = this._lineSegmentIntersection(
        motionStart, motionEnd, segStart, segEnd
      );

      if (hit) {
        const dist = motionStart.distanceTo(hit);
        if (dist < bestDist) {
          bestDist = dist;
          const segLen = segStart.distanceTo(segEnd);
          const frac = segLen > 0.0001 ? segStart.distanceTo(hit) / segLen : 0;
          bestT = t1 + frac * (t2 - t1);
        }
      }
    }

    if (bestDist === Infinity) return null;
    return { spline, t: bestT, dist: bestDist };
  }

  // 2D line-segment intersection. Returns the intersection point or null.
  _lineSegmentIntersection(p1, p2, p3, p4) {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;
    const cross = d1x * d2y - d1y * d2x;

    if (Math.abs(cross) < 0.0001) return null; // parallel

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;
    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return new THREE.Vector2(p1.x + t * d1x, p1.y + t * d1y);
    }
    return null;
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
