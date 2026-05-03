import * as THREE from 'three';
import { Spline } from './spline.js';
import { Player, State } from './player.js';

const LEVEL_SPLINES = [
  // A roller-coaster style track: drops, climbs, loops
  new Spline(
    new THREE.Vector2(-500, 200),   // Start high left
    new THREE.Vector2(-300, 200),
    new THREE.Vector2(-100, -300),  // Drop
    new THREE.Vector2(0, -100)
  ),
  new Spline(
    new THREE.Vector2(0, -100),     // Continue from valley
    new THREE.Vector2(100, 50),
    new THREE.Vector2(200, 300),    // Climb
    new THREE.Vector2(300, 250)
  ),
  new Spline(
    new THREE.Vector2(300, 250),    // Descend
    new THREE.Vector2(400, 200),
    new THREE.Vector2(500, -150),
    new THREE.Vector2(600, -200)    // Goal area
  ),
];

export class Game {
  constructor() {
    this.splines = LEVEL_SPLINES;
    this.player = new Player(this.splines[0]);
  }

  update(deltaTime, input) {
    // Reset
    if (input.consumeJustPressed('r')) {
      this.player.reset(this.splines[0]);
    }

    this.player.update(deltaTime, input, this.splines);

    // Update UI
    document.getElementById('speed').textContent =
      `Speed: ${Math.abs(this.player.getSpeed()).toFixed(0)}`;
    document.getElementById('state').textContent =
      `State: ${this.player.getState()}`;

    if (this.player.state === State.DEAD) {
      document.getElementById('state').textContent = 'State: DEAD (press R)';
    }
  }
}
