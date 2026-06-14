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
    this.onPhaseChange = null;

    this.loadLevel(levelData || DEFAULT_LEVEL);
  }

  _syncRenderSnapshots() {
    const snapshot = this.player.getRenderSnapshot();
    this._previousPlayerSnapshot = this._clonePlayerSnapshot(snapshot);
    this._currentPlayerSnapshot = this._clonePlayerSnapshot(snapshot);
  }

  _clonePlayerSnapshot(snapshot) {
    return {
      position: snapshot.position.clone(),
      state: snapshot.state,
      spline: snapshot.spline,
      t: snapshot.t,
      offset: snapshot.offset.clone(),
    };
  }

  loadLevel(levelData) {
    this.levelData = levelData;
    this.splines = _deserializeSplines(levelData.splines);
    this.goalPosition = new THREE.Vector2(
      levelData.goalPosition.x, levelData.goalPosition.y
    );

    // Handle levels with 0 splines — create a dummy spline for the Player constructor
    const primarySpline = this.splines.length > 0
      ? this.splines[0]
      : new Spline([new THREE.Vector2(0, 0), new THREE.Vector2(1, 0)]);
    this.player = new Player(primarySpline);
    this.player.state = State.FREE_FLIGHT;
    const sp = levelData.startPosition || (this.splines.length > 0 ? this.splines[0].pointAt(0) : { x: 0, y: 0 });
    this.player.position.set(sp.x, sp.y);
    this.player.velocity.set(0, 0);

    this.elapsedTime = 0;
    this._lastState = this.player.state;
    this._deathFired = false;
    this.gamePhase = 'prebuffer';
    this._phaseTimer = 0;
    this._syncRenderSnapshots();
  }

  getInterpolatedPlayerSnapshot(alpha) {
    if (!this._previousPlayerSnapshot || !this._currentPlayerSnapshot) {
      return this.player.getRenderSnapshot();
    }

    const previous = this._previousPlayerSnapshot;
    const current = this._currentPlayerSnapshot;
    const canInterpolate = previous.state === current.state && previous.spline === current.spline;

    if (!canInterpolate) {
      return this._clonePlayerSnapshot(current);
    }

    const a = Math.max(0, Math.min(1, alpha));

    // While riding, interpolate the decomposed state (foot t + spring offset) and
    // rebuild position from it, so the ball and the ribbon connection-bump (which
    // both read t/offset) stay in exact lockstep.
    if (current.state === State.RIDING) {
      const t = previous.t + (current.t - previous.t) * a;
      const offset = previous.offset.clone().lerp(current.offset, a);
      const position = current.spline.pointAt(Math.max(0, Math.min(1, t))).add(offset);
      return { position, state: current.state, spline: current.spline, t, offset };
    }

    return {
      position: previous.position.clone().lerp(current.position, a),
      state: current.state,
      spline: current.spline,
      t: current.t,
      offset: current.offset.clone(),
    };
  }

  update(deltaTime, input) {
    // Reset (works in all phases)
    if (input.consumeJustPressed('r')) {
      this.loadLevel(this.levelData);
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

    this._previousPlayerSnapshot = this._clonePlayerSnapshot(this._currentPlayerSnapshot);
    this.player.update(deltaTime, input, this.splines);
    this._currentPlayerSnapshot = this.player.getRenderSnapshot();

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
        // Freeze at the win point (spring offset included) before leaving RIDING
        this.player.position.copy(this.player.getPosition());
        this.player.state = State.WIN;
        this._currentPlayerSnapshot = this.player.getRenderSnapshot();
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
