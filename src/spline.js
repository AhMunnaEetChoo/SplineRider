import * as THREE from 'three';

// Catmull-Rom spline — multi-segment path defined by through-points
export class Spline {
  constructor(points) {
    this.points = points.map(p => p.clone());
    this._buildArcLengthTable(200);
  }

  get numSegments() {
    return Math.max(1, this.points.length - 1);
  }

  _getSegmentControlPoints(segIndex) {
    const i = segIndex;
    const prev = this.points[Math.max(0, i - 1)];
    const curr = this.points[i];
    const next = this.points[i + 1];
    const next2 = this.points[Math.min(this.points.length - 1, i + 2)];
    return { prev, curr, next, next2 };
  }

  _segmentAndLocalT(t) {
    const clamped = Math.max(0, Math.min(1, t));
    const segT = clamped * this.numSegments;
    const segIndex = Math.min(Math.floor(segT), this.numSegments - 1);
    const localT = segT - segIndex;
    return { segIndex, localT };
  }

  pointAt(t) {
    if (this.points.length < 2) {
      return this.points.length === 1 ? this.points[0].clone() : new THREE.Vector2();
    }
    const { segIndex, localT } = this._segmentAndLocalT(t);
    const { prev, curr, next, next2 } = this._getSegmentControlPoints(segIndex);
    return _catmullRomPoint(prev, curr, next, next2, localT);
  }

  tangentAt(t) {
    if (this.points.length < 2) return new THREE.Vector2(1, 0);
    const { segIndex, localT } = this._segmentAndLocalT(t);
    const { prev, curr, next, next2 } = this._getSegmentControlPoints(segIndex);
    return _catmullRomTangent(prev, curr, next, next2, localT);
  }

  findClosestPointOnSpline(worldPos, samples = 128) {
    let bestT = 0;
    let bestDist = Infinity;
    let bestPoint = new THREE.Vector2();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pt = this.pointAt(t);
      const dist = worldPos.distanceToSquared(pt);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
        bestPoint = pt;
      }
    }
    return { t: bestT, point: bestPoint, distance: Math.sqrt(bestDist) };
  }

  samplePoints(count = 64) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      pts.push(this.pointAt(i / count));
    }
    return pts;
  }

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

  _buildArcLengthTable(samples) {
    this._arcTable = [{ t: 0, s: 0 }];
    let prev = this.pointAt(0);
    let cumLen = 0;
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const curr = this.pointAt(t);
      cumLen += prev.distanceTo(curr);
      this._arcTable.push({ t, s: cumLen });
      prev = curr;
    }
  }

  paramDelta(t, speed, deltaTime) {
    if (this.points.length < 2) return 0;
    const ds = speed * deltaTime;
    const totalLen = this._arcTable[this._arcTable.length - 1].s;
    if (totalLen < 0.0001) return 0;
    const idx = t * (this._arcTable.length - 1);
    const i = Math.min(Math.floor(idx), this._arcTable.length - 2);
    const frac = idx - i;
    const segDS = this._arcTable[i + 1].s - this._arcTable[i].s;
    const segDT = this._arcTable[i + 1].t - this._arcTable[i].t;
    const dsdt = segDT > 0 ? segDS / segDT : 0.0001;
    return ds / dsdt;
  }

  getStartPoint() {
    return this.points[0].clone();
  }

  getEndPoint() {
    return this.points[this.points.length - 1].clone();
  }

  getStartTangent() {
    return this.tangentAt(0);
  }

  getEndTangent() {
    return this.tangentAt(1);
  }
}

// Catmull-Rom position: given 4 control points, evaluate at localT (0..1)
function _catmullRomPoint(P0, P1, P2, P3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return new THREE.Vector2(
    0.5 * (2 * P1.x + (-P0.x + P2.x) * t + (2 * P0.x - 5 * P1.x + 4 * P2.x - P3.x) * t2 + (-P0.x + 3 * P1.x - 3 * P2.x + P3.x) * t3),
    0.5 * (2 * P1.y + (-P0.y + P2.y) * t + (2 * P0.y - 5 * P1.y + 4 * P2.y - P3.y) * t2 + (-P0.y + 3 * P1.y - 3 * P2.y + P3.y) * t3),
  );
}

// Catmull-Rom tangent (derivative)
function _catmullRomTangent(P0, P1, P2, P3, t) {
  const t2 = t * t;
  return new THREE.Vector2(
    0.5 * ((-P0.x + P2.x) + 2 * (2 * P0.x - 5 * P1.x + 4 * P2.x - P3.x) * t + 3 * (-P0.x + 3 * P1.x - 3 * P2.x + P3.x) * t2),
    0.5 * ((-P0.y + P2.y) + 2 * (2 * P0.y - 5 * P1.y + 4 * P2.y - P3.y) * t + 3 * (-P0.y + 3 * P1.y - 3 * P2.y + P3.y) * t2),
  );
}
