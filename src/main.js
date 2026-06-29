import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { TouchInput } from './touch.js';
import { Game } from './game.js';
import { State } from './player.js';
import { UIManager } from './ui.js';
import { Editor } from './editor.js';
import { Effects } from './effects.js';
import * as storage from './storage.js';
import * as online from './online.js';
import { BUILT_IN_LEVELS, DEFAULT_LEVEL } from './levels.js';
import { initColors } from './colors.js';

await initColors();

export const renderer = new Renderer();
const input = new Input();
const touchInput = new TouchInput(renderer.renderer.domElement);
const ui = new UIManager();
const editor = new Editor(renderer);
editor.onSelectionChange = (splineIndex) => {
  ui.setDeleteEnabled(splineIndex !== -1);
};
editor.onModeChange = (mode) => {
  ui.setModeLabel(mode);
};
editor.onModified = () => {
  // Any content change may invalidate the test-play proof; re-derive enablement.
  _refreshUploadButton();
};
const effects = new Effects(renderer.scene);
const game = new Game();

// Compose keyboard + touch input
const composedInput = {
  isDown(key) {
    if (key === 'hold') {
      return input.isDown(' ') || touchInput.isDown('touchHold');
    }
    return input.isDown(key);
  },
  consumeJustPressed(key) {
    if (key === 'hold') {
      return input.consumeJustPressed(' ') || touchInput.consumeJustPressed('touchHold');
    }
    return input.consumeJustPressed(key) || touchInput.consumeJustPressed(key);
  },
  endFrame() {
    input.endFrame();
    touchInput.endFrame();
  },
};

// ---- Screen State ----
const SCREENS = { START: 'start', PLAY: 'play', EDITOR: 'editor', LEVELS: 'levels', ONLINE: 'online' };
let currentScreen = SCREENS.START;
let currentLevelData = DEFAULT_LEVEL;
let isTestPlay = false;
let _savedEditorCamera = null;

// Upload gate: the content key of the level last beaten in test-play, plus the
// proven completion time. Upload is only enabled while the editor's current
// content matches this snapshot (see _refreshUploadButton / editor.onModified).
let provenLevelKey = null;
let provenTimeMs = null;
// Author drill-down filter on the Browse Online screen.
let _onlineAuthorFilter = null;

const AUTHOR_NAME_KEY = 'splineRider_authorName';

// Name-independent snapshot of level content; used to detect edits that should
// invalidate a test-play proof.
function _levelContentKey(data) {
  if (!data) return null;
  return JSON.stringify({
    splines: data.splines,
    startPosition: data.startPosition,
    goalPosition: data.goalPosition,
  });
}

function _refreshUploadButton() {
  const current = _levelContentKey(editor.getLevelData());
  ui.setUploadEnabled(provenLevelKey !== null && current === provenLevelKey);
}

function _getAuthorName() {
  try { return localStorage.getItem(AUTHOR_NAME_KEY) || ''; } catch { return ''; }
}

function _setAuthorName(name) {
  try { localStorage.setItem(AUTHOR_NAME_KEY, name); } catch { /* ignore */ }
}

function _storeEditToken(id, token) {
  try { localStorage.setItem('splineRider_editToken_' + id, token); } catch { /* ignore */ }
}

const FIXED_DT = 1 / 60;
const MAX_FRAME_TIME = 0.1;
let lastTime = performance.now();
let accumulator = 0;
let isPaused = false;

function resetFrameAccumulator() {
  accumulator = 0;
  lastTime = performance.now();
}

function showScreen(id, data) {
  currentScreen = id;
  ui.showScreen(id, data);

  if (id === 'play') {
    isPaused = false;
    resetFrameAccumulator();
    editor.deactivate();
    ui.showOverlay('hide');
    renderer.showGameView(game.splines, game.goalPosition, currentLevelData.startPosition);
  } else if (id === 'editor') {
    resetFrameAccumulator();
    editor.activate();
    _refreshUploadButton();
  }
}

function _restoreEditorCamera() {
  if (_savedEditorCamera) {
    renderer.camera.position.set(
      _savedEditorCamera.x,
      _savedEditorCamera.y,
      _savedEditorCamera.z,
    );
  }
}

// ---- Game Callbacks ----

