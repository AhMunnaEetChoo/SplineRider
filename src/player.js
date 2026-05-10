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
const ACCELERATION = 600;    // accel along spline (px/s²)
const WORLD_BOTTOM = -600;   // below this = death
const SNAP_RADIUS = 40;      // max distance to snap onto a spline

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

  launch(splineTangent) {
    this.state = State.FREE_FLIGHT;
    this.position = this.spline.pointAt(Math.max(0, Math.min(1, this.t)));
    const tlen = splineTangent.length();
    const dir = tlen > 0.0001 ? splineTangent.clone().divideScalar(tlen) : new THREE.Vector2(1, 0);
    this.velocity.copy(dir.multiplyScalar(this.speed));
    this.speed = 0;
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
        } else {
          this.speed = this.velocity.length();
          this.rideDirection = 1;
        }
        return;
      }
    }

    // Projectile physics
    const result = this._simulateFreeFlight(this.position, this.velocity, dt);
    this.position.copy(result.position);
    this.velocity.copy(result.velocity);
  }

  reset(spline) {
    this.spline = spline;
    this.t = 0;
    this.speed = 0;
    this.state = State.RIDING;
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.rideDirection = 1;
    this._wantsAttach = false;
  }
}
