import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { TouchInput } from './touch.js';
import { Game } from './game.js';
import { State } from './player.js';
import { UIManager } from './ui.js';
import { Editor } from './editor.js';
import { Effects } from './effects.js';
import * as storage from './storage.js';
import { BUILT_IN_LEVELS, DEFAULT_LEVEL } from './levels.js';

export const renderer = new Renderer();
const input = new Input();
const touchInput = new TouchInput();
const ui = new UIManager();
const editor = new Editor(renderer);
editor.onSelectionChange = (splineIndex) => {
  ui.setDeleteEnabled(splineIndex !== -1);
};
editor.onModeChange = (mode) => {
  ui.setModeLabel(mode);
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
    return input.consumeJustPressed(key);
  },
  endFrame() {
    input.endFrame();
    touchInput.endFrame();
  },
};

// ---- Screen State ----
const SCREENS = { START: 'start', PLAY: 'play', EDITOR: 'editor', LEVELS: 'levels' };
let currentScreen = SCREENS.START;
let currentLevelData = DEFAULT_LEVEL;
let isTestPlay = false;
let _savedEditorCamera = null;

function showScreen(id, data) {
  currentScreen = id;
  ui.showScreen(id, data);

  if (id === 'play') {
    editor.deactivate();
    renderer.showGameView(game.splines, game.goalPosition, currentLevelData.startPosition);
  } else if (id === 'editor') {
    editor.activate();
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
    // Brief pause then return to editor
    setTimeout(() => {
      _restoreEditorCamera();
      showScreen('editor');
      isTestPlay = false;
    }, 1500);
    ui.showScreen('win', { time, bestTime, isNewBest });
  } else {
    showScreen('win', { time, bestTime, isNewBest });
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

game.onReset = () => {
  document.getElementById('win-message').style.display = 'none';
};

// Track player state for particle effects
let _prevPlayerState = null;
game.onStateChange = (newState) => {
  const pos = game.player.getPosition();
  if (newState === State.FREE_FLIGHT && _prevPlayerState === State.RIDING) {
    effects.emitLaunch(pos);
  } else if (newState === State.RIDING && _prevPlayerState === State.FREE_FLIGHT) {
    effects.emitAttach(pos);
  }
  _prevPlayerState = newState;
};

// ---- UI Button Callbacks ----

// Start screen
ui.on('btn-start-play', () => {
  game.loadLevel(currentLevelData);
  showScreen('play');
});

ui.on('btn-start-editor', () => {
  editor.initNewLevel();
  showScreen('editor');
});

ui.on('btn-start-levels', () => {
  _showLevelSelect();
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

ui.on('btn-win-menu', () => {
  showScreen('start');
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

  ui.showScreen('levels', {
    levels: all,
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

// ---- Initial ----
renderer.showGameView(game.splines, game.goalPosition, currentLevelData.startPosition);
showScreen('start');

// ---- Game Loop ----
let lastTime = performance.now();
let isPaused = false;

function tick() {
  requestAnimationFrame(tick);

  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.016;

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
    game.update(dt, composedInput);
    renderer.updatePlayer(game.player, composedInput.isDown('hold'));
    effects.update(dt);
  } else if (currentScreen === 'editor') {
    if (input.consumeJustPressed(' ')) {
      editor.toggleMode();
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