game.onWin = (time) => {
  const levelName = currentLevelData.name || 'Unknown';
  const isNewBest = storage.saveBestTime(levelName, time);
  const bestTime = storage.getBestTime(levelName);

  if (isTestPlay) {
    // The author just proved this exact level is beatable — record the content
    // snapshot + time so Upload can be unlocked (until the level is edited).
    provenLevelKey = _levelContentKey(currentLevelData);
    provenTimeMs = time * 1000;
    setTimeout(() => {
      _restoreEditorCamera();
      showScreen('editor');
      isTestPlay = false;
    }, 1500);
    ui.showScreen('win', { time, bestTime, isNewBest });
  } else {
    storage.markLevelCompleted(levelName);
    const currentIdx = BUILT_IN_LEVELS.findIndex(l => l.name === levelName);
    const hasNextLevel = currentIdx >= 0 && currentIdx < BUILT_IN_LEVELS.length - 1;
    showScreen('win', { time, bestTime, isNewBest, showNextButtons: true, hasNextLevel });
  }
};

game.onDeath = () => {
  effects.emitDeath(game.player.getPosition());
  if (isTestPlay) {
    setTimeout(() => {
      _restoreEditorCamera();
      showScreen('editor');
      isTestPlay = false;
    }, 1000);
  } else {
    showScreen('dead');
  }
};

game.onPhaseChange = (phase) => {
  if (phase === 'ready') {
    ui.showOverlay('ready');
  } else if (phase === 'go') {
    ui.showOverlay('go');
  }
};

// Track player state for particle effects
let _prevPlayerState = null;
game.onStateChange = (newState) => {
  const pos = game.player.getPosition();
  if (newState === State.FREE_FLIGHT && _prevPlayerState === State.RIDING) {
    effects.emitLaunch(pos);
    renderer.spawnSettlingSpring(game.player.lastSpring);
  } else if (newState === State.RIDING && _prevPlayerState === State.FREE_FLIGHT) {
    effects.emitAttach(pos);
  }
  _prevPlayerState = newState;
};

// ---- UI Button Callbacks ----

// Start screen
ui.on('btn-start-play', () => {
  _showLevelSelect();
});

ui.on('btn-start-online', () => {
  _showOnlineBrowse();
});

ui.on('btn-online-back', () => {
  showScreen('start');
});

ui.on('btn-start-editor', () => {
  editor.initNewLevel();
  showScreen('editor');
});

// Level select
ui.on('btn-levels-back', () => {
  showScreen('start');
});

// Win screen
ui.on('btn-win-replay', () => {
  game.loadLevel(currentLevelData);
  showScreen('play');
});

ui.on('btn-win-next', () => {
  const currentIdx = BUILT_IN_LEVELS.findIndex(l => l.name === currentLevelData.name);
  if (currentIdx >= 0 && currentIdx < BUILT_IN_LEVELS.length - 1) {
    currentLevelData = BUILT_IN_LEVELS[currentIdx + 1];
    game.loadLevel(currentLevelData);
    showScreen('play');
  }
});

ui.on('btn-win-levels', () => {
  _showLevelSelect();
});

// Death screen
ui.on('btn-dead-retry', () => {
  game.loadLevel(currentLevelData);
  showScreen('play');
});

ui.on('btn-dead-menu', () => {
  showScreen('start');
});

// Pause screen
ui.on('btn-pause-resume', () => {
  showScreen('play');
});

ui.on('btn-pause-restart', () => {
  game.loadLevel(currentLevelData);
  showScreen('play');
});

ui.on('btn-pause-menu', () => {
  showScreen('start');
});

// Mobile restart button (visible during gameplay)
ui.on('btn-mobile-restart', () => {
  game.loadLevel(currentLevelData);
  showScreen('play');
});

// Mobile pause button (visible during gameplay)
ui.on('btn-mobile-pause', () => {
  if (currentScreen === 'play') {
    isPaused = true;
    showScreen('pause');
  }
});

// Editor toolbar
ui.on('btn-toggle-mode', () => {
  editor.toggleMode();
});

ui.on('btn-delete-spline', () => {
  editor.deleteSelectedSpline();
});

ui.on('btn-save-level', () => {
  const data = editor.getLevelData();
  ui.promptForName(data.name || 'My Level', (name) => {
    data.name = name;
    storage.saveLevel(data);
    ui.showToast('Saved: ' + name);
  });
});

