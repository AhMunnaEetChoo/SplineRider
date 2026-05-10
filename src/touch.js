// Touch/mouse input provider — same interface as input.js (isDown, endFrame).
// Tracks screen-wide hold: mousedown/mouseup on desktop, touch events on mobile.

export class TouchInput {
  constructor() {
    this._keys = {};

    this._onMouseDown = () => { this._keys['touchHold'] = true; };
    this._onMouseUp = () => { this._keys['touchHold'] = false; };
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    if (this._isMobile()) {
      this._onTouchStart = (e) => {
        e.preventDefault();
        this._keys['touchHold'] = true;
      };
      this._onTouchEnd = (e) => {
        e.preventDefault();
        this._keys['touchHold'] = false;
      };
      this._onTouchCancel = () => {
        this._keys['touchHold'] = false;
      };
      window.addEventListener('touchstart', this._onTouchStart, { passive: false });
      window.addEventListener('touchend', this._onTouchEnd, { passive: false });
      window.addEventListener('touchcancel', this._onTouchCancel);
    }
  }

  _isMobile() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  isDown(key) {
    return !!this._keys[key];
  }

  endFrame() {
    // Event-driven state, no per-frame clearing needed
  }

  destroy() {
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    if (this._onTouchStart) {
      window.removeEventListener('touchstart', this._onTouchStart);
      window.removeEventListener('touchend', this._onTouchEnd);
      window.removeEventListener('touchcancel', this._onTouchCancel);
    }
  }
}
