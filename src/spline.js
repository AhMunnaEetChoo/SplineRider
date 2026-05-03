import * as THREE from 'three';

// Cubic Bezier spline — single segment
export class Spline {
  constructor(p0, p1, p2, p3) {
    this.p0 = p0.clone();
    this.p1 = p1.clone();
    this.p2 = p2.clone();
    this.p3 = p3.clone();
  }

  // Evaluate position at parameter t (0..1)
  pointAt(t) {
    const t1 = 1 - t;
    const t1_2 = t1 * t1;
    const t1_3 = t1_2 * t1;
    const t2 = t * t;
    const t3 = t2 * t;

    return new THREE.Vector2(
      t1_3 * this.p0.x + 3 * t1_2 * t * this.p1.x + 3 * t1 * t2 * this.p2.x + t3 * this.p3.x,
      t1_3 * this.p0.y + 3 * t1_2 * t * this.p1.y + 3 * t1 * t2 * this.p2.y + t3 * this.p3.y
    );
  }

  // Evaluate tangent (derivative) at parameter t
  tangentAt(t) {
    const t1 = 1 - t;
    const t1_2 = t1 * t1;
    const t2 = t * t;

    return new THREE.Vector2(
      3 * t1_2 * (this.p1.x - this.p0.x) + 6 * t1 * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
      3 * t1_2 * (this.p1.y - this.p0.y) + 6 * t1 * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
    );
  }

  // Sample points along the spline for rendering
  samplePoints(count = 64) {
    const points = [];
    for (let i = 0; i <= count; i++) {
      const p = this.pointAt(i / count);
      points.push(p);
    }
    return points;
  }

  // Build a Three.js line geometry from sampled points
  createLineGeometry(count = 64) {
    const sampled = this.samplePoints(count);
    const verts = [];
    for (const p of sampled) {
      verts.push(p.x, p.y, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }

  // Compute arc length (approximate via sampling)
  arcLength(samples = 100) {
    let len = 0;
    let prev = this.pointAt(0);
    for (let i = 1; i <= samples; i++) {
      const curr = this.pointAt(i / samples);
      len += prev.distanceTo(curr);
      prev = curr;
    }
    return len;
  }

  // Convert arc length speed delta to parameter delta
  // dt ≈ speed * deltaTime / |tangent(t)|
  paramDelta(t, speed, deltaTime) {
    const tangent = this.tangentAt(t);
    const tlen = tangent.length();
    if (tlen < 0.0001) return 0;
    return (speed * deltaTime) / tlen;
  }
}
