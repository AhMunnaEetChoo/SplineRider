import * as THREE from 'three';

export const SUB_PER_SEGMENT = 32;
const TUBE_RADIUS = 5;
const TUBE_RADIAL_SEGMENTS = 8;

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

  samplePoints(count) {
    if (count === undefined) count = this.numSegments * SUB_PER_SEGMENT;
    const pts = [];
    for (let i = 0; i <= count; i++) {
      pts.push(this.pointAt(i / count));
    }
    return pts;
  }

  createTubeGeometry(radius = TUBE_RADIUS) {
    const tubularSegments = this.numSegments * SUB_PER_SEGMENT;
    const sampled = this.samplePoints(tubularSegments);
    const pts3 = sampled.map(p => new THREE.Vector3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts3, false, 'catmullrom');
    return new THREE.TubeGeometry(curve, tubularSegments, radius, TUBE_RADIAL_SEGMENTS, false);
  }

  // Flat 2D ribbon for the game view. Static geometry — thickness and the
  // connection-bump deformation are applied in the vertex shader via uniforms.
  // Per-vertex: position = rest centerline, aNormal = unit normal, aAcross = ±1
  // (which edge), aLong = arc length from start (drives the bump falloff/gradient).
  createRibbonGeometry() {
    const samples = this.numSegments * SUB_PER_SEGMENT;
    const positions = [];
    const normals = [];
    const across = [];
    const longs = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const c = this.pointAt(t);
      const tan = this.tangentAt(t);
      const len = tan.length();
      const nx = len > 1e-6 ? -tan.y / len : 0;
      const ny = len > 1e-6 ? tan.x / len : 1;
      const s = this.arcLengthAt(t);
      positions.push(c.x, c.y, 0, c.x, c.y, 0);
      normals.push(nx, ny, nx, ny);
      across.push(-1, 1);
      longs.push(s, s);
    }
    const index = [];
    for (let i = 0; i < samples; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      index.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals, 2));
    geo.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    geo.setAttribute('aLong', new THREE.Float32BufferAttribute(longs, 1));
    geo.setIndex(index);
    return geo;
  }

  // Arc length from the start of the spline to parameter t (interpolated table).
  arcLengthAt(t) {
    const ct = Math.max(0, Math.min(1, t));
    const table = this._arcTable;
    const idx = ct * (table.length - 1);
    const i = Math.min(Math.floor(idx), table.length - 2);
    const frac = idx - i;
    return table[i].s + (table[i + 1].s - table[i].s) * frac;
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
