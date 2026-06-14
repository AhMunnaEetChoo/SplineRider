import * as THREE from 'three';
import { Spline } from './spline.js';
import { Colors } from './colors.js';

export class Renderer {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Colors.bg);

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
    const dotMat = new THREE.MeshBasicMaterial({ color: Colors.warn });
    this.playerDot = new THREE.Mesh(dotGeo, dotMat);
    this.scene.add(this.playerDot);

    // Player glow (visible when riding)
    const glowGeo = new THREE.CircleGeometry(20, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: Colors.warn,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.playerGlow = new THREE.Mesh(glowGeo, glowMat);
    this.playerGlow.visible = false;
    this.scene.add(this.playerGlow);

    // Markers
    this.startMarker = null;
    this.goalMarker = null;

    // Editor state
    this._editorSplineLines = [];
    this._editorSplineDots = [];
    this._editorSelectedIndex = -1;
  }

  // ---- Game View ----

  showGameView(splines, goalPosition, startPosition) {
    if (this.editorViewGroup.parent) {
      this.scene.remove(this.editorViewGroup);
    }
    if (!this.gameViewGroup.parent) {
      this.scene.add(this.gameViewGroup);
    }
    this._clearGameView();
    this._buildGameView(splines, goalPosition, startPosition);
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

  _buildGameView(splines, goalPosition, startPosition) {
    const mat = new THREE.MeshBasicMaterial({ color: Colors.accent });
    for (const spline of splines) {
      const geo = spline.createTubeGeometry();
      const mesh = new THREE.Mesh(geo, mat);
      this.gameViewGroup.add(mesh);
    }

    if (startPosition || goalPosition) {
      const startPos = startPosition
        ? new THREE.Vector2(startPosition.x, startPosition.y)
        : (splines.length > 0 ? splines[0].pointAt(0) : new THREE.Vector2(0, 0));
      const startGeo = new THREE.CircleGeometry(10, 32);
      const startMat = new THREE.MeshBasicMaterial({ color: Colors.accent });
      this.startMarker = new THREE.Mesh(startGeo, startMat);
      this.startMarker.position.set(startPos.x, startPos.y, 10);
      this.scene.add(this.startMarker);

      const endPos = goalPosition
        ? new THREE.Vector2(goalPosition.x, goalPosition.y)
        : (splines.length > 0 ? splines[splines.length - 1].pointAt(1) : new THREE.Vector2(0, 0));
      const goalGeo = new THREE.RingGeometry(30, 36, 32);
      const goalMat = new THREE.MeshBasicMaterial({ color: Colors.highlight, side: THREE.DoubleSide });
      this.goalMarker = new THREE.Mesh(goalGeo, goalMat);
      this.goalMarker.position.set(endPos.x, endPos.y, 10);
      this.scene.add(this.goalMarker);
    }
  }

  // ---- Editor View ----

  showEditorView(splinesData, startPosition, goalPos) {
    if (this.gameViewGroup.parent) {
      this.scene.remove(this.gameViewGroup);
    }
    if (!this.editorViewGroup.parent) {
      this.scene.add(this.editorViewGroup);
    }
    this._clearEditorView();
    this._buildEditorView(splinesData, startPosition, goalPos);
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

  _buildEditorView(splinesData, startPosition, goalPos) {
    const tubeMat = new THREE.MeshBasicMaterial({ color: Colors.accent });
    const dotMat = new THREE.MeshBasicMaterial({ color: Colors.accent });

    for (let i = 0; i < splinesData.length; i++) {
      const s = splinesData[i];
      const spline = new Spline(s.points.map(p => new THREE.Vector2(p.x, p.y)));

      // Tube mesh
      const geo = spline.createTubeGeometry();
      const mesh = new THREE.Mesh(geo, tubeMat.clone());
      this.editorViewGroup.add(mesh);
      this._editorSplineLines.push({ spline, mesh });

      // Knot dots
      const dots = [];
      for (const p of s.points) {
        const dotGeo = new THREE.CircleGeometry(6, 16);
        const dot = new THREE.Mesh(dotGeo, dotMat.clone());
        dot.position.set(p.x, p.y, 10);
        this.editorViewGroup.add(dot);
        dots.push(dot);
      }
      this._editorSplineDots.push(dots);
    }

    // Start marker
    const startGeo = new THREE.CircleGeometry(10, 32);
    const startMat = new THREE.MeshBasicMaterial({ color: Colors.accent });
    this.startMarker = new THREE.Mesh(startGeo, startMat);
    this.startMarker.position.set(startPosition.x, startPosition.y, 10);
    this.scene.add(this.startMarker);

    // Goal marker
    const goalGeo = new THREE.RingGeometry(30, 36, 32);
    const goalMat = new THREE.MeshBasicMaterial({ color: Colors.highlight, side: THREE.DoubleSide });
    this.goalMarker = new THREE.Mesh(goalGeo, goalMat);
    this.goalMarker.position.set(goalPos.x, goalPos.y, 10);
    this.scene.add(this.goalMarker);
  }

  updateEditorSplineGeometry(index, splineData) {
    if (index < 0 || index >= this._editorSplineLines.length) return;

    const entry = this._editorSplineLines[index];
    const s = splineData;

    // Rebuild the Spline instance from points
    entry.spline = new Spline(s.points.map(p => new THREE.Vector2(p.x, p.y)));

    // Rebuild tube mesh
    const isHighlighted = (index === this._editorSelectedIndex);
    const color = isHighlighted ? Colors.highlight : Colors.accent;
    const oldMesh = entry.mesh;
    const newGeo = entry.spline.createTubeGeometry();
    const newMesh = new THREE.Mesh(newGeo, new THREE.MeshBasicMaterial({ color }));
    newMesh.position.copy(oldMesh.position);
    this.editorViewGroup.add(newMesh);
    this.editorViewGroup.remove(oldMesh);
    if (oldMesh.geometry) oldMesh.geometry.dispose();
    if (oldMesh.material) oldMesh.material.dispose();
    entry.mesh = newMesh;

    // Update knot dots — rebuild if count changed
    let dots = this._editorSplineDots[index];
    if (!dots || dots.length !== s.points.length) {
      if (dots) {
        for (const dot of dots) {
          dot.geometry.dispose();
          dot.material.dispose();
          this.editorViewGroup.remove(dot);
        }
      }
      dots = [];
      const isHighlighted = (index === this._editorSelectedIndex);
      const color = isHighlighted ? Colors.highlight : Colors.accent;
      const dotMat = new THREE.MeshBasicMaterial({ color });
      for (let pi = 0; pi < s.points.length; pi++) {
        const dotGeo = new THREE.CircleGeometry(6, 16);
        const dot = new THREE.Mesh(dotGeo, dotMat.clone());
        this.editorViewGroup.add(dot);
        dots.push(dot);
      }
      this._editorSplineDots[index] = dots;
    }

    for (let pi = 0; pi < s.points.length; pi++) {
      const pt = s.points[pi];
      dots[pi].position.set(pt.x, pt.y, 10);
    }
  }

  setEditorSplineHighlight(index) {
    if (index === this._editorSelectedIndex) return;
    this._editorSelectedIndex = index;

    const defaultColor = Colors.accent;
    const highlightColor = Colors.highlight;

    for (let i = 0; i < this._editorSplineLines.length; i++) {
      const color = (i === index) ? highlightColor : defaultColor;
      this._editorSplineLines[i].mesh.material.color.set(color);
    }

    for (let i = 0; i < this._editorSplineDots.length; i++) {
      const color = (i === index) ? highlightColor : defaultColor;
      for (const dot of this._editorSplineDots[i]) {
        dot.material.color.set(color);
      }
    }
  }

  setEditorKnotHighlight(splineIndex, pointIndex) {
    for (let i = 0; i < this._editorSplineDots.length; i++) {
      for (let pi = 0; pi < this._editorSplineDots[i].length; pi++) {
        const dot = this._editorSplineDots[i][pi];
        const isSelected = (i === splineIndex && pi === pointIndex);
        dot.scale.setScalar(isSelected ? 1.5 : 1.0);
      }
    }
  }

  updateEditorStartMarker(position) {
    if (this.startMarker) {
      this.startMarker.position.set(position.x, position.y, 10);
    }
  }

  updateEditorGoalMarker(position) {
    if (this.goalMarker) {
      this.goalMarker.position.set(position.x, position.y, 10);
    }
  }

  // ---- Common ----

  frameCamera(startPos, goalPos) {
    const midX = (startPos.x + goalPos.x) / 2;
    const midY = (startPos.y + goalPos.y) / 2;
    this.camera.position.set(midX, midY, 100);
  }

  updatePlayer(player, isHolding = false, renderSnapshot = null) {
    const pos = renderSnapshot ? renderSnapshot.position : player.getPosition();
    const playerState = renderSnapshot ? renderSnapshot.state : player.getState();
    this.playerDot.position.set(pos.x, pos.y, 10);

    if (this.playerGlow) {
      this.playerGlow.position.set(pos.x, pos.y, 10);
      const riding = (playerState === 'riding');
      const seeking = !riding && isHolding && (playerState === 'freeFlight');
      this.playerGlow.visible = riding || seeking;
      this.playerGlow.material.opacity = seeking ? 0.15 : 0.35;
    }

    this.camera.position.lerp(
      new THREE.Vector3(pos.x, pos.y, 100),
      0.3
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