ui.on('btn-load-level', () => {
  const levels = storage.listLevels().map(l => ({
    ...l,
    builtIn: false,
    bestTime: storage.getBestTime(l.name),
  }));
  const builtIn = BUILT_IN_LEVELS.map(l => ({
    name: l.name,
    builtIn: true,
    lastModified: 0,
    bestTime: storage.getBestTime(l.name),
  }));
  const all = [...levels, ...builtIn];
  ui.showScreen('levels', {
    levels: all,
    onSelect: (level) => {
      ui.showScreen('editor');
      if (level.builtIn) {
        const builtInData = BUILT_IN_LEVELS.find(l => l.name === level.name);
        editor.loadLevel(builtInData);
      } else {
        const savedData = storage.loadLevel(level.name);
        if (savedData) editor.loadLevel(savedData);
      }
    },
    onDelete: (name) => {
      storage.deleteLevel(name);
      ui.showToast('Deleted: ' + name);
      // Refresh the list
      document.getElementById('btn-load-level').click();
    },
  });
});

ui.on('btn-export-level', () => {
  const data = editor.getLevelData();
  data.name = data.name || 'My Level';
  const json = storage.exportLevelJson(data);
  navigator.clipboard.writeText(json).then(() => {
    ui.showToast('Copied level JSON to clipboard');
  }).catch(() => {
    ui.showToast('Failed to copy to clipboard');
  });
});

ui.on('btn-import-level', () => {
  ui.showImportModal((jsonString) => {
    const data = storage.importLevelJson(jsonString);
    editor.loadLevel(data);
    ui.showToast('Imported: ' + data.name);
  });
});

ui.on('btn-upload-level', () => {
  const data = editor.getLevelData();
  // Guard even though the button is disabled when the proof is invalid.
  if (provenLevelKey === null || _levelContentKey(data) !== provenLevelKey) {
    ui.showToast('Beat the level in Test mode first');
    return;
  }
  if (!online.isConfigured()) {
    ui.showToast('Online uploads are not configured yet');
    return;
  }

  // Ensure a level name, then an author name (persisted locally), then upload.
  const withName = (next) => {
    if (data.name && data.name.trim()) { next(data.name.trim()); return; }
    ui.promptForText('Level name:', 'My Level', next);
  };
  const withAuthor = (next) => {
    const saved = _getAuthorName();
    if (saved) { next(saved); return; }
    ui.promptForText('Your author name (shown publicly):', '', (a) => {
      _setAuthorName(a);
      next(a);
    });
  };

  withName((name) => {
    data.name = name;
    withAuthor((author) => _doUpload(name, author, data));
  });
});

ui.on('btn-test-level', () => {
  const data = editor.getLevelData();
  data.name = data.name || 'Test Level';
  _savedEditorCamera = {
    x: renderer.camera.position.x,
    y: renderer.camera.position.y,
    z: renderer.camera.position.z,
  };
  currentLevelData = data;
  isTestPlay = true;
  game.loadLevel(data);
  showScreen('play');
});

ui.on('btn-editor-back', () => {
  editor.deactivate();
  showScreen('start');
});

// ---- Level Select Helper ----

function _showLevelSelect() {
  const levels = storage.listLevels().map(l => ({
    ...l,
    builtIn: false,
    bestTime: storage.getBestTime(l.name),
  }));
  const builtIn = BUILT_IN_LEVELS.map(l => ({
    name: l.name,
    builtIn: true,
    lastModified: 0,
    bestTime: storage.getBestTime(l.name),
  }));
  const all = [...levels, ...builtIn];

  let nextIndex = 0;
  for (let i = 0; i < BUILT_IN_LEVELS.length; i++) {
    if (!storage.isLevelCompleted(BUILT_IN_LEVELS[i].name)) {
      nextIndex = i;
      break;
    }
    nextIndex = i + 1;
  }
  // Offset by custom levels since they come first in the combined list
  const builtInOffset = levels.length;
  const displayNextIndex = nextIndex < BUILT_IN_LEVELS.length ? builtInOffset + nextIndex : nextIndex;

  ui.showScreen('levels', {
    levels: all,
    nextIndex: displayNextIndex,
    isLevelCompleted: (name) => storage.isLevelCompleted(name),
    onSelect: (level) => {
      if (level.builtIn) {
        currentLevelData = BUILT_IN_LEVELS.find(l => l.name === level.name);
      } else {
        currentLevelData = storage.loadLevel(level.name);
      }
      game.loadLevel(currentLevelData);
      showScreen('play');
    },
    onDelete: (name) => {
      storage.deleteLevel(name);
      _showLevelSelect();
    },
  });
}

// ---- Online catalog ----

async function _doUpload(name, author, data) {
  ui.showToast('Uploading…');
  try {
    const { id, edit_token } = await online.uploadLevel({
      name, author, data, authorTimeMs: provenTimeMs,
    });
    if (edit_token) _storeEditToken(id, edit_token);
    const url = `${location.origin}${location.pathname}?level=${id}`;
    ui.showShareModal(url);
  } catch (e) {
    console.warn('Upload failed', e);
    ui.showToast('Upload failed. Check your connection.');
  }
}

