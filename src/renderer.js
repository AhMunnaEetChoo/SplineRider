import * as THREE from 'three';
import { Spline } from './spline.js';

export class Renderer {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1a2e');

    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 500;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      1, 2000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this._onResize = () => {
      const a = window.innerWidth / window.innerHeight;
      this.camera.left = -viewSize * a;
      this.camera.right = viewSize * a;
      this.camera.top = viewSize;
      this.camera.bottom = -viewSize;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);

    // View groups — only one visible at a time
    this.gameViewGroup = new THREE.Group();
    this.editorViewGroup = new THREE.Group();

    // Player dot (always in scene)
    const dotGeo = new THREE.CircleGeometry(12, 32);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#ff6b6b' });
    this.playerDot = new THREE.Mesh(dotGeo, dotMat);
    this.scene.add(this.playerDot);

    // Markers
    this.startMarker = null;
    this.goalMarker = null;

    // Editor state
    this._editorSplineLines = [];
    this._editorSplineDots = [];
    this._editorHandleLines = [];
    this._editorSelectedIndex = -1;

    // Controls hint
    this._addTextHints();
  }

  _addTextHints() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff44';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('← → or A/D to move | press both to launch | R to reset', 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(512, 64, 1);
    sprite.position.set(0, 280, 0);
    this.scene.add(sprite);
  }

  // ---- Game View ----

  showGameView(splines, goalPosition) {
    if (this.editorViewGroup.parent) {
      this.scene.remove(this.editorViewGroup);
    }
    if (!this.gameViewGroup.parent) {
      this.scene.add(this.gameViewGroup);
    }
    this._clearGameView();
    this._buildGameView(splines, goalPosition);
  }

  _clearGameView() {
    while (this.gameViewGroup.children.length > 0) {
      const child = this.gameViewGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.gameViewGroup.remove(child);
    }
    if (this.startMarker) {
      this.scene.remove(this.startMarker);
      this.startMarker = null;
    }
    if (this.goalMarker) {
      this.scene.remove(this.goalMarker);
      this.goalMarker = null;
    }
  }

  _buildGameView(splines, goalPosition) {
    const allVerts = [];
    for (let i = 0; i < splines.length; i++) {
      const sampled = splines[i].samplePoints(64);
      const startIdx = (i > 0) ? 1 : 0;
      for (let j = startIdx; j < sampled.length; j++) {
        allVerts.push(sampled[j].x, sampled[j].y, 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#4ecdc4' });
    const line = new THREE.Line(geo, mat);
    this.gameViewGroup.add(line);

    if (splines.length > 0) {
      const startPos = splines[0].pointAt(0);
      const startGeo = new THREE.CircleGeometry(10, 32);
      const startMat = new THREE.MeshBasicMaterial({ color: '#4ecdc4' });
      this.startMarker = new THREE.Mesh(startGeo, startMat);
      this.startMarker.position.set(startPos.x, startPos.y, 0.02);
      this.scene.add(this.startMarker);

      const endPos = goalPosition || splines[splines.length - 1].pointAt(1);
      const goalGeo = new THREE.RingGeometry(30, 36, 32);
      const goalMat = new THREE.MeshBasicMaterial({ color: '#ffe66d', side: THREE.DoubleSide });
      this.goalMarker = new THREE.Mesh(goalGeo, goalMat);
      this.goalMarker.position.set(endPos.x, endPos.y, 0.02);
      this.scene.add(this.goalMarker);
    }
  }

  // ---- Editor View ----

  showEditorView(splinesData, startInfo, goalPos) {
    if (this.gameViewGroup.parent) {
      this.scene.remove(this.gameViewGroup);
    }
    if (!this.editorViewGroup.parent) {
      this.scene.add(this.editorViewGroup);
    }
    this._clearEditorView();
    this._buildEditorView(splinesData, startInfo, goalPos);
  }

  _clearEditorView() {
    while (this.editorViewGroup.children.length > 0) {
      const child = this.editorViewGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.editorViewGroup.remove(child);
    }
    this._editorSplineLines = [];
    this._editorSplineDots = [];
    this._editorHandleLines = [];
    this._editorSelectedIndex = -1;

    if (this.startMarker) {
      this.scene.remove(this.startMarker);
      this.startMarker = null;
    }
    if (this.goalMarker) {
      this.scene.remove(this.goalMarker);
      this.goalMarker = null;
    }
  }

  _buildEditorView(splinesData, startInfo, goalPos) {
    const lineMat = new THREE.LineBasicMaterial({ color: '#4ecdc4' });
    const handleMat = new THREE.LineBasicMaterial({ color: '#4ecdc444' });
    const dotMatEnd = new THREE.MeshBasicMaterial({ color: '#4ecdc4' });
    const dotMatCtrl = new THREE.MeshBasicMaterial({ color: '#88ddf8' });

    for (let i = 0; i < splinesData.length; i++) {
      const s = splinesData[i];
      const spline = new Spline(
        new THREE.Vector2(s.p0.x, s.p0.y),
        new THREE.Vector2(s.p1.x, s.p1.y),
        new THREE.Vector2(s.p2.x, s.p2.y),
        new THREE.Vector2(s.p3.x, s.p3.y),
      );

      // Curve line
      const geo = spline.createLineGeometry(64);
      const line = new THREE.Line(geo, lineMat.clone());
      this.editorViewGroup.add(line);
      this._editorSplineLines.push({ spline, line, geo });

      // Handle lines
      const hVerts1 = [s.p0.x, s.p0.y, 0, s.p1.x, s.p1.y, 0];
      const hGeo1 = new THREE.BufferGeometry();
      hGeo1.setAttribute('position', new THREE.Float32BufferAttribute(hVerts1, 3));
      const hLine1 = new THREE.Line(hGeo1, handleMat.clone());
      this.editorViewGroup.add(hLine1);

      const hVerts2 = [s.p2.x, s.p2.y, 0, s.p3.x, s.p3.y, 0];
      const hGeo2 = new THREE.BufferGeometry();
      hGeo2.setAttribute('position', new THREE.Float32BufferAttribute(hVerts2, 3));
      const hLine2 = new THREE.Line(hGeo2, handleMat.clone());
      this.editorViewGroup.add(hLine2);

      this._editorHandleLines.push({ geo1: hGeo1, line1: hLine1, geo2: hGeo2, line2: hLine2 });

      // Control point dots
      const dots = [];
      for (let pi = 0; pi < 4; pi++) {
        const isEndpoint = (pi === 0 || pi === 3);
        const radius = isEndpoint ? 7 : 5;
        const dotGeo = new THREE.CircleGeometry(radius, 16);
        const dot = new THREE.Mesh(dotGeo, isEndpoint ? dotMatEnd.clone() : dotMatCtrl.clone());
        const pt = s['p' + pi];
        dot.position.set(pt.x, pt.y, 0.03);
        this.editorViewGroup.add(dot);
        dots.push(dot);
      }
      this._editorSplineDots.push(dots);
    }

    // Start marker
    const startSpline = new Spline(
      new THREE.Vector2(splinesData[startInfo.splineIndex].p0.x, splinesData[startInfo.splineIndex].p0.y),
      new THREE.Vector2(splinesData[startInfo.splineIndex].p1.x, splinesData[startInfo.splineIndex].p1.y),
      new THREE.Vector2(splinesData[startInfo.splineIndex].p2.x, splinesData[startInfo.splineIndex].p2.y),
      new THREE.Vector2(splinesData[startInfo.splineIndex].p3.x, splinesData[startInfo.splineIndex].p3.y),
    );
    const startPos = startSpline.pointAt(startInfo.t);
    const startGeo = new THREE.CircleGeometry(10, 32);
    const startMat = new THREE.MeshBasicMaterial({ color: '#4ecdc4' });
    this.startMarker = new THREE.Mesh(startGeo, startMat);
    this.startMarker.position.set(startPos.x, startPos.y, 0.04);
    this.scene.add(this.startMarker);

    // Goal marker
    const goalGeo = new THREE.RingGeometry(30, 36, 32);
    const goalMat = new THREE.MeshBasicMaterial({ color: '#ffe66d', side: THREE.DoubleSide });
    this.goalMarker = new THREE.Mesh(goalGeo, goalMat);
    this.goalMarker.position.set(goalPos.x, goalPos.y, 0.04);
    this.scene.add(this.goalMarker);
  }

  updateEditorSplineGeometry(index, splineData) {
    if (index < 0 || index >= this._editorSplineLines.length) return;

    const entry = this._editorSplineLines[index];
    const s = splineData;

    entry.spline.p0.set(s.p0.x, s.p0.y);
    entry.spline.p1.set(s.p1.x, s.p1.y);
    entry.spline.p2.set(s.p2.x, s.p2.y);
    entry.spline.p3.set(s.p3.x, s.p3.y);

    const sampled = entry.spline.samplePoints(64);
    const verts = entry.geo.attributes.position.array;
    for (let i = 0; i < sampled.length; i++) {
      verts[i * 3] = sampled[i].x;
      verts[i * 3 + 1] = sampled[i].y;
    }
    entry.geo.attributes.position.needsUpdate = true;

    // Handle lines
    const h = this._editorHandleLines[index];
    h.geo1.attributes.position.array[0] = s.p0.x;
    h.geo1.attributes.position.array[1] = s.p0.y;
    h.geo1.attributes.position.array[3] = s.p1.x;
    h.geo1.attributes.position.array[4] = s.p1.y;
    h.geo1.attributes.position.needsUpdate = true;

    h.geo2.attributes.position.array[0] = s.p2.x;
    h.geo2.attributes.position.array[1] = s.p2.y;
    h.geo2.attributes.position.array[3] = s.p3.x;
    h.geo2.attributes.position.array[4] = s.p3.y;
    h.geo2.attributes.position.needsUpdate = true;

    // Control point dots
    const dots = this._editorSplineDots[index];
    for (let pi = 0; pi < 4; pi++) {
      const pt = s['p' + pi];
      dots[pi].position.set(pt.x, pt.y, 0.03);
    }
  }

  setEditorSplineHighlight(index) {
    if (index === this._editorSelectedIndex) return;
    this._editorSelectedIndex = index;

    const defaultColor = '#4ecdc4';
    const highlightColor = '#ffe66d';
    const defaultCtrl = '#88ddf8';
    const highlightCtrl = '#ffcc44';

    for (let i = 0; i < this._editorSplineLines.length; i++) {
      const color = (i === index) ? highlightColor : defaultColor;
      this._editorSplineLines[i].line.material.color.set(color);
    }

    for (let i = 0; i < this._editorSplineDots.length; i++) {
      for (let pi = 0; pi < 4; pi++) {
        const isEndpoint = (pi === 0 || pi === 3);
        const color = (i === index)
          ? (isEndpoint ? highlightColor : highlightCtrl)
          : (isEndpoint ? defaultColor : defaultCtrl);
        this._editorSplineDots[i][pi].material.color.set(color);
      }
    }
  }

  setEditorControlPointHighlight(splineIndex, pointIndex) {
    for (let i = 0; i < this._editorSplineDots.length; i++) {
      for (let pi = 0; pi < 4; pi++) {
        const dot = this._editorSplineDots[i][pi];
        const isSelected = (i === splineIndex && pi === pointIndex);
        dot.scale.setScalar(isSelected ? 1.5 : 1.0);
      }
    }
  }

  updateEditorStartMarker(position) {
    if (this.startMarker) {
      this.startMarker.position.set(position.x, position.y, 0.04);
    }
  }

  updateEditorGoalMarker(position) {
    if (this.goalMarker) {
      this.goalMarker.position.set(position.x, position.y, 0.04);
    }
  }

  // ---- Common ----

  updatePlayer(player) {
    const pos = player.getPosition();
    this.playerDot.position.set(pos.x, pos.y, 0.05);

    this.camera.position.lerp(
      new THREE.Vector3(pos.x, pos.y, 100),
      0.1
    );
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
