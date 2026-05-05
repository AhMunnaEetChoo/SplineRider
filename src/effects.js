// Simple particle effects system using THREE.Points

import * as THREE from 'three';

const MAX_PARTICLES = 100;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Create circle texture
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8,
      color: '#ffffff',
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(position, count, config = {}) {
    const color = new THREE.Color(config.color || '#ffffff');
    const speed = config.speed || 100;
    const lifetime = config.lifetime || 0.5;

    for (let i = 0; i < count; i++) {
      const p = this._allocParticle();
      if (!p) break;

      const angle = (Math.random() * Math.PI * 2);
      const spd = speed * (0.5 + Math.random() * 0.5);
      p.position.set(position.x, position.y, 0.03);
      p.velocity.x = Math.cos(angle) * spd;
      p.velocity.y = Math.sin(angle) * spd;
      p.life = lifetime * (0.6 + Math.random() * 0.4);
      p.maxLife = p.life;
      p.color.copy(color);
    }
  }

  emitLaunch(position) {
    this.emit(position, 10, {
      color: '#ff9944',
      speed: 120,
      lifetime: 0.5,
    });
  }

  emitAttach(position) {
    this.emit(position, 6, {
      color: '#ffffff',
      speed: 60,
      lifetime: 0.3,
    });
  }

  emitDeath(position) {
    this.emit(position, 15, {
      color: '#ff4444',
      speed: 150,
      lifetime: 0.6,
    });
  }

  update(dt, playerState) {
    const posArr = this.points.geometry.attributes.position.array;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        // Return to pool
        posArr[i * 3] = 0;
        posArr[i * 3 + 1] = -9999;
        posArr[i * 3 + 2] = 0;
        this.particles.splice(i, 1);
        i--;
        continue;
      }

      p.velocity.y -= 200 * dt; // gravity
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;

      posArr[i * 3] = p.position.x;
      posArr[i * 3 + 1] = p.position.y;
      posArr[i * 3 + 2] = 0.03;

      // Fade based on life
      const alpha = p.life / p.maxLife;
      this.points.material.opacity = 0.6 * alpha;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  _allocParticle() {
    if (this.particles.length >= MAX_PARTICLES) return null;

    const p = {
      position: new THREE.Vector2(),
      velocity: new THREE.Vector2(),
      life: 0,
      maxLife: 0,
      color: new THREE.Color(),
    };
    this.particles.push(p);
    return p;
  }
}
