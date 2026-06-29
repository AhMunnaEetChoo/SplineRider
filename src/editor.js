// Level editor — Catmull-Rom splines with pencil-draw, knot dragging, and selection.

import * as THREE from 'three';
import { Spline } from './spline.js';

const HIT_RADIUS = 15;
const CURVE_HIT_RADIUS = 12;
const DRAW_MIN_DIST = 40;
const KNOT_LONG_PRESS_MS = 300;

export class Editor {
  constructor(renderer) {
    this.renderer = renderer;

    // Level state (plain data)
    this.splines = [];
    this.goalPosition = { x: 0, y: 0 };
    this.startPosition = { x: 0, y: 0 };

    // Selection / interaction state
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this.mouseWorld = { x: 0, y: 0 };
    this.mode = 'freehand';  // 'freehand' | 'straight' | 'knots' | 'pan'
    this._knotMouseDownTime = 0;
    this._knotMouseDownWorld = null;
    this._knotPlacingIndex = -1;
    this._active = false;

    // Callbacks (set by main.js)
    this.onSelectionChange = null;
    this.onModeChange = null;
    // Fired (possibly liberally) whenever the level content may have changed.
    // The consumer re-derives a content hash to decide what actually changed,
    // so spurious fires (e.g. after a pan) are harmless.
    this.onModified = null;

    // Bound handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  initNewLevel() {
    this.splines = [{
      points: [
        { x: -200, y: 0 },
        { x: 200, y: 0 },
      ],
    }];
    this.startPosition = { x: -200, y: 60 };
    this.goalPosition = { x: 200, y: 0 };
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._knotPlacingIndex = -1;
    this._rebuildView();
    this.renderer.frameCamera(this.startPosition, this.goalPosition);
    this._notifyModified();
  }

  loadLevel(levelData) {
    this.splines = levelData.splines.map(s => ({
      points: s.points.map(p => ({ x: p.x, y: p.y })),
    }));
    this.startPosition = {
      x: levelData.startPosition.x,
      y: levelData.startPosition.y,
    };
    this.goalPosition = {
      x: levelData.goalPosition.x,
      y: levelData.goalPosition.y,
    };
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._knotPlacingIndex = -1;
    this._rebuildView();
    this.renderer.frameCamera(this.startPosition, this.goalPosition);
    this._notifyModified();
  }

  getLevelData() {
    return {
      name: '',
      splines: this.splines,
      startPosition: { x: this.startPosition.x, y: this.startPosition.y },
      goalPosition: { x: this.goalPosition.x, y: this.goalPosition.y },
    };
  }

  activate() {
    if (this._active) return;
    this._active = true;
    const canvas = this.renderer.renderer.domElement;
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('touchstart', this._onTouchStart);
    canvas.removeEventListener('touchmove', this._onTouchMove);
    canvas.removeEventListener('touchend', this._onTouchEnd);
    this.dragState = null;
  }

  toggleMode() {
    // Commit any in-progress knot placement before switching
    if (this._knotPlacingIndex >= 0) {
      const s = this.splines[this._knotPlacingIndex];
      if (s.points.length < 2) {
        this.splines.splice(this._knotPlacingIndex, 1);
        this._rebuildView();
      }
      this._knotPlacingIndex = -1;
      this._selectSpline(-1);
    }
    const modes = ['freehand', 'straight', 'knots', 'pan'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];
    this.dragState = null;
    if (this.onModeChange) this.onModeChange(this.mode);
    this._notifyModified();
  }

