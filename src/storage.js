// localStorage wrapper for levels and best times

const LEVEL_LIST_KEY = 'splineRider_levelList';
const LEVEL_PREFIX = 'splineRider_level_';
const BEST_PREFIX = 'splineRider_best_';

function _levelList() {
  try {
    const raw = localStorage.getItem(LEVEL_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveLevelList(list) {
  localStorage.setItem(LEVEL_LIST_KEY, JSON.stringify(list));
}

export function saveLevel(levelData) {
  const key = LEVEL_PREFIX + levelData.name;
  const entry = { name: levelData.name, lastModified: Date.now() };
  localStorage.setItem(key, JSON.stringify(levelData));

  const list = _levelList().filter(l => l.name !== levelData.name);
  list.push(entry);
  _saveLevelList(list);
}

export function loadLevel(name) {
  const raw = localStorage.getItem(LEVEL_PREFIX + name);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function deleteLevel(name) {
  localStorage.removeItem(LEVEL_PREFIX + name);
  const list = _levelList().filter(l => l.name !== name);
  _saveLevelList(list);
}

export function listLevels() {
  return _levelList();
}

export function saveBestTime(levelName, time) {
  const key = BEST_PREFIX + levelName;
  const current = getBestTime(levelName);
  if (current === null || time < current) {
    localStorage.setItem(key, JSON.stringify(time));
    return true;
  }
  return false;
}

export function getBestTime(levelName) {
  const raw = localStorage.getItem(BEST_PREFIX + levelName);
  if (!raw) return null;
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

export function exportLevelJson(levelData) {
  return JSON.stringify(levelData, null, 2);
}

export function importLevelJson(jsonString) {
  const data = JSON.parse(jsonString);

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid level data: not an object');
  }
  if (!Array.isArray(data.splines) || data.splines.length === 0) {
    throw new Error('Invalid level data: missing or empty splines array');
  }
  for (let i = 0; i < data.splines.length; i++) {
    const s = data.splines[i];
    if (!Array.isArray(s.points) || s.points.length < 2) {
      throw new Error(`Invalid level data: spline ${i} missing or too few points`);
    }
    for (let j = 0; j < s.points.length; j++) {
      const p = s.points[j];
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
        throw new Error(`Invalid level data: spline ${i} point ${j} invalid`);
      }
    }
  }
  if (typeof data.startSplineIndex !== 'number' ||
      data.startSplineIndex < 0 || data.startSplineIndex >= data.splines.length) {
    data.startSplineIndex = 0;
  }
  if (!data.goalPosition || typeof data.goalPosition.x !== 'number' || typeof data.goalPosition.y !== 'number') {
    const last = data.splines[data.splines.length - 1];
    const lastPt = last.points[last.points.length - 1];
    data.goalPosition = { x: lastPt.x, y: lastPt.y };
  }
  if (!data.name) {
    data.name = 'Imported Level';
  }
  if (data.startT === undefined) {
    data.startT = 0;
  }

  return data;
}
