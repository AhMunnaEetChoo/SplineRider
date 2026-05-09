// Level editor — Catmull-Rom splines with pencil-draw, knot dragging, and selection.

import * as THREE from 'three';
import { Spline } from './spline.js';

const HIT_RADIUS = 15;
const CURVE_HIT_RADIUS = 12;
const DRAW_MIN_DIST = 25;

export class Editor {
  constructor(renderer) {
    this.renderer = renderer;

    // Level state (plain data)
    this.splines = [];
    this.startSplineIndex = 0;
    this.startT = 0;
    this.goalPosition = { x: 0, y: 0 };

    // Selection / interaction state
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this.mouseWorld = { x: 0, y: 0 };
    this.mode = 'draw';       // 'draw' | 'pan'
    this._active = false;

    // Callbacks (set by main.js)
    this.onSelectionChange = null;
    this.onModeChange = null;

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
    this.startSplineIndex = 0;
    this.startT = 0;
    this.goalPosition = { x: 200, y: 0 };
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._rebuildView();
  }

  loadLevel(levelData) {
    this.splines = levelData.splines.map(s => ({
      points: s.points.map(p => ({ x: p.x, y: p.y })),
    }));
    this.startSplineIndex = levelData.startSplineIndex || 0;
    this.startT = levelData.startT || 0;
    this.goalPosition = {
      x: levelData.goalPosition.x,
      y: levelData.goalPosition.y,
    };
    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._rebuildView();
  }

  getLevelData() {
    return {
      name: '',
      splines: this.splines,
      startSplineIndex: this.startSplineIndex,
      startT: this.startT,
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
    this.mode = (this.mode === 'draw') ? 'pan' : 'draw';
    this.dragState = null;
    if (this.onModeChange) this.onModeChange(this.mode);
  }

  update() {
    if (!this._active || !this.dragState) return;

    const m = this.mouseWorld;
    const ds = this.dragState;

    if (ds.type === 'knot') {
      const s = this.splines[ds.splineIndex];
      s.points[ds.pointIndex].x = m.x;
      s.points[ds.pointIndex].y = m.y;
      this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
    } else if (ds.type === 'drawing') {
      const s = this.splines[ds.splineIndex];
      const last = s.points[s.points.length - 1];
      const dx = m.x - last.x;
      const dy = m.y - last.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAW_MIN_DIST) {
        s.points.push({ x: m.x, y: m.y });
        this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
      }
    } else if (ds.type === 'start') {
      const result = this._snapToNearestSpline(m.x, m.y);
      if (result) {
        this.startSplineIndex = result.splineIndex;
        this.startT = result.t;
        this.renderer.updateEditorStartMarker(result.position);
      }
    } else if (ds.type === 'goal') {
      this.goalPosition.x = m.x;
      this.goalPosition.y = m.y;
      this.renderer.updateEditorGoalMarker(this.goalPosition);
    }
  }

  // ---- Spline management ----

  addSpline() {
    const mx = this.mouseWorld.x || 0;
    const my = this.mouseWorld.y || 0;
    this.splines.push({
      points: [
        { x: mx - 100, y: my },
        { x: mx + 100, y: my },
      ],
    });
    this._rebuildView();
  }

  deleteSelectedSpline() {
    if (this.splines.length <= 1) return;
    if (this.selectedSplineIndex < 0) return;

    const removedIdx = this.selectedSplineIndex;
    this.splines.splice(removedIdx, 1);

    // Adjust start if needed
    if (this.startSplineIndex >= this.splines.length) {
      this.startSplineIndex = this.splines.length - 1;
      this.startT = 0;
    }
    if (this.startSplineIndex === removedIdx) {
      this.startSplineIndex = Math.min(removedIdx, this.splines.length - 1);
      this.startT = 0;
    } else if (this.startSplineIndex > removedIdx) {
      this.startSplineIndex--;
    }

    this.selectedSplineIndex = -1;
    this.dragState = null;
    this._notifySelectionChange();
    this._rebuildView();
  }

  // ---- Internal ----

  _rebuildView() {
    this.renderer.showEditorView(
      this.splines,
      { splineIndex: this.startSplineIndex, t: this.startT },
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

  _snapToNearestSpline(worldX, worldY) {
    let best = null;
    let bestDist = 30;

    for (let i = 0; i < this.splines.length; i++) {
      const s = this.splines[i];
      if (s.points.length < 2) continue;
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
          best = { splineIndex: i, t, position: { x: pt.x, y: pt.y } };
        }
      }
    }
    return best;
  }

  _isNearStart(worldX, worldY) {
    const s = this.splines[this.startSplineIndex];
    if (s.points.length < 2) return false;
    const spline = new Spline(
      s.points.map(p => new THREE.Vector2(p.x, p.y))
    );
    const pt = spline.pointAt(this.startT);
    const dx = worldX - pt.x;
    const dy = worldY - pt.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  _isNearGoal(worldX, worldY) {
    const dx = worldX - this.goalPosition.x;
    const dy = worldY - this.goalPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  _startDrawing(worldX, worldY) {
    const newIndex = this.splines.length;
    this.splines.push({
      points: [{ x: worldX, y: worldY }],
    });
    this.renderer.showEditorView(
      this.splines,
      { splineIndex: this.startSplineIndex, t: this.startT },
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
      return;
    }

    // 2. Start marker
    if (this._isNearStart(world.x, world.y)) {
      this.dragState = { type: 'start' };
      this._selectSpline(-1);
      return;
    }

    // 3. Knot point hit-test
    const knotHit = this._findNearestKnot(world.x, world.y);
    if (knotHit) {
      this.dragState = { type: 'knot', splineIndex: knotHit.splineIndex, pointIndex: knotHit.pointIndex };
      this._selectSpline(knotHit.splineIndex);
      this.renderer.setEditorKnotHighlight(knotHit.splineIndex, knotHit.pointIndex);
      return;
    }

    // 4. Curve hit-test (select only, no drag)
    const curveHit = this._findNearestCurve(world.x, world.y);
    if (curveHit) {
      this._selectSpline(curveHit.splineIndex);
      return;
    }

    // 5. Nothing hit — start drawing a new spline
    this._startDrawing(world.x, world.y);
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

    // If drawing and only 1 point placed, remove the spline
    if (ds && ds.type === 'drawing') {
      const s = this.splines[ds.splineIndex];
      if (s.points.length < 2) {
        this.splines.splice(ds.splineIndex, 1);
        this.selectedSplineIndex = -1;
        this._notifySelectionChange();
        this._rebuildView();
      }
    }

    this.dragState = null;
    this.renderer.setEditorKnotHighlight(-1, -1);
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
