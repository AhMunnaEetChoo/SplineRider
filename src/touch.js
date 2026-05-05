// Touch input provider — same interface as input.js (isDown, endFrame).
// Creates DOM buttons at screen bottom on mobile.

export class TouchInput {
  constructor() {
    this._keys = {};
    this._container = null;

    // Only show on touch-capable devices
    if (this._isMobile()) {
      this._buildUI();
    } else {
      // Empty implementation for desktop
      this.isDown = () => false;
      this.endFrame = () => {};
    }
  }

  _isMobile() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  _buildUI() {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    container.style.cssText = `
      position:absolute; bottom:24px; left:0; width:100%;
      display:flex; justify-content:space-between; align-items:flex-end;
      padding:0 24px; pointer-events:none; z-index:5;
    `;

    // Left button
    const leftBtn = this._makeButton('◀', '60px', 'left');
    leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this._keys['touchLeft'] = true; });
    leftBtn.addEventListener('touchend', () => { this._keys['touchLeft'] = false; });
    leftBtn.addEventListener('mousedown', () => { this._keys['touchLeft'] = true; });
    leftBtn.addEventListener('mouseup', () => { this._keys['touchLeft'] = false; });
    leftBtn.addEventListener('mouseleave', () => { this._keys['touchLeft'] = false; });

    // Right button
    const rightBtn = this._makeButton('▶', '60px', 'right');
    rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this._keys['touchRight'] = true; });
    rightBtn.addEventListener('touchend', () => { this._keys['touchRight'] = false; });
    rightBtn.addEventListener('mousedown', () => { this._keys['touchRight'] = true; });
    rightBtn.addEventListener('mouseup', () => { this._keys['touchRight'] = false; });
    rightBtn.addEventListener('mouseleave', () => { this._keys['touchRight'] = false; });

    // Launch button (center, triggers both)
    const launchBtn = this._makeButton('▲', '48px', 'launch');
    launchBtn.style.alignSelf = 'center';
    launchBtn.style.marginBottom = '8px';
    launchBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._keys['touchLeft'] = true;
      this._keys['touchRight'] = true;
    });
    launchBtn.addEventListener('touchend', () => {
      this._keys['touchLeft'] = false;
      this._keys['touchRight'] = false;
    });
    launchBtn.addEventListener('mousedown', () => {
      this._keys['touchLeft'] = true;
      this._keys['touchRight'] = true;
    });
    launchBtn.addEventListener('mouseup', () => {
      this._keys['touchLeft'] = false;
      this._keys['touchRight'] = false;
    });
    launchBtn.addEventListener('mouseleave', () => {
      this._keys['touchLeft'] = false;
      this._keys['touchRight'] = false;
    });

    container.appendChild(leftBtn);
    container.appendChild(launchBtn);
    container.appendChild(rightBtn);
    document.body.appendChild(container);
    this._container = container;
  }

  _makeButton(label, size, align) {
    const btn = document.createElement('div');
    btn.textContent = label;
    btn.style.cssText = `
      width:${size}; height:${size}; border-radius:50%;
      background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25);
      color:rgba(255,255,255,0.7); font-size:20px;
      display:flex; align-items:center; justify-content:center;
      pointer-events:all; user-select:none; -webkit-user-select:none;
      touch-action:none;
    `;
    return btn;
  }

  isDown(key) {
    return !!this._keys[key];
  }

  endFrame() {
    // Touch state is managed by event listeners, no per-frame clearing needed
  }
}
