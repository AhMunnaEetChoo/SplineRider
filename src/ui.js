// DOM screen manager. Creates all overlay elements dynamically.

import { Colors } from './colors.js';

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) Object.assign(e, attrs);
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

export class UIManager {
  constructor() {
    const C = Colors;
    this._overlayStyle = `position:absolute; top:0; left:0; width:100%; height:100%;`
      + ` display:none; flex-direction:column; justify-content:center; align-items:center;`
      + ` background:${C.rgba(C.bg, 0.93)}; color:${C.text}; font-family:monospace;`
      + ` pointer-events:all; z-index:10;`;

    this._buttonStyle = `padding:12px 32px; margin:6px; font-family:monospace; font-size:16px;`
      + ` color:${C.text}; background:${C.rgba(C.text, 0.1)};`
      + ` border:1px solid ${C.rgba(C.text, 0.3)};`
      + ` border-radius:4px; cursor:pointer; min-width:160px; text-align:center;`;

    this._titleStyle = `font-size:42px; margin-bottom:20px; color:${C.highlight};`
      + ` text-shadow:0 0 20px ${C.rgba(C.highlight, 0.27)};`;

    this._subtitleStyle = `font-size:22px; margin-bottom:30px; color:${C.text};`;

    this._tbStyle = `padding:6px 14px; font-family:monospace; font-size:13px;`
      + ` color:${C.text}; background:${C.rgba(C.text, 0.1)};`
      + ` border:1px solid ${C.rgba(C.text, 0.3)}; border-radius:4px; cursor:pointer;`;

    this._dimText = C.rgba(C.text, 0.5);
    this._dimTextDark = C.rgba(C.text, 0.4);

    this.screens = {};
    this._callbacks = {};
    this._overlayTimer = null;
    this._winTimer = null;
    this._buildScreens();
  }

  _btn(text, id) {
    return el('button', { id, style: this._buttonStyle, textContent: text });
  }

  _tbBtn(text, id) {
    return el('button', { id, textContent: text, style: this._tbStyle });
  }

