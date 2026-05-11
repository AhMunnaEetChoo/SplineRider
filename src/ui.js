// DOM screen manager. Creates all overlay elements dynamically.

const OVERLAY_STYLE = `
  position:absolute; top:0; left:0; width:100%; height:100%;
  display:none; flex-direction:column; justify-content:center; align-items:center;
  background:rgba(26,26,46,0.93); color:#fff; font-family:monospace;
  pointer-events:all; z-index:10;
`;

const BUTTON_STYLE = `
  padding:12px 32px; margin:6px; font-family:monospace; font-size:16px;
  color:#fff; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3);
  border-radius:4px; cursor:pointer; min-width:160px; text-align:center;
`;

const TITLE_STYLE = 'font-size:42px; margin-bottom:20px; color:#ffe66d; text-shadow:0 0 20px #ffe66d44;';
const SUBTITLE_STYLE = 'font-size:22px; margin-bottom:30px; color:#fff;';

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) Object.assign(e, attrs);
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function btn(text, id) {
  return el('button', { id, style: BUTTON_STYLE, textContent: text });
}

export class UIManager {
  constructor() {
    this.screens = {};
    this._callbacks = {};
    this._buildScreens();
  }

  _buildScreens() {
    // Start Screen
    this.screens.start = el('div', { id: 'screen-start', style: OVERLAY_STYLE },
      el('div', { style: TITLE_STYLE }, 'Spline Rider'),
      el('div', { style: SUBTITLE_STYLE }, 'Ride the curves. Reach the goal.'),
      btn('Play', 'btn-start-play'),
      btn('Editor', 'btn-start-editor'),
      btn('Levels', 'btn-start-levels'),
    );
    document.body.appendChild(this.screens.start);

    // Level Select Screen
    this.screens.levels = el('div', { id: 'screen-levels', style: OVERLAY_STYLE },
      el('div', { style: SUBTITLE_STYLE }, 'Select Level'),
      el('div', { id: 'level-list', style: 'max-height:50vh; overflow-y:auto; width:300px;' }),
      btn('Back', 'btn-levels-back'),
    );
    document.body.appendChild(this.screens.levels);

    // Win Screen
    this.screens.win = el('div', { id: 'screen-win', style: OVERLAY_STYLE },
      el('div', { style: TITLE_STYLE }, 'You Win!'),
      el('div', { id: 'win-time', style: 'font-size:28px; margin-bottom:8px;' }),
      el('div', { id: 'win-best', style: 'font-size:18px; color:#888; margin-bottom:20px;' }),
      btn('Replay', 'btn-win-replay'),
      btn('Menu', 'btn-win-menu'),
    );
    document.body.appendChild(this.screens.win);

    // Death Screen
    this.screens.dead = el('div', { id: 'screen-dead', style: OVERLAY_STYLE },
      el('div', { style: TITLE_STYLE }, 'Fell Off!'),
      btn('Try Again', 'btn-dead-retry'),
      btn('Menu', 'btn-dead-menu'),
    );
    document.body.appendChild(this.screens.dead);

    // Pause Screen
    this.screens.pause = el('div', { id: 'screen-pause', style: OVERLAY_STYLE },
      el('div', { style: TITLE_STYLE }, 'Paused'),
      btn('Resume', 'btn-pause-resume'),
      btn('Restart', 'btn-pause-restart'),
      btn('Menu', 'btn-pause-menu'),
    );
    document.body.appendChild(this.screens.pause);

    // Editor Toolbar — 5 primary items + "More" dropdown for secondary actions
    const TB_STYLE = `padding:6px 14px; font-family:monospace; font-size:13px;
      color:#fff; background:rgba(255,255,255,0.1);
      border:1px solid rgba(255,255,255,0.3); border-radius:4px; cursor:pointer;`;
    const tbBtn = (text, id) => el('button', { id, textContent: text, style: TB_STYLE });

    this.editorToolbar = el('div', {
      id: 'editor-toolbar',
      style: `display:none; position:absolute; top:8px; left:50%; transform:translateX(-50%);
              gap:6px; z-index:5; pointer-events:all;`
    },
      tbBtn('Pan', 'btn-toggle-mode'),
      tbBtn('- Spline', 'btn-delete-spline'),

      // "More" dropdown
      el('div', { style: 'position:relative; display:inline-flex;' },
        el('button', {
          id: 'btn-more-menu',
          textContent: '☰ More',
          style: TB_STYLE,
        }),
        el('div', {
          id: 'editor-more-dropdown',
          style: `display:none; position:absolute; top:100%; right:0; margin-top:4px;
                  flex-direction:column; gap:2px; background:#1e1e3a;
                  border:1px solid #444; border-radius:4px; padding:4px; z-index:15;`
        },
          el('button', { id: 'btn-save-level', textContent: 'Save', style: TB_STYLE }),
          el('button', { id: 'btn-load-level', textContent: 'Load', style: TB_STYLE }),
          el('button', { id: 'btn-export-level', textContent: 'Export', style: TB_STYLE }),
          el('button', { id: 'btn-import-level', textContent: 'Import', style: TB_STYLE }),
        )
      ),

      tbBtn('Test', 'btn-test-level'),
      tbBtn('Back', 'btn-editor-back'),
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
    this._importModal = el('div', { style: `display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index:20; pointer-events:all;` },
      el('div', { style: `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e1e3a; padding:20px; border-radius:8px; border:1px solid #444;` },
        el('div', { style: 'color:#fff; font-family:monospace; margin-bottom:8px;' }, 'Paste level JSON:'),
        el('textarea', { id: 'import-textarea', style: 'width:400px; height:200px; background:#111; color:#fff; font-family:monospace; font-size:12px; border:1px solid #444; padding:8px; resize:vertical;' }),
        el('div', { id: 'import-error', style: 'color:#ff6b6b; font-family:monospace; font-size:12px; margin-top:4px; display:none;' }),
        el('div', { style: 'display:flex; gap:8px; margin-top:8px; justify-content:flex-end;' },
          btn('Import', 'btn-import-confirm'),
          btn('Cancel', 'btn-import-cancel'),
        )
      )
    );
    document.body.appendChild(this._importModal);

    // Toast
    this._toast = el('div', { style: `display:none; position:absolute; bottom:40px; left:50%; transform:translateX(-50%); padding:8px 20px; background:rgba(0,0,0,0.8); color:#4ecdc4; font-family:monospace; font-size:14px; border-radius:4px; z-index:30; pointer-events:none;` });
    document.body.appendChild(this._toast);
    this._toastTimer = null;

    // Mobile pause button — visible during gameplay
    this.pauseBtn = el('button', {
      id: 'btn-mobile-pause',
      textContent: '❚❚',
      style: `display:none; position:absolute; top:16px; right:16px; width:42px; height:42px;
              z-index:15; pointer-events:all; border-radius:50%;
              border:2px solid rgba(255,255,255,0.4);
              background:rgba(0,0,0,0.35); color:#fff; font-size:18px;
              line-height:1; cursor:pointer;`
    });
    document.body.appendChild(this.pauseBtn);
  }

  on(buttonId, callback) {
    this._callbacks[buttonId] = callback;
    // Try to bind to existing button
    const b = document.getElementById(buttonId);
    if (b) {
      b.addEventListener('click', callback);
    }
  }

  showScreen(id, data) {
    // Hide all screens
    for (const key of Object.keys(this.screens)) {
      this.screens[key].style.display = 'none';
    }
    this.editorToolbar.style.display = 'none';
    this.pauseBtn.style.display = 'none';

    // Show requested screen
    if (id === 'editor') {
      this.editorToolbar.style.display = 'flex';
    } else if (id === 'play') {
      this.pauseBtn.style.display = 'block';
    } else if (this.screens[id]) {
      this.screens[id].style.display = 'flex';
    }

    // Populate dynamic content
    if (id === 'win' && data) {
      document.getElementById('win-time').textContent = `Time: ${data.time.toFixed(2)}s`;
      if (data.bestTime !== null) {
        document.getElementById('win-best').textContent = data.isNewBest
          ? 'New Best!'
          : `Best: ${data.bestTime.toFixed(2)}s`;
      } else {
        document.getElementById('win-best').textContent = '';
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

    if (levels.length === 0) {
      list.appendChild(el('div', { style: 'color:#888; padding:10px;' }, 'No levels found.'));
      return;
    }

    for (const level of levels) {
      const row = el('div', {
        style: `display:flex; justify-content:space-between; align-items:center; padding:10px; margin:4px 0;
                background:rgba(255,255,255,0.05); border-radius:4px; cursor:pointer;`
      });

      const info = el('div', {},
        el('div', { style: 'font-size:16px;' }, level.name + (level.builtIn ? ' (built-in)' : '')),
        level.bestTime !== undefined && level.bestTime !== null
          ? el('div', { style: 'font-size:12px; color:#888;' }, `Best: ${level.bestTime.toFixed(2)}s`)
          : el('div', { style: 'font-size:12px; color:#666;' }, 'No time yet'),
      );

      row.appendChild(info);
      row.addEventListener('click', () => onSelect && onSelect(level));

      if (!level.builtIn) {
        const delBtn = el('button', {
          style: `padding:4px 8px; font-size:12px; background:rgba(255,100,100,0.2); color:#ff6b6b;
                  border:1px solid rgba(255,100,100,0.3); border-radius:3px; cursor:pointer;`,
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
    // HUD is updated in main.js tick; this is a no-op for now.
    // Individual HUD elements (timer, speed, state) are updated directly
    // by main.js since the HUD is always present in the DOM.
  }
}
