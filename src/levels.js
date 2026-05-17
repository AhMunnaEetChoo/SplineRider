// Built-in level catalog — loaded from JSON files in the levels/ directory.
// Drop a .json file exported from the editor into levels/ and add it to
// index.json to include it as a built-in level.

async function _loadBuiltInLevels() {
  const resp = await fetch('levels/index.json');
  if (!resp.ok) throw new Error(`Failed to load level index: ${resp.status}`);
  const files = await resp.json();
  const levels = [];
  for (const file of files) {
    const lvlResp = await fetch(`levels/${file}`);
    if (!lvlResp.ok) {
      console.warn(`Skipping ${file}: HTTP ${lvlResp.status}`);
      continue;
    }
    const data = await lvlResp.json();
    if (!data.name) data.name = file.replace(/\.json$/, '');
    levels.push(data);
  }
  return levels;
}

export const BUILT_IN_LEVELS = await _loadBuiltInLevels();
export const DEFAULT_LEVEL = BUILT_IN_LEVELS[0];
