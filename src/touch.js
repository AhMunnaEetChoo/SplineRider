// Touch/mouse input provider — same interface as input.js (isDown, endFrame,
// consumeJustPressed). Tracks screen-wide hold via mouse events (window) and
// canvas-scoped touch events so overlay UI buttons still receive click events.

export class TouchInput {
  constructor(canvas) {
    this._canvas = canvas;
    this._keys = {};
    this._justPressed = {};

    this._onMouseDown = () => { this._keys['touchHold'] = true; };
    this._onMouseUp = () => { this._keys['touchHold'] = false; };
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    if (this._isMobile() && this._canvas) {
      // Tap detection state
      this._tapStartX = 0;
      this._tapStartY = 0;
      this._tapTimer = 0;

      this._onTouchStart = (e) => {
        e.preventDefault();
        this._keys['touchHold'] = true;
        if (e.touches.length === 1) {
          this._tapStartX = e.touches[0].clientX;
          this._tapStartY = e.touches[0].clientY;
          this._tapTimer = performance.now();
        }
      };
      this._onTouchEnd = (e) => {
        this._keys['touchHold'] = false;
        if (this._tapTimer && e.changedTouches.length === 1) {
          const elapsed = performance.now() - this._tapTimer;
          const dx = e.changedTouches[0].clientX - this._tapStartX;
          const dy = e.changedTouches[0].clientY - this._tapStartY;
          if (elapsed < 300 && Math.sqrt(dx * dx + dy * dy) < 20) {
            this._justPressed['tap'] = true;
          }
        }
        this._tapTimer = 0;
      };
      this._onTouchCancel = () => {
        this._keys['touchHold'] = false;
        this._tapTimer = 0;
      };
      this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      this._canvas.addEventListener('touchend', this._onTouchEnd);
      this._canvas.addEventListener('touchcancel', this._onTouchCancel);
    }
  }

  _isMobile() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  isDown(key) {
    return !!this._keys[key];
  }

  consumeJustPressed(key) {
    if (this._justPressed[key]) {
      this._justPressed[key] = false;
      return true;
    }
    return false;
  }

  endFrame() {
    for (const k of Object.keys(this._justPressed)) {
      this._justPressed[k] = false;
    }
  }

  destroy() {
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    if (this._onTouchStart && this._canvas) {
      this._canvas.removeEventListener('touchstart', this._onTouchStart);
      this._canvas.removeEventListener('touchend', this._onTouchEnd);
      this._canvas.removeEventListener('touchcancel', this._onTouchCancel);
    }
  }
}
