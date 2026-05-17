import * as THREE from 'three';
import { Spline } from './spline.js';
import { Player, State } from './player.js';
import { DEFAULT_LEVEL } from './levels.js';

const WIN_RADIUS = 40;

function _deserializeSplines(splineDataArray) {
  return splineDataArray.map(s => new Spline(
    s.points.map(p => new THREE.Vector2(p.x, p.y))
  ));
}

export class Game {
  constructor(levelData) {
    this.elapsedTime = 0;
    this._lastState = null;
    this._deathFired = false;
    this.gamePhase = 'prebuffer';  // 'prebuffer' | 'ready' | 'playing'
    this._phaseTimer = 0;

    // Callbacks (set by main.js)
    this.onWin = null;
    this.onDeath = null;
    this.onStateChange = null;
    this.onReset = null;
    this.onPhaseChange = null;

    this.loadLevel(levelData || DEFAULT_LEVEL);
  }

  loadLevel(levelData) {
    this.levelData = levelData;
    this.splines = _deserializeSplines(levelData.splines);
    this.goalPosition = new THREE.Vector2(
      levelData.goalPosition.x, levelData.goalPosition.y
    );

    this.player = new Player(this.splines[0]);
    this.player.state = State.FREE_FLIGHT;
    const sp = levelData.startPosition || this.splines[0].pointAt(0);
    this.player.position.set(sp.x, sp.y);
    this.player.velocity.set(0, 0);

    this.elapsedTime = 0;
    this._lastState = this.player.state;
    this._deathFired = false;
    this.gamePhase = 'prebuffer';
    this._phaseTimer = 0;
  }

  update(deltaTime, input) {
    // Reset (works in all phases)
    if (input.consumeJustPressed('r')) {
      this.loadLevel(this.levelData);
      if (this.onReset) this.onReset();
      return;
    }

    // Phase machine — gate gameplay behind prebuffer/ready
    if (this.gamePhase === 'prebuffer') {
      this._phaseTimer += deltaTime;
      if (this._phaseTimer >= 0.5) {
        this.gamePhase = 'ready';
        if (this.onPhaseChange) this.onPhaseChange('ready');
      }
      return;
    }

    if (this.gamePhase === 'ready') {
      if (input.isDown('hold')) {
        this.gamePhase = 'playing';
        if (this.onPhaseChange) this.onPhaseChange('go');
      }
      return;
    }

    // ---- Gameplay (gamePhase === 'playing') ----

    this.player.update(deltaTime, input, this.splines);

    // Detect state changes
    const prevState = this._lastState;
    this._lastState = this.player.state;
    if (prevState !== this.player.state && this.onStateChange) {
      this.onStateChange(this.player.state);
    }

    // Timer: accumulate only during active gameplay
    if (this.player.state !== State.DEAD && this.player.state !== State.WIN) {
      this.elapsedTime += deltaTime;
    }

    // Win detection
    if (this.player.state !== State.DEAD && this.player.state !== State.WIN) {
      const dist = this.player.getPosition().distanceTo(this.goalPosition);
      if (dist < WIN_RADIUS) {
        this.player.state = State.WIN;
        if (this.onWin) this.onWin(this.elapsedTime);
      }
    }

    // Death detection
    if (this.player.state === State.DEAD && !this._deathFired) {
      this._deathFired = true;
      if (this.onDeath) this.onDeath();
    }
  }
}
