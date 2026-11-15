import { createWorld, advanceSecret, movePlayer, selectTarget, interact, updateEnemy, isCaptured } from './levels.js';
import { getCinematic } from './cinematics.js';

const ACTIVE = new Set(['LEVEL_1', 'LEVEL_2']);
const RESULTS = new Set(['WIN', 'LOSE']);
// Summing frame fractions can land a few ulps either side of a whole second.
const TIME_EPSILON = 1e-8;
const EMPTY = { movement: { x: 0, z: 0 }, interact: false, primary: false, restart: false };

function newState() {
  return { phase: 'TITLE', phaseElapsed: 0, elapsed: 0, score: 0, timeLeft: 120, world: createWorld(1), target: null, paused: false, message: null, reason: '', awards: [], cinematic: null, display: {}, torchOn: true, muted: false, pointerLocked: false, events: [], capture: null, reading: false };
}

export function createGame() {
  const state = newState();
  let serial = 0;
  function emit(event) { state.events.push({ ...event, serial: ++serial }); }
  function setPhase(phase) {
    state.phase = phase;
    state.phaseElapsed = 0;
    state.target = null;
    state.message = null;
    state.cinematic = getCinematic(phase, 0);
    emit({ type: 'phase.changed', id: phase });
  }
  function notify(text, tone = 'info', remaining = 2) { state.message = { text, tone, remaining }; }
  function award(key, points) {
    if (state.awards.includes(key)) return false;
    state.awards.push(key);
    state.score += points;
    return true;
  }
  function reset() {
    const { paused, muted } = state;
    Object.assign(state, newState(), { paused, muted });
    serial = 0;
  }
  function lose(reason) { state.reason = reason; setPhase('LOSE'); }
  function refreshDisplay() {
    const world = state.world;
    const level2 = world.level === 2;
    const remaining = Math.max(0, Math.ceil(state.timeLeft - TIME_EPSILON));
    const toy = world.toys.find(item => item.id === world.player.carriedToyId);
    state.display = {
      level: level2 ? 'LEVEL 2 · INVENTORY CORRECTION' : 'LEVEL 1 · ROOM CARE',
      objective: level2 ? (world.exit.unlocked ? 'Reach the exit. Press E to escape.' : 'Disable three wall controls. One is inside the secret archive.') : 'Clean and arrange the playroom.',
      progress: level2 ? `${world.switchCount} / 3 switches disabled${world.exit.unlocked ? ' — EXIT UNLOCKED' : ' — Exit locked'}` : `${world.completedTasks ?? 0} / 6 room jobs finished`,
      timer: `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`,
      carrying: level2 ? (world.enemy.active ? world.player.hiddenIn ? 'Hiding — hold Space to peek · E to leave' : world.enemy.mode === 'chase' ? 'It heard you. Break sight and hide.' : 'It is searching. Shift moves quietly.' : world.enemy.spawnIn !== null ? 'Warning: mascot waking up…' : 'Find a switch. Press E.') : toy ? `Carrying: ${toy.name}` : 'Find spills, litter, books, blocks and the crooked chair.',
      score: String(state.score).padStart(4, '0'),
      resultTitle: state.phase === 'WIN' ? 'YOU ESCAPED' : state.capture ? 'YOU WERE CAUGHT' : 'RETURNED TO STORAGE',
      resultDetail: state.phase === 'WIN' ? 'Inventory incomplete. For once, that is a good thing.' : state.reason,
    };
  }
  function dispatch(action) {
    state.events = [];
    if (action === 'start' && state.phase === 'TITLE') { reset(); setPhase('INTRO'); }
    else if (action === 'restart' && RESULTS.has(state.phase)) reset();
    else if (action === 'close-book') state.reading = false;
    else if (action === 'mute') state.muted = !state.muted;
    refreshDisplay();
  }
  function update(delta, intent = EMPTY) {
    state.events = [];
    if (intent.mute) state.muted = !state.muted;
    if (state.paused) return;
    if (state.reading) { if (intent.interact || intent.escape || intent.primary) state.reading = false; return; }
    const dt = Math.min(.05, Math.max(0, Number.isFinite(delta) ? delta : 0));
    if (intent.primary && state.phase === 'TITLE') { dispatch('start'); return; }
    if ((intent.primary || intent.restart) && RESULTS.has(state.phase)) { dispatch('restart'); return; }
    state.elapsed += dt;
    state.phaseElapsed += dt;
    if (state.message) {
      state.message.remaining -= dt;
      if (state.message.remaining <= 0) state.message = null;
    }
    if (state.phase === 'CAPTURE') {
      if (state.phaseElapsed + TIME_EPSILON >= 6.2) lose('You were caught. The room has claimed its last toy.');
      refreshDisplay(); return;
    }
    if (state.phase === 'INTRO' || state.phase === 'LEVEL_TRANSITION') {
      state.cinematic = getCinematic(state.phase, state.phaseElapsed);
      if (state.cinematic.complete) {
        const level = state.phase === 'INTRO' ? 1 : 2;
        const pose = state.world.player;
        const secret = state.world.secret;
        const controlOrder = state.world.controlOrder;
        state.world = createWorld(level);
        state.world.controlOrder = controlOrder;
        if (level === 2) {
          state.world.secret = secret;
          for (const key of ['x', 'z', 'yaw', 'pitch', 'distanceWalked']) state.world.player[key] = pose[key];
          state.world.player.facing = { ...pose.facing };
        }
        state.timeLeft = 120;
        setPhase(level === 1 ? 'LEVEL_1' : 'LEVEL_2');
        state.target = selectTarget(state.world);
      }
      refreshDisplay();
      return;
    }
    if (!ACTIVE.has(state.phase)) { refreshDisplay(); return; }
    const world = state.world;
    const player = world.player;
    advanceSecret(world, dt);
    const finite = value => Number.isFinite(value) ? value : 0;
    player.sneaking = Boolean(intent.sneak);
    player.peeking = Boolean(player.hiddenIn && intent.peek);
    const previousYaw = player.yaw;
    player.yaw -= finite(intent.look?.x) * .0022 + finite(intent.turn?.x) * 1.65 * dt;
    player.yaw = Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw));
    player.pitch = Math.max(-1.22, Math.min(1.22, player.pitch - finite(intent.look?.y) * .0022 + finite(intent.turn?.y) * 1.1 * dt));
    if (player.hiddenIn) {
      const spot = world.hidingSpots.find(item => item.id === player.hiddenIn);
      const base = spot?.entryYaw ?? previousYaw;
      const delta = Math.atan2(Math.sin(player.yaw - base), Math.cos(player.yaw - base));
      player.yaw = base + Math.max(-.6, Math.min(.6, delta));
      player.pitch = Math.max(-.3, Math.min(.3, player.pitch));
    }
    const cos = Math.cos(player.yaw), sin = Math.sin(player.yaw);
    player.facing.x = -sin;
    player.facing.z = -cos;
    const movement = intent.movement ?? EMPTY.movement;
    const x = finite(movement.x), z = finite(movement.z);
    const walkedBefore = player.distanceWalked;
    if (!player.hiddenIn) movePlayer(world, { x: cos * x + sin * z, z: -sin * x + cos * z }, dt);
    player.moving = player.distanceWalked > walkedBefore + 1e-8;
    if (intent.torch && !player.hiddenIn) { state.torchOn = !state.torchOn; emit({ type: 'torch.toggled', id: state.torchOn ? 'on' : 'off' }); }
    const timeRemaining = state.timeLeft - dt;
    state.timeLeft = timeRemaining <= TIME_EPSILON ? 0 : timeRemaining;
    const enemyEvents = state.phase === 'LEVEL_2' ? updateEnemy(world, dt) : [];
    enemyEvents.forEach(emit);
    if (state.timeLeft <= 0) { lose(`Time ran out in ${world.level === 1 ? 'Room Care' : 'Inventory Correction'}.`); refreshDisplay(); return; }
    if (state.phase === 'LEVEL_2' && isCaptured(world)) { state.capture = { fromBehind: (world.enemy.x-player.x)*player.facing.x + (world.enemy.z-player.z)*player.facing.z < 0, player: { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch }, enemy: { x: world.enemy.x, z: world.enemy.z } }; setPhase('CAPTURE'); refreshDisplay(); return; }
    if (enemyEvents.some(event => event.type === 'enemy.spawned')) notify('The mascot is awake. Keep moving!', 'warning', 3);
    state.target = selectTarget(world);
    if (intent.interact && state.target) {
      for (const event of interact(world, state.target)) {
        if (!ACTIVE.has(state.phase)) break;
        emit(event);
        switch (event.type) {
          case 'hide.entered': notify('Stay quiet. Hold Space to peek. E to leave.', 'info', 3); break;
          case 'hide.exited': notify('You left your hiding place.', 'info'); break;
          case 'journal.read': state.reading = true; break;
          case 'secret.wrong': notify('An ordinary book. Check the symbol in the table journal.', 'warning'); break;
          case 'secret.opened': notify('A latch gives way. The bookcase is moving.', 'warning', 4); break;
          case 'task.completed': if (award(`task:${event.id}`, 50)) notify('+50 — Room job finished.', 'success'); break;
          case 'toy.picked': notify(`Picked up ${world.toys.find(toy => toy.id === event.id)?.name ?? 'toy'}.`, 'info', 1.4); break;
          case 'toy.delivered': if (award(`toy:${event.id}`, 100)) notify('+100 — A place for everything!', 'success'); break;
          case 'interaction.wrong': notify('WRONG SHELF — find the matching name.', 'warning'); break;
          case 'control.wrong': notify('Wrong control. Follow the shutdown order in the journal.', 'warning', 3); break;
          case 'switch.disabled':
            if (award(`switch:${event.id}`, 150)) notify(world.exit.unlocked ? '+150 — EXIT UNLOCKED!' : world.switchCount === 1 ? '+150 — Warning: mascot wakes in 3 seconds.' : '+150 — Switch disabled.', world.switchCount === 1 ? 'warning' : 'success', 3);
            break;
          case 'exit.locked': notify('EXIT LOCKED — disable all three switches.', 'warning'); break;
          case 'exit.used':
            if (world.exit.unlocked && world.switchCount === 3 && award('escape', 300)) setPhase('WIN');
            break;
        }
      }
      if (state.phase === 'LEVEL_1' && world.completedTasks === 6) setPhase('LEVEL_TRANSITION');
    }
    if (ACTIVE.has(state.phase)) state.target = selectTarget(world);
    refreshDisplay();
  }
  refreshDisplay();
  return { state, update, dispatch, setPaused(paused) { state.paused = Boolean(paused); } };
}
