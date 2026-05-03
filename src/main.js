import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Game } from './game.js';

export const renderer = new Renderer();
const input = new Input();
const game = new Game();

// Initial spline setup
renderer.updateSplines(game.splines);

// Game clock
let lastTime = performance.now();

function tick() {
  requestAnimationFrame(tick);

  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  // Clamp delta to avoid jumps when tab is unfocused
  if (dt > 0.1) dt = 0.016;

  game.update(dt, input);
  renderer.updatePlayer(game.player);
  renderer.render();
  input.endFrame();
}

tick();
