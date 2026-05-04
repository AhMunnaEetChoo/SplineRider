import * as THREE from 'three';

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

    // Spline line objects
    this.splineLines = new THREE.Group();
    this.scene.add(this.splineLines);

    // Player dot
    const dotGeo = new THREE.CircleGeometry(12, 32);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#ff6b6b' });
    this.playerDot = new THREE.Mesh(dotGeo, dotMat);
    this.scene.add(this.playerDot);

    // Start/goal markers
    this.startMarker = null;
    this.goalMarker = null;

    // Controls hint text
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

  updateSplines(splines, goalPosition) {
    // Clear old lines
    while (this.splineLines.children.length > 0) {
      const child = this.splineLines.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.splineLines.remove(child);
    }

    // Remove old markers
    if (this.startMarker) {
      this.scene.remove(this.startMarker);
    }
    if (this.goalMarker) {
      this.scene.remove(this.goalMarker);
    }

    // Merge all splines into a single continuous line to avoid visible
    // endpoint vertices at spline junctions
    const allVerts = [];
    for (let i = 0; i < splines.length; i++) {
      const sampled = splines[i].samplePoints(64);
      const startIdx = (i > 0) ? 1 : 0; // skip first point to avoid duplicate at junction
      for (let j = startIdx; j < sampled.length; j++) {
        allVerts.push(sampled[j].x, sampled[j].y, 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#4ecdc4' });
    const line = new THREE.Line(geo, mat);
    this.splineLines.add(line);

    if (splines.length > 0) {
      // Start marker (green)
      const startPos = splines[0].pointAt(0);
      const startGeo = new THREE.CircleGeometry(10, 32);
      const startMat = new THREE.MeshBasicMaterial({ color: '#4ecdc4' });
      this.startMarker = new THREE.Mesh(startGeo, startMat);
      this.startMarker.position.set(startPos.x, startPos.y, 0.02);
      this.scene.add(this.startMarker);

      // Goal marker (yellow) at specified goal position
      const endPos = goalPosition || splines[splines.length - 1].pointAt(1);
      const goalGeo = new THREE.RingGeometry(8, 14, 32);
      const goalMat = new THREE.MeshBasicMaterial({ color: '#ffe66d', side: THREE.DoubleSide });
      this.goalMarker = new THREE.Mesh(goalGeo, goalMat);
      this.goalMarker.position.set(endPos.x, endPos.y, 0.02);
      this.scene.add(this.goalMarker);
    }
  }

  updatePlayer(player) {
    const pos = player.getPosition();
    this.playerDot.position.set(pos.x, pos.y, 0.05);

    // Camera follows player (orthographic — move position, keep looking down)
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