function _showOnlineBrowse() {
  _onlineAuthorFilter = null;
  // Use the local showScreen (not ui.showScreen) so module-level currentScreen
  // becomes 'online' — _loadOnlineList guards rendering on it.
  showScreen('online', {
    onSearch: (term) => {
      // Typing a search clears any active author filter.
      _onlineAuthorFilter = null;
      ui.setOnlineFilterLabel(null);
      _loadOnlineList({ search: term });
    },
    onSelect: (level) => _playOnlineLevel(level.id),
    onSelectAuthor: (author) => {
      _onlineAuthorFilter = author;
      ui.setOnlineFilterLabel(author, () => {
        _onlineAuthorFilter = null;
        ui.setOnlineFilterLabel(null);
        _loadOnlineList({});
      });
      _loadOnlineList({ author });
    },
  });
  _loadOnlineList({});
}

async function _loadOnlineList(opts) {
  if (!online.isConfigured()) {
    ui.showOnlineMessage('Online levels are not configured yet.');
    return;
  }
  ui.showOnlineMessage('Loading…');
  try {
    const levels = await online.listLevels(opts);
    if (currentScreen !== 'online') return; // user navigated away mid-request
    ui.renderOnlineList(levels);
  } catch (e) {
    console.warn('Failed to load online levels', e);
    if (currentScreen === 'online') {
      ui.showOnlineMessage('Could not load levels. Check your connection.');
    }
  }
}

async function _playOnlineLevel(id) {
  ui.showToast('Loading level…');
  try {
    const result = await online.getLevel(id);
    currentLevelData = result.level;
    isTestPlay = false;
    game.loadLevel(currentLevelData);
    showScreen('play');
  } catch (e) {
    console.warn('Failed to load level', e);
    ui.showToast('Could not load that level.');
  }
}

// ---- Initial ----
renderer.showGameView(game.splines, game.goalPosition, currentLevelData.startPosition);
showScreen('start');

// Shareable deep-link: ?level=<id> loads straight into that community level,
// falling back to the start screen on any failure.
const _deepLinkLevelId = new URLSearchParams(location.search).get('level');
if (_deepLinkLevelId) {
  _playOnlineLevel(_deepLinkLevelId);
}

// ---- Game Loop ----
function tick() {
  requestAnimationFrame(tick);

  let frameTime = (performance.now() - lastTime) / 1000;
  lastTime = performance.now();
  if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

  // Pause toggle
  if (input.consumeJustPressed('Escape') || input.consumeJustPressed('p')) {
    if (currentScreen === 'play') {
      isPaused = true;
      showScreen('pause');
    } else if (currentScreen === 'pause') {
      isPaused = false;
      showScreen('play');
    }
  }

  // Update based on current screen
  if (currentScreen === 'play' && !isPaused) {
    accumulator += frameTime;

    while (accumulator >= FIXED_DT) {
      game.update(FIXED_DT, composedInput);
      effects.update(FIXED_DT);
      renderer.updateVisualSprings(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    const renderAlpha = accumulator / FIXED_DT;
    const renderSnapshot = game.getInterpolatedPlayerSnapshot(renderAlpha);
    renderer.updatePlayer(game.player, composedInput.isDown('hold'), renderSnapshot);
  } else if (currentScreen === 'editor') {
    accumulator = 0;
    if (input.consumeJustPressed(' ')) {
      editor.toggleMode();
    }
    if (input.consumeJustPressed('Escape')) {
      editor.cancelKnotPlacement();
    }
    editor.update();
  }

  renderer.render();
  composedInput.endFrame();

  // Update HUD (always visible, shows last state)
  if (game.player) {
    updateHUD();
  }
}

function updateHUD() {
  document.getElementById('timer').textContent =
    `Time: ${game.elapsedTime.toFixed(2)}s`;
  document.getElementById('speed').textContent =
    `Speed: ${Math.abs(game.player.getSpeed()).toFixed(0)}`;
  const stateLabel = game.player.getState();
  document.getElementById('state').textContent = `State: ${stateLabel}`;

  if (game.player.state === State.DEAD) {
    document.getElementById('state').textContent = 'State: DEAD (press R)';
  }
  if (game.player.state === State.WIN) {
    document.getElementById('state').textContent = 'State: WIN!';
  }
}

tick();
