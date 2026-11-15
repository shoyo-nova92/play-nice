import { createGame } from './game.js';
import { createInput } from './input.js';
import { createScene } from './scene.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

const game = createGame();
const sound = createAudio();
const surface = document.getElementById('scene');
let input, scene;
let frame = 0, previous = null, stopped = false, focused = true, manualPause = false;
const active = () => ['LEVEL_1', 'LEVEL_2'].includes(game.state.phase);
const playing = () => !['TITLE', 'WIN', 'LOSE'].includes(game.state.phase);
function applyPause() {
  game.setPaused(!focused || manualPause);
  // Hidden tabs can suspend RAF; silence sound in the focus event itself.
  sound.update(game.state, 0);
  input?.clear(); previous = null;
}
function action(name, value) {
  sound.unlock();
  if (name === 'volume') { sound.setVolume(value); return; }
  if (name === 'resume') {
    manualPause = false; applyPause(); input?.requestPointerLock(); return;
  }
  if (name === 'start') { manualPause = false; applyPause(); input?.requestPointerLock(); }
  if (name === 'restart') { manualPause = false; applyPause(); input?.releasePointerLock(); }
  game.dispatch(name); input?.clear();
}
const ui = createUI({ onAction: action });
try {
  scene = createScene(surface);
  input = createInput({
    surface,
    onGesture() { sound.unlock(); },
    onFocusChange(value) { focused = value; applyPause(); },
    onPointerLockChange(value) {
      const wasLocked = game.state.pointerLocked;
      game.state.pointerLocked = value;
      if (wasLocked && !value && playing()) { manualPause = true; applyPause(); }
    },
  });
  const resize = () => scene.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  resize();
  function animate(timestamp) {
    if (stopped) return;
    try {
      const dt = previous === null ? 0 : Math.min(.05, Math.max(0, (timestamp - previous) / 1000));
      previous = timestamp;
      const phase = game.state.phase;
      const intent = input.read();
      if (intent.escape && playing() && !game.state.reading) { manualPause = true; applyPause(); input.releasePointerLock(); }
      if (intent.primary && game.state.paused && focused) { action('resume'); intent.primary = false; }
      if (intent.primary && phase === 'TITLE') input.requestPointerLock();
      game.update(dt, intent);
      if (phase !== game.state.phase) {
        input.clear();
        if (['TITLE', 'WIN', 'LOSE'].includes(game.state.phase)) input.releasePointerLock();
      }
      input.setLookEnabled(active() && !game.state.paused && !game.state.reading);
      game.state.pointerLocked = input.isPointerLocked();
      sound.update(game.state, dt);
      scene.sync(game.state, game.state.cinematic);
      ui.update(game.state);
      scene.render();
      frame = requestAnimationFrame(animate);
    } catch (error) {
      stopped = true; input.dispose(); sound.dispose();
      ui.showError('The playroom stopped: ' + error.message);
      console.error(error);
    }
  }
  frame = requestAnimationFrame(animate);
  window.addEventListener('pagehide', () => {
    stopped = true; cancelAnimationFrame(frame);
    input.dispose(); sound.dispose(); window.removeEventListener('resize', resize);
    scene.dispose(); ui.dispose();
  }, { once: true });
} catch (error) {
  stopped = true; input?.dispose(); scene?.dispose(); sound.dispose();
  ui.showError(error.message); console.error(error);
}
