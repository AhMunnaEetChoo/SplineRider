import * as THREE from 'three';
import { Spline } from './spline.js';
import { Player, State } from './player.js';

const LEVEL_SPLINES = [
  // Main connected track
  new Spline(
    new THREE.Vector2(-500, 200),
    new THREE.Vector2(-300, 200),
    new THREE.Vector2(-100, -300),
    new THREE.Vector2(0, -100)
  ),
  new Spline(
    new THREE.Vector2(0, -100),
    new THREE.Vector2(100, 50),
    new THREE.Vector2(200, 300),
    new THREE.Vector2(300, 250)
  ),
  new Spline(
    new THREE.Vector2(300, 250),
    new THREE.Vector2(400, 200),
    new THREE.Vector2(500, -150),
    new THREE.Vector2(600, -200)    // Goal at end of this spline
  ),
  // Disconnected splines for testing jump-between-splines
  new Spline(
    new THREE.Vector2(450, 150),
    new THREE.Vector2(480, 150),
    new THREE.Vector2(520, 150),
    new THREE.Vector2(550, 150)
  ),
  new Spline(
    new THREE.Vector2(700, -300),
    new THREE.Vector2(750, -350),
    new THREE.Vector2(850, -350),
    new THREE.Vector2(900, -300)
  ),
  new Spline(
    new THREE.Vector2(100, 350),
    new THREE.Vector2(150, 400),
    new THREE.Vector2(250, 400),
    new THREE.Vector2(300, 350)
  ),
];

const GOAL_SPLINE_INDEX = 2;

export class Game {
  constructor() {
    this.splines = LEVEL_SPLINES;
    this.player = new Player(this.splines[0]);
    this.goalPosition = this.splines[GOAL_SPLINE_INDEX].pointAt(1);
    this.elapsedTime = 0;
  }

  update(deltaTime, input) {
    // Reset
    if (input.consumeJustPressed('r')) {
      this.player.reset(this.splines[0]);
      this.elapsedTime = 0;
      document.getElementById('win-message').style.display = 'none';
    }

    this.player.update(deltaTime, input, this.splines);

    // Timer: accumulate only during active gameplay
    if (this.player.state !== State.DEAD && this.player.state !== State.WIN) {
      this.elapsedTime += deltaTime;
    }

    // Win detection
    if (this.player.state !== State.DEAD && this.player.state !== State.WIN) {
      const dist = this.player.getPosition().distanceTo(this.goalPosition);
      if (dist < 40) {
        this.player.state = State.WIN;
        document.getElementById('win-message').style.display = 'block';
      }
    }

    // Update UI
    document.getElementById('timer').textContent =
      `Time: ${this.elapsedTime.toFixed(2)}s`;
    document.getElementById('speed').textContent =
      `Speed: ${Math.abs(this.player.getSpeed()).toFixed(0)}`;
    document.getElementById('state').textContent =
      `State: ${this.player.getState()}`;

    if (this.player.state === State.DEAD) {
      document.getElementById('state').textContent = 'State: DEAD (press R)';
    }
    if (this.player.state === State.WIN) {
      document.getElementById('state').textContent = 'State: WIN!';
    }
  }
}
