export class Input {
  constructor() {
    this.keys = {};
    this.justPressed = {};

    this._onKeyDown = (e) => {
      if (!this.keys[e.key]) {
        this.justPressed[e.key] = true;
      }
      this.keys[e.key] = true;
      e.preventDefault();
    };

    this._onKeyUp = (e) => {
      this.keys[e.key] = false;
      e.preventDefault();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  isDown(key) {
    return !!this.keys[key];
  }

  consumeJustPressed(key) {
    if (this.justPressed[key]) {
      this.justPressed[key] = false;
      return true;
    }
    return false;
  }

  // After each frame, clear just-pressed state
  endFrame() {
    for (const k of Object.keys(this.justPressed)) {
      this.justPressed[k] = false;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