  update() {
    if (!this._active || !this.dragState) return;

    const m = this.mouseWorld;
    const ds = this.dragState;

    if (ds.type === 'endpointHold') {
      const dx = m.x - ds.startX;
      const dy = m.y - ds.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = performance.now() - ds.startTime;

      if (dist > 5) {
        // Drag → extend the spline
        if (this.mode === 'straight') {
          const newIndex = this.splines.length;
          const ep = this.splines[ds.splineIndex].points[ds.pointIndex];
          this.splines.push({
            points: [{ x: ep.x, y: ep.y }, { x: m.x, y: m.y }],
          });
          this._rebuildView();
          this.dragState = { type: 'straightLine', splineIndex: newIndex, startX: m.x, startY: m.y };
          this._selectSpline(newIndex);
        } else {
          this.dragState = { type: 'drawing', splineIndex: ds.splineIndex, extendFromStart: ds.pointIndex === 0 };
        }
      } else if (elapsed > 300) {
        // Long press → edit knot position
        this.dragState = { type: 'knot', splineIndex: ds.splineIndex, pointIndex: ds.pointIndex };
        this.renderer.setEditorKnotHighlight(ds.splineIndex, ds.pointIndex);
      }
    } else if (ds.type === 'knot') {
      const s = this.splines[ds.splineIndex];
      s.points[ds.pointIndex].x = m.x;
      s.points[ds.pointIndex].y = m.y;
      this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
    } else if (ds.type === 'drawing') {
      const s = this.splines[ds.splineIndex];
      if (ds.extendFromStart) {
        const first = s.points[0];
        const dx = m.x - first.x;
        const dy = m.y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) >= DRAW_MIN_DIST) {
          s.points.unshift({ x: m.x, y: m.y });
          this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
        }
      } else {
        const last = s.points[s.points.length - 1];
        const dx = m.x - last.x;
        const dy = m.y - last.y;
        if (Math.sqrt(dx * dx + dy * dy) >= DRAW_MIN_DIST) {
          s.points.push({ x: m.x, y: m.y });
          this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
        }
      }
    } else if (ds.type === 'straightLine') {
      const s = this.splines[ds.splineIndex];
      s.points[1] = { x: m.x, y: m.y };
      this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
    } else if (ds.type === 'start') {
      this.startPosition.x = m.x;
      this.startPosition.y = m.y;
      this.renderer.updateEditorStartMarker(this.startPosition);
    } else if (ds.type === 'goal') {
      this.goalPosition.x = m.x;
      this.goalPosition.y = m.y;
      this.renderer.updateEditorGoalMarker(this.goalPosition);
    }
  }

  // ---- Spline management ----

  cancelKnotPlacement() {
    if (this._knotPlacingIndex >= 0) {
      this.splines.splice(this._knotPlacingIndex, 1);
      this._knotPlacingIndex = -1;
      this.selectedSplineIndex = -1;
      this._notifySelectionChange();
      this._rebuildView();
      this._notifyModified();
    }
  }

  deleteSelectedSpline() {
    if (this.selectedSplineIndex < 0) return;

    const removedIdx = this.selectedSplineIndex;
    this.splines.splice(removedIdx, 1);

    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._knotPlacingIndex = -1;
    this._notifySelectionChange();
    this._rebuildView();
    this._notifyModified();
  }

  // ---- Internal ----

  _rebuildView() {
    this.renderer.showEditorView(
      this.splines,
      this.startPosition,
      this.goalPosition,
    );
    // Re-apply highlight after rebuild
    if (this.selectedSplineIndex >= 0) {
      this.renderer.setEditorSplineHighlight(this.selectedSplineIndex);
    }
  }

  _notifySelectionChange() {
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedSplineIndex);
    }
  }

  _notifyModified() {
    if (this.onModified) {
      this.onModified();
    }
  }

  _selectSpline(index) {
    if (this.selectedSplineIndex === index) return;
    this.selectedSplineIndex = index;
    this.renderer.setEditorSplineHighlight(index);
    this._notifySelectionChange();
  }

  _screenToWorld(sx, sy) {
    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const cam = this.renderer.camera;

    const ndcX = ((sx - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((sy - rect.top) / rect.height) * 2 + 1;

    const halfW = (cam.right - cam.left) / 2;
    const halfH = (cam.top - cam.bottom) / 2;
    const cx = (cam.right + cam.left) / 2 + cam.position.x;
    const cy = (cam.top + cam.bottom) / 2 + cam.position.y;

    return {
      x: cx + ndcX * halfW,
      y: cy + ndcY * halfH,
    };
  }

  _findNearestKnot(worldX, worldY) {
    let best = null;
    let bestDist = HIT_RADIUS;

    for (let i = 0; i < this.splines.length; i++) {
      const s = this.splines[i];
      for (let pi = 0; pi < s.points.length; pi++) {
        const pt = s.points[pi];
        const dx = worldX - pt.x;
        const dy = worldY - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { splineIndex: i, pointIndex: pi, distance: dist };
        }
      }
    }
    return best;
  }

  _findNearestCurve(worldX, worldY) {
    let best = null;
    let bestDist = CURVE_HIT_RADIUS;

    for (let i = 0; i < this.splines.length; i++) {
      const s = this.splines[i];
      if (s.points.length < 2) continue;
      // Create a temporary Spline to sample
      const spline = new Spline(
        s.points.map(p => new THREE.Vector2(p.x, p.y))
      );
      const samples = 32;
      for (let j = 0; j <= samples; j++) {
        const t = j / samples;
        const pt = spline.pointAt(t);
        const dx = worldX - pt.x;
        const dy = worldY - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { splineIndex: i, distance: dist };
        }
      }
    }
    return best;
  }

  _isNearStart(worldX, worldY) {
    const dx = worldX - this.startPosition.x;
    const dy = worldY - this.startPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  _isNearGoal(worldX, worldY) {
    const dx = worldX - this.goalPosition.x;
    const dy = worldY - this.goalPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  _findNearEndpoint(worldX, worldY) {
    for (let i = 0; i < this.splines.length; i++) {
      const pts = this.splines[i].points;
      if (pts.length < 2) continue;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dFirst = Math.sqrt((worldX - first.x) ** 2 + (worldY - first.y) ** 2);
      const dLast = Math.sqrt((worldX - last.x) ** 2 + (worldY - last.y) ** 2);
      if (dFirst < HIT_RADIUS) {
        return { splineIndex: i, pointIndex: 0 };
      }
      if (dLast < HIT_RADIUS) {
        return { splineIndex: i, pointIndex: pts.length - 1 };
      }
    }
    return null;
  }

  _startDrawing(worldX, worldY) {
    const newIndex = this.splines.length;
    this.splines.push({
      points: [{ x: worldX, y: worldY }],
    });
    this.renderer.showEditorView(
      this.splines,
      this.startPosition,
      this.goalPosition,
    );
    this.dragState = { type: 'drawing', splineIndex: newIndex };
    this._selectSpline(newIndex);
  }

  // ---- Mouse events ----

  _onMouseDown(e) {
    const world = this._screenToWorld(e.clientX, e.clientY);
    this.mouseWorld = world;

    // Pan mode: click-drag pans the camera
    if (this.mode === 'pan') {
      this.dragState = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        camStartX: this.renderer.camera.position.x,
        camStartY: this.renderer.camera.position.y,
      };
      return;
    }

    // 1. Goal marker
    if (this._isNearGoal(world.x, world.y)) {
      this.dragState = { type: 'goal' };
      this._selectSpline(-1);
      this._knotPlacingIndex = -1;
      return;
    }

    // 2. Start marker
    if (this._isNearStart(world.x, world.y)) {
      this.dragState = { type: 'start' };
      this._selectSpline(-1);
      this._knotPlacingIndex = -1;
      return;
    }

    // 3. Endpoint hit — hold to drag knot, drag to extend (freehand/straight)
    if (this.mode === 'freehand' || this.mode === 'straight') {
      const extendHit = this._findNearEndpoint(world.x, world.y);
      if (extendHit) {
        this.dragState = {
          type: 'endpointHold',
          splineIndex: extendHit.splineIndex,
          pointIndex: extendHit.pointIndex,
          startX: world.x,
          startY: world.y,
          startTime: performance.now(),
        };
        this._selectSpline(extendHit.splineIndex);
        this._knotPlacingIndex = -1;
        return;
      }

      // 4. Knot point hit-test
      const knotHit = this._findNearestKnot(world.x, world.y);
      if (knotHit) {
        this.dragState = { type: 'knot', splineIndex: knotHit.splineIndex, pointIndex: knotHit.pointIndex };
        this._selectSpline(knotHit.splineIndex);
        this.renderer.setEditorKnotHighlight(knotHit.splineIndex, knotHit.pointIndex);
        this._knotPlacingIndex = -1;
        return;
      }

      // 5. Curve hit-test (select only, no drag)
      const curveHit = this._findNearestCurve(world.x, world.y);
      if (curveHit) {
        this._selectSpline(curveHit.splineIndex);
        this._knotPlacingIndex = -1;
        return;
      }
    }

    // 6. Straight line mode — start a new line (extend was already handled above)
    if (this.mode === 'straight') {
      const newIndex = this.splines.length;
      this.splines.push({
        points: [{ x: world.x, y: world.y }, { x: world.x, y: world.y }],
      });
      this._rebuildView();
      this.dragState = { type: 'straightLine', splineIndex: newIndex, startX: world.x, startY: world.y };
      this._selectSpline(newIndex);
      this._knotPlacingIndex = -1;
      return;
    }

    // 7. Knots mode — record press, act on release
    if (this.mode === 'knots') {
      this._knotMouseDownTime = performance.now();
      this._knotMouseDownWorld = { x: world.x, y: world.y };
      this.dragState = null;
      return;
    }

    // 8. Freehand mode — start drawing (extend was already handled above)
    if (this.mode === 'freehand') {
      this._startDrawing(world.x, world.y);
      this._knotPlacingIndex = -1;
      return;
    }
  }

  _onMouseMove(e) {
    const world = this._screenToWorld(e.clientX, e.clientY);
    this.mouseWorld = world;

    if (this.dragState && this.dragState.type === 'pan') {
      const ds = this.dragState;
      const canvas = this.renderer.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const cam = this.renderer.camera;
      const worldWidth = cam.right - cam.left;

      const dx = (e.clientX - ds.startX) / rect.width * worldWidth;
      const dy = (e.clientY - ds.startY) / rect.height * (cam.top - cam.bottom);

      this.renderer.camera.position.x = ds.camStartX - dx;
      this.renderer.camera.position.y = ds.camStartY + dy;
      return;
    }

    if (!this.dragState) {
      // Hover highlight on nearest knot
      const hit = this._findNearestKnot(world.x, world.y);
      if (hit) {
        this.renderer.setEditorKnotHighlight(hit.splineIndex, hit.pointIndex);
      } else {
        this.renderer.setEditorKnotHighlight(-1, -1);
      }
    }
  }

  _onMouseUp() {
    const ds = this.dragState;

    if (ds && ds.type === 'pan') {
      this.dragState = null;
      return;
    }

    // Straight line — keep even if very short (user can delete)
    if (ds && ds.type === 'straightLine') {
      const s = this.splines[ds.splineIndex];
      const dx = s.points[1].x - s.points[0].x;
      const dy = s.points[1].y - s.points[0].y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        this.splines.splice(ds.splineIndex, 1);
        this.selectedSplineIndex = -1;
        this._notifySelectionChange();
        this._rebuildView();
      }
    }

    // Freehand draw — the first click shows a point for feedback, but if the
    // drag never reached DRAW_MIN_DIST the spline is still a lone point (a
    // click/release in roughly the same spot). Discard it rather than leave a
    // degenerate 1-point spline. (Extending an existing spline can't hit this:
    // those splines already have ≥2 points.)
    if (ds && ds.type === 'drawing') {
      const s = this.splines[ds.splineIndex];
      if (s && s.points.length < 2) {
        this.splines.splice(ds.splineIndex, 1);
        this.selectedSplineIndex = -1;
        this._notifySelectionChange();
        this._rebuildView();
      }
    }

    // Knots mode: long press to finish, normal click to place point
    if (this.mode === 'knots' && this._knotMouseDownWorld && !ds) {
      const duration = performance.now() - this._knotMouseDownTime;
      const w = this._knotMouseDownWorld;

      if (this._knotPlacingIndex >= 0 && duration >= KNOT_LONG_PRESS_MS) {
        // Long press: finish the spline
        const s = this.splines[this._knotPlacingIndex];
        if (s.points.length < 2) {
          this.splines.splice(this._knotPlacingIndex, 1);
          this._rebuildView();
        }
        this._knotPlacingIndex = -1;
        this._selectSpline(-1);
      } else if (this._knotPlacingIndex >= 0) {
        // Normal click: add point to current spline
        const s = this.splines[this._knotPlacingIndex];
        s.points.push({ x: w.x, y: w.y });
        this.renderer.updateEditorSplineGeometry(this._knotPlacingIndex, s);
      } else {
        // Start new spline
        const newIndex = this.splines.length;
        this.splines.push({
          points: [{ x: w.x, y: w.y }],
        });
        this._rebuildView();
        this._knotPlacingIndex = newIndex;
        this._selectSpline(newIndex);
      }
    }

    this.dragState = null;
    this.renderer.setEditorKnotHighlight(-1, -1);
    // Any non-pan interaction may have changed level content (pan returns early
    // above). The consumer hashes to confirm, so over-firing here is harmless.
    this._notifyModified();
  }

  // ---- Touch events ----

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    this._onMouseDown({ clientX: t.clientX, clientY: t.clientY });
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    this._onMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }

  _onTouchEnd() {
    this._onMouseUp();
  }
}
