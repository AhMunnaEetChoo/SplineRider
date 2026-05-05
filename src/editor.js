// Level editor — canvas mouse/touch handling, control-point dragging, toolbar actions.

const HIT_RADIUS = 15;

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
    this.selectedPointIndex = -1;
    this.dragState = null;
    this.mouseWorld = { x: 0, y: 0 };
    this._active = false;

    // Bound handlers for add/remove
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  initNewLevel() {
    this.splines = [{
      p0: { x: -200, y: 0 },
      p1: { x: -66, y: 0 },
      p2: { x: 66, y: 0 },
      p3: { x: 200, y: 0 },
    }];
    this.startSplineIndex = 0;
    this.startT = 0;
    this.goalPosition = { x: 200, y: 0 };
    this.selectedSplineIndex = -1;
    this.selectedPointIndex = -1;
    this.dragState = null;
    this._rebuildView();
  }

  loadLevel(levelData) {
    this.splines = levelData.splines.map(s => ({
      p0: { x: s.p0.x, y: s.p0.y },
      p1: { x: s.p1.x, y: s.p1.y },
      p2: { x: s.p2.x, y: s.p2.y },
      p3: { x: s.p3.x, y: s.p3.y },
    }));
    this.startSplineIndex = levelData.startSplineIndex || 0;
    this.startT = levelData.startT || 0;
    this.goalPosition = {
      x: levelData.goalPosition.x,
      y: levelData.goalPosition.y,
    };
    this.selectedSplineIndex = -1;
    this.selectedPointIndex = -1;
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

  update() {
    if (!this._active || !this.dragState) return;

    const m = this.mouseWorld;
    const ds = this.dragState;

    if (ds.type === 'controlPoint') {
      const s = this.splines[ds.splineIndex];
      s['p' + ds.pointIndex].x = m.x;
      s['p' + ds.pointIndex].y = m.y;
      this.renderer.updateEditorSplineGeometry(ds.splineIndex, s);
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
    // Add a flat spline near the mouse or at origin
    const mx = this.mouseWorld.x || 0;
    const my = this.mouseWorld.y || 0;
    this.splines.push({
      p0: { x: mx - 100, y: my },
      p1: { x: mx - 33, y: my },
      p2: { x: mx + 33, y: my },
      p3: { x: mx + 100, y: my },
    });
    this._rebuildView();
  }

  deleteSelectedSpline() {
    if (this.splines.length <= 1) return;
    if (this.selectedSplineIndex < 0) return;

    this.splines.splice(this.selectedSplineIndex, 1);

    // Adjust start if needed
    if (this.startSplineIndex >= this.splines.length) {
      this.startSplineIndex = this.splines.length - 1;
      this.startT = 0;
    }
    if (this.startSplineIndex === this.selectedSplineIndex) {
      this.startT = 0;
    } else if (this.startSplineIndex > this.selectedSplineIndex) {
      this.startSplineIndex--;
    }

    this.selectedSplineIndex = -1;
    this.selectedPointIndex = -1;
    this.dragState = null;
    this._rebuildView();
  }

  // ---- Internal ----

  _rebuildView() {
    this.renderer.showEditorView(
      this.splines,
      { splineIndex: this.startSplineIndex, t: this.startT },
      this.goalPosition,
    );
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

  _findNearestControlPoint(worldX, worldY) {
    let best = null;
    let bestDist = HIT_RADIUS;

    for (let i = 0; i < this.splines.length; i++) {
      const s = this.splines[i];
      for (let pi = 0; pi < 4; pi++) {
        const pt = s['p' + pi];
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

  _snapToNearestSpline(worldX, worldY) {
    let best = null;
    let bestDist = 30;

    for (let i = 0; i < this.splines.length; i++) {
      const s = this.splines[i];
      // Imported lazily — use a simple 32-sample search
      const samples = 32;
      for (let j = 0; j <= samples; j++) {
        const t = j / samples;
        const pt = this._evaluateSpline(s, t);
        const dx = worldX - pt.x;
        const dy = worldY - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { splineIndex: i, t, position: pt };
        }
      }
    }
    return best;
  }

  _evaluateSpline(s, t) {
    const t1 = 1 - t;
    const t1_2 = t1 * t1;
    const t1_3 = t1_2 * t1;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: t1_3 * s.p0.x + 3 * t1_2 * t * s.p1.x + 3 * t1 * t2 * s.p2.x + t3 * s.p3.x,
      y: t1_3 * s.p0.y + 3 * t1_2 * t * s.p1.y + 3 * t1 * t2 * s.p2.y + t3 * s.p3.y,
    };
  }

  _isNearStart(worldX, worldY) {
    const s = this.splines[this.startSplineIndex];
    const pt = this._evaluateSpline(s, this.startT);
    const dx = worldX - pt.x;
    const dy = worldY - pt.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  _isNearGoal(worldX, worldY) {
    const dx = worldX - this.goalPosition.x;
    const dy = worldY - this.goalPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  }

  // ---- Mouse events ----

  _onMouseDown(e) {
    const world = this._screenToWorld(e.clientX, e.clientY);
    this.mouseWorld = world;

    // Check goal first (rendered on top conceptually), then start, then control points
    if (this._isNearGoal(world.x, world.y)) {
      this.dragState = { type: 'goal' };
      this.selectedSplineIndex = -1;
      this.selectedPointIndex = -1;
      this.renderer.setEditorSplineHighlight(-1);
      return;
    }

    if (this._isNearStart(world.x, world.y)) {
      this.dragState = { type: 'start' };
      this.selectedSplineIndex = -1;
      this.selectedPointIndex = -1;
      this.renderer.setEditorSplineHighlight(-1);
      return;
    }

    const hit = this._findNearestControlPoint(world.x, world.y);
    if (hit) {
      this.dragState = { type: 'controlPoint', splineIndex: hit.splineIndex, pointIndex: hit.pointIndex };
      this.selectedSplineIndex = hit.splineIndex;
      this.selectedPointIndex = hit.pointIndex;
      this.renderer.setEditorSplineHighlight(hit.splineIndex);
      this.renderer.setEditorControlPointHighlight(hit.splineIndex, hit.pointIndex);
    } else {
      this.selectedSplineIndex = -1;
      this.selectedPointIndex = -1;
      this.renderer.setEditorSplineHighlight(-1);
      this.renderer.setEditorControlPointHighlight(-1, -1);
    }
  }

  _onMouseMove(e) {
    const world = this._screenToWorld(e.clientX, e.clientY);
    this.mouseWorld = world;

    // Hover highlight (only when not dragging)
    if (!this.dragState) {
      const hit = this._findNearestControlPoint(world.x, world.y);
      if (hit) {
        this.renderer.setEditorSplineHighlight(hit.splineIndex);
      }
    }
  }

  _onMouseUp() {
    this.dragState = null;
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
