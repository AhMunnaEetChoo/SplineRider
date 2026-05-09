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

    // Callbacks (set by main.js)
    this.onWin = null;
    this.onDeath = null;
    this.onStateChange = null;
    this.onReset = null;

    this.loadLevel(levelData || DEFAULT_LEVEL);
  }

  loadLevel(levelData) {
    this.levelData = levelData;
    this.splines = _deserializeSplines(levelData.splines);
    this.goalPosition = new THREE.Vector2(
      levelData.goalPosition.x, levelData.goalPosition.y
    );

    const startIdx = Math.min(levelData.startSplineIndex || 0, this.splines.length - 1);
    this.player = new Player(this.splines[startIdx]);
    this.player.t = levelData.startT || 0;

    this.elapsedTime = 0;
    this._lastState = this.player.state;
    this._deathFired = false;
  }

  update(deltaTime, input) {
    // Reset
    if (input.consumeJustPressed('r')) {
      this.loadLevel(this.levelData);
      if (this.onReset) this.onReset();
      return;
    }

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