  _buildScreens() {
    const C = Colors;

    // Start Screen
    this.screens.start = el('div', { id: 'screen-start', style: this._overlayStyle },
      el('div', { style: this._titleStyle }, 'Spline Rider'),
      el('div', { style: this._subtitleStyle }, 'Ride the curves. Reach the goal.'),
      this._btn('Play', 'btn-start-play'),
      this._btn('Editor', 'btn-start-editor'),
      this._btn('Levels', 'btn-start-levels'),
    );
    document.body.appendChild(this.screens.start);

    // Level Select Screen
    this.screens.levels = el('div', { id: 'screen-levels', style: this._overlayStyle },
      el('div', { style: this._subtitleStyle }, 'Select Level'),
      el('div', { id: 'level-list', style: 'max-height:50vh; overflow-y:auto; width:300px;' }),
      this._btn('Back', 'btn-levels-back'),
    );
    document.body.appendChild(this.screens.levels);

    // Win Screen
    this.screens.win = el('div', { id: 'screen-win', style: this._overlayStyle },
      el('div', { style: this._titleStyle }, 'You Win!'),
      el('div', { id: 'win-time', style: 'font-size:28px; margin-bottom:8px;' }),
      el('div', { id: 'win-best', style: `font-size:18px; color:${this._dimText}; margin-bottom:20px;` }),
      el('div', { id: 'win-next-buttons', style: 'display:none;' },
        this._btn('Next Level', 'btn-win-next'),
        this._btn('Level Select', 'btn-win-levels'),
      ),
    );
    document.body.appendChild(this.screens.win);

    // Death Screen
    this.screens.dead = el('div', { id: 'screen-dead', style: this._overlayStyle },
      el('div', { style: this._titleStyle }, 'Fell Off!'),
      this._btn('Try Again', 'btn-dead-retry'),
      this._btn('Menu', 'btn-dead-menu'),
    );
    document.body.appendChild(this.screens.dead);

    // Pause Screen
    this.screens.pause = el('div', { id: 'screen-pause', style: this._overlayStyle },
      el('div', { style: this._titleStyle }, 'Paused'),
      this._btn('Resume', 'btn-pause-resume'),
      this._btn('Restart', 'btn-pause-restart'),
      this._btn('Menu', 'btn-pause-menu'),
    );
    document.body.appendChild(this.screens.pause);

    // Editor Toolbar
    this.editorToolbar = el('div', {
      id: 'editor-toolbar',
      style: `display:none; position:absolute; top:8px; left:50%; transform:translateX(-50%);`
        + ` gap:6px; z-index:5; pointer-events:all;`
    },
      this._tbBtn('Pan', 'btn-toggle-mode'),
      this._tbBtn('- Spline', 'btn-delete-spline'),

      el('div', { style: 'position:relative; display:inline-flex;' },
        el('button', { id: 'btn-more-menu', textContent: '☰ More', style: this._tbStyle }),
        el('div', {
          id: 'editor-more-dropdown',
          style: `display:none; position:absolute; top:100%; right:0; margin-top:4px;`
            + ` flex-direction:column; gap:2px; background:${C.bgSecondary};`
            + ` border:1px solid ${C.rgba(C.text, 0.25)}; border-radius:4px; padding:4px; z-index:15;`
        },
          el('button', { id: 'btn-save-level', textContent: 'Save', style: this._tbStyle }),
          el('button', { id: 'btn-load-level', textContent: 'Load', style: this._tbStyle }),
          el('button', { id: 'btn-export-level', textContent: 'Export', style: this._tbStyle }),
          el('button', { id: 'btn-import-level', textContent: 'Import', style: this._tbStyle }),
        )
      ),

      this._tbBtn('Test', 'btn-test-level'),
      this._tbBtn('Back', 'btn-editor-back'),
    );
    document.body.appendChild(this.editorToolbar);
    document.getElementById('btn-delete-spline').disabled = true;

    // Dropdown toggle + outside-click close
    const moreBtn = document.getElementById('btn-more-menu');
    const dropdown = document.getElementById('editor-more-dropdown');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
    });
    dropdown.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') dropdown.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
      if (!moreBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Import modal
    this._importModal = el('div', {
      style: `display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index:20; pointer-events:all;`
    },
      el('div', {
        style: `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);`
          + ` background:${C.bgSecondary}; padding:20px; border-radius:8px;`
          + ` border:1px solid ${C.rgba(C.text, 0.25)};`
      },
        el('div', { style: `color:${C.text}; font-family:monospace; margin-bottom:8px;` }, 'Paste level JSON:'),
        el('textarea', {
          id: 'import-textarea',
          style: `width:400px; height:200px; background:${C.bg}; color:${C.text};`
            + ` font-family:monospace; font-size:12px; border:1px solid ${C.rgba(C.text, 0.25)};`
            + ` padding:8px; resize:vertical;`
        }),
        el('div', { id: 'import-error', style: `color:${C.warn}; font-family:monospace; font-size:12px; margin-top:4px; display:none;` }),
        el('div', { style: 'display:flex; gap:8px; margin-top:8px; justify-content:flex-end;' },
          this._btn('Import', 'btn-import-confirm'),
          this._btn('Cancel', 'btn-import-cancel'),
        )
      )
    );
    document.body.appendChild(this._importModal);

    // Toast
    this._toast = el('div', {
      style: `display:none; position:absolute; bottom:40px; left:50%; transform:translateX(-50%);`
        + ` padding:8px 20px; background:${C.rgba(C.bg, 0.93)}; color:${C.accent};`
        + ` font-family:monospace; font-size:14px; border-radius:4px; z-index:30; pointer-events:none;`
    });
    document.body.appendChild(this._toast);
    this._toastTimer = null;

    // Ready / Go overlays
    this._readyOverlay = el('div', {
      style: `display:none; position:absolute; top:45%; left:50%; transform:translate(-50%,-50%);`
        + ` color:${C.text}; font-family:monospace; font-size:36px;`
        + ` pointer-events:none; z-index:12;`
    }, 'Ready!');
    document.body.appendChild(this._readyOverlay);

    this._goOverlay = el('div', {
      style: `display:none; position:absolute; top:45%; left:50%; transform:translate(-50%,-50%);`
        + ` color:${C.highlight}; font-family:monospace; font-size:48px;`
        + ` pointer-events:none; z-index:12;`
        + ` text-shadow:0 0 20px ${C.rgba(C.highlight, 0.42)};`
    }, 'Go!');
    document.body.appendChild(this._goOverlay);

    // Mobile pause button
    this.pauseBtn = el('button', {
      id: 'btn-mobile-pause',
      textContent: '❚❚',
      style: `display:none; position:absolute; top:16px; right:16px; width:42px; height:42px;`
        + ` z-index:15; pointer-events:all; border-radius:50%;`
        + ` border:2px solid ${C.rgba(C.text, 0.4)};`
        + ` background:${C.rgba(C.bg, 0.35)}; color:${C.text}; font-size:18px;`
        + ` line-height:1; cursor:pointer;`
    });
    document.body.appendChild(this.pauseBtn);
  }

  on(buttonId, callback) {
    this._callbacks[buttonId] = callback;
    const b = document.getElementById(buttonId);
    if (b) {
      b.addEventListener('click', callback);
    }
  }

  showOverlay(type) {
    this._readyOverlay.style.display = 'none';
    this._goOverlay.style.display = 'none';
    if (this._overlayTimer) { clearTimeout(this._overlayTimer); this._overlayTimer = null; }

    if (type === 'ready') {
      this._readyOverlay.style.display = 'block';
    } else if (type === 'go') {
      this._goOverlay.style.display = 'block';
      this._overlayTimer = setTimeout(() => {
        this._goOverlay.style.display = 'none';
        this._overlayTimer = null;
      }, 300);
    }
  }

  showScreen(id, data) {
    this.showOverlay('hide');
    for (const key of Object.keys(this.screens)) {
      this.screens[key].style.display = 'none';
    }
    this.editorToolbar.style.display = 'none';
    this.pauseBtn.style.display = 'none';

    if (id === 'editor') {
      this.editorToolbar.style.display = 'flex';
    } else if (id === 'play') {
      this.pauseBtn.style.display = 'block';
    } else if (this.screens[id]) {
      this.screens[id].style.display = 'flex';
    }

    if (id === 'win' && data) {
      document.getElementById('win-time').textContent = `Time: ${data.time.toFixed(2)}s`;
      if (data.bestTime !== null) {
        document.getElementById('win-best').textContent = data.isNewBest
          ? 'New Best!'
          : `Best: ${data.bestTime.toFixed(2)}s`;
      } else {
        document.getElementById('win-best').textContent = '';
      }

      const nextDiv = document.getElementById('win-next-buttons');
      nextDiv.style.display = 'none';
      if (data.showNextButtons) {
        const nextBtn = document.getElementById('btn-win-next');
        nextBtn.style.display = data.hasNextLevel ? '' : 'none';
        if (this._winTimer) clearTimeout(this._winTimer);
        this._winTimer = setTimeout(() => {
          nextDiv.style.display = '';
          this._winTimer = null;
        }, 1500);
      }
    }

    if (id === 'levels') {
      this._populateLevelList(data);
    }
  }

  _populateLevelList(data) {
    const list = document.getElementById('level-list');
    list.innerHTML = '';

    const levels = data.levels || [];
    const onSelect = data.onSelect;
    const onDelete = data.onDelete;
    const nextIndex = data.nextIndex;
    const isLevelCompleted = data.isLevelCompleted || (() => false);

    if (levels.length === 0) {
      list.appendChild(el('div', { style: `color:${this._dimText}; padding:10px;` }, 'No levels found.'));
      return;
    }

    const C = Colors;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const completed = isLevelCompleted(level.name);
      const isBuiltIn = level.builtIn;
      const locked = isBuiltIn && !completed && nextIndex !== undefined && i !== nextIndex;

      const row = el('div', {
        style: `display:flex; justify-content:space-between; align-items:center; padding:10px; margin:4px 0;`
          + ` background:${C.rgba(C.text, 0.05)}; border-radius:4px;`
          + (locked
            ? ` opacity:0.35; pointer-events:none;`
            : ' cursor:pointer;'),
      });

      let nameText = level.name + (level.builtIn ? ' (built-in)' : '');
      if (completed) nameText = '✓ ' + nameText;

      const info = el('div', {},
        el('div', { style: `font-size:16px; color:${completed ? C.highlight : C.text};` }, nameText),
        level.bestTime !== undefined && level.bestTime !== null
          ? el('div', { style: `font-size:12px; color:${this._dimText};` }, `Best: ${level.bestTime.toFixed(2)}s`)
          : el('div', { style: `font-size:12px; color:${locked ? this._dimTextDark : this._dimText};` }, locked ? 'Locked' : 'No time yet'),
      );

      row.appendChild(info);
      if (!locked) {
        row.addEventListener('click', () => onSelect && onSelect(level));
      }

      if (!level.builtIn) {
        const delBtn = el('button', {
          style: `padding:4px 8px; font-size:12px; background:${C.rgba(C.warn, 0.2)};`
            + ` color:${C.warn}; border:1px solid ${C.rgba(C.warn, 0.3)};`
            + ` border-radius:3px; cursor:pointer;`,
          textContent: 'X',
        });
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onDelete && onDelete(level.name);
        });
        row.appendChild(delBtn);
      }

      list.appendChild(row);
    }
  }

  showImportModal(onConfirm) {
    this._importModal.style.display = 'block';
    document.getElementById('import-textarea').value = '';
    document.getElementById('import-error').style.display = 'none';

    const confirmBtn = document.getElementById('btn-import-confirm');
    const cancelBtn = document.getElementById('btn-import-cancel');
    const newConfirm = () => {
      const text = document.getElementById('import-textarea').value;
      const errEl = document.getElementById('import-error');
      try {
        onConfirm(text);
        this._importModal.style.display = 'none';
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      }
    };
    const newCancel = () => { this._importModal.style.display = 'none'; };

    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    document.getElementById('btn-import-confirm').addEventListener('click', newConfirm);
    document.getElementById('btn-import-cancel').addEventListener('click', newCancel);
  }

  showToast(message) {
    this._toast.textContent = message;
    this._toast.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast.style.display = 'none';
    }, 2000);
  }

  promptForName(defaultName, callback) {
    const name = prompt('Level name:', defaultName);
    if (name && name.trim()) {
      callback(name.trim());
    }
  }

  setDeleteEnabled(enabled) {
    const btn = document.getElementById('btn-delete-spline');
    if (btn) btn.disabled = !enabled;
  }

  setModeLabel(mode) {
    const btn = document.getElementById('btn-toggle-mode');
    if (btn) btn.textContent = (mode === 'draw') ? 'Pan' : 'Draw';
  }

  updateHUD() {
    // HUD is updated in main.js tick
  }
}
