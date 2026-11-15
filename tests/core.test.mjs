import { walkTo } from './route-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createGame } from '../src/game.js';
import { getCinematic } from '../src/cinematics.js';
import { createInput } from '../src/input.js';
import { findPath, createWorld, selectTarget, interact, movePlayer, updateEnemy, isCaptured, ROOM } from '../src/levels.js';

const intent = (overrides = {}) => ({ movement: { x: 0, z: 0 }, look: { x: 0, y: 0 }, turn: { x: 0, y: 0 }, interact: false, primary: false, restart: false, torch: false, mute: false, escape: false, sneak: false, peek: false, ...overrides });
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const TASK_IDS = ['spill-1', 'spill-2', 'rubbish', 'chair', 'books', 'blocks'];
const TASK_AWARDS = TASK_IDS.map(id => `task:${id}`);
const CONTROL_ORDER = ['switch-1', 'switch-2', 'switch-3'];
function advance(game, seconds, input = intent()) {
  const ticks = Math.floor(seconds / .05 + 1e-8);
  for (let index = 0; index < ticks; index++) game.update(.05, input);
  const leftover = seconds - ticks * .05;
  if (leftover > 1e-8) game.update(leftover, input);
}
function levelOne() {
  const game = createGame();
  game.dispatch('start');
  game.state.world.controlOrder = [...CONTROL_ORDER];
  advance(game, 15);
  assert.equal(game.state.phase, 'LEVEL_1');
  return game;
}
function revealFixture() {
  const game = levelOne();
  game.state.phase = 'LEVEL_TRANSITION';
  game.state.phaseElapsed = 0;
  game.state.score = 300;
  game.state.awards = [...TASK_AWARDS];
  game.state.world.tasks.forEach(task => { task.done = true; });
  game.state.world.completedTasks = 6;
  return game;
}


function press(game) { game.update(.05, intent({ interact: true })); }
function completeLevelOne(game) {
  const world = game.state.world;
  for (const task of world.tasks) {
    walkTo(game, task);
    press(game);
  }
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  const savedRandom=Math.random;
  try { Math.random=()=>.42; advance(game,1.35); } finally { Math.random=savedRandom; }
  assert.equal(game.state.phase, 'LEVEL_2');
}
function levelTwoFixture() {
  const game = createGame();
  game.state.phase = 'LEVEL_2';
  game.state.world = createWorld(2, { controlOrder: CONTROL_ORDER });
  game.state.score = 300;
  game.state.awards = [...TASK_AWARDS];
  return game;
}
function captureFixture() {
  const game = levelTwoFixture();
  const world = game.state.world;
  world.enemy.active = true;
  world.enemy.x = world.player.x;
  world.enemy.z = world.player.z;
  game.update(0);
  assert.equal(game.state.phase, 'CAPTURE');
  return game;
}

class EventSurface {
  listeners = new Map();
  addEventListener(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ callback, once: Boolean(options?.once) });
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.callback !== callback));
  }
  emit(type, event = {}) {
    const result = { code: '', repeat: false, target: { tagName: 'BODY' }, prevented: false, preventDefault() { this.prevented = true; }, ...event };
    for (const item of [...(this.listeners.get(type) ?? [])]) {
      item.callback(result);
      if (item.once) this.removeEventListener(type, item.callback);
    }
    return result;
  }
  count(type) { return (this.listeners.get(type) ?? []).length; }
  total() { return [...this.listeners.values()].reduce((sum, values) => sum + values.length, 0); }
}
function withDOM(callback, { focused = true, hidden = false } = {}) {
  const savedWindow = globalThis.window;
  const savedDocument = globalThis.document;
  const window = new EventSurface();
  const document = new EventSurface();
  document.hidden = hidden;
  document.focused = focused;
  document.hasFocus = () => document.focused;
  const surface = { contains: target => target === surface };
  document.getElementById = () => surface;
  document.pointerLockElement = null;
  document.exitPointerLock = () => { document.pointerLockElement = null; document.emit('pointerlockchange'); };
  window.innerWidth = 1366;
  window.innerHeight = 768;
  globalThis.window = window;
  globalThis.document = document;
  try { return callback({ window, document, surface }); }
  finally {
    if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
    if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
  }
}

test('fresh games have independent worlds, authoritative timer, score, and display', () => {
  const first = createGame();
  const second = createGame();
  assert.equal(first.state.phase, 'TITLE');
  assert.equal(first.state.timeLeft, 120);
  assert.equal(first.state.score, 0);
  assert.equal(first.state.display.timer, '02:00');
  assert.equal(first.state.display.score, '0000');
  assert.notEqual(first.state.world, second.state.world);
  first.state.world.player.x = 3;
  assert.equal(second.state.world.player.x, 0);
});

test('menu actions are gated and title countdown is frozen', () => {
  const game = createGame();
  advance(game, 2, intent({ interact: true, restart: true, movement: { x: 1, z: 0 } }));
  assert.equal(game.state.phase, 'TITLE');
  assert.equal(game.state.timeLeft, 120);
  assert.equal(game.state.world.player.x, 0);
  game.update(.05, intent({ primary: true }));
  assert.equal(game.state.phase, 'INTRO');
  game.dispatch('start');
  game.dispatch('restart');
  assert.equal(game.state.phase, 'INTRO');
});

test('intro gates movement and timer for 15 seconds and consumes its final-frame E', () => {
  const game = createGame();
  game.dispatch('start');
  advance(game, 14.95, intent({ movement: { x: 1, z: 1 }, interact: true }));
  assert.equal(game.state.phase, 'INTRO');
  assert.equal(game.state.timeLeft, 120);
  assert.equal(game.state.world.player.x, 0);
  game.update(.05, intent({ movement: { x: 1, z: 1 }, interact: true }));
  assert.equal(game.state.phase, 'LEVEL_1');
  assert.equal(game.state.timeLeft, 120);
  assert.equal(game.state.world.player.x, 0);
  assert.equal(game.state.world.player.carriedToyId, null);
  assert.equal(game.state.cinematic, null);
});

test('cinematic boundaries match every intro and reveal narrative beat', () => {
  for (const [time, text] of [[0, 'ONE LAST JOB.'], [2, 'HE NEVER CLEANS IT.'], [5, 'HE LOVES THAT OLD BUNNY.'], [7.5, 'CLEAN AND ARRANGE THE ROOM.'], [12.5, 'WAS HE ALWAYS SMILING?']]) {
    assert.equal(getCinematic('INTRO', time).title, text);
  }
  assert.equal(getCinematic('INTRO', 14.999).complete, false);
  assert.equal(getCinematic('INTRO', 15).complete, true);
  const finalCamera = getCinematic('INTRO', 14.5).camera;
  finalCamera.position.forEach((value, i) => near(value, [0, 1.6, 4.7][i]));
  finalCamera.target.forEach((value, i) => near(value, [0, 1.6, -4.3][i]));
  assert.equal(getCinematic('LEVEL_TRANSITION', 0).overlayOpacity, 1);
  assert.equal(getCinematic('LEVEL_TRANSITION', .099).title, '');
  assert.equal(getCinematic('LEVEL_TRANSITION', .1).title, 'THAT IS NOT HOW YOU LEFT HIM.');
  assert.equal(getCinematic('LEVEL_TRANSITION', 1.349).complete, false);
  assert.equal(getCinematic('LEVEL_TRANSITION', 1.35).complete, true);
  assert.equal(getCinematic('LEVEL_TRANSITION', 0).corruption, 1);
  assert.deepEqual(getCinematic('LEVEL_TRANSITION', 0).camera.target, [6.8,2,4.8], 'reveal shows changed bunny');
  assert.equal(getCinematic('LEVEL_1', 20), null);
  assert.deepEqual(getCinematic('INTRO', 8), getCinematic('INTRO', 8));
});

test('reveal preserves score, freezes countdown, and creates a fresh level 2 at 1.35 seconds', () => {
  const game = revealFixture();
  const previousWorld = game.state.world;
  game.state.timeLeft = 71;
  advance(game, 1.3, intent({ interact: true, movement: { x: 1, z: 1 } }));
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  assert.equal(game.state.timeLeft, 71);
  assert.equal(game.state.score, 300);
  // Set the exact boundary fixture to isolate coordinator gating from FP sums.
  game.state.phaseElapsed = 1.34;
  game.update(.01, intent({ interact: true }));
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.notEqual(game.state.world, previousWorld);
  assert.equal(game.state.world.level, 2);
  assert.equal(game.state.timeLeft, 120);
  assert.equal(game.state.score, 300);
  assert.deepEqual(game.state.awards, TASK_AWARDS);
  assert.equal(game.state.world.completedTasks, 6);
  assert.ok(game.state.world.tasks.every(task => task.done), 'clean room persists into level 2');
  assert.equal(game.state.world.switchCount, 0);
  assert.equal(game.state.world.enemy.active, false);
});

test('pause freezes authoritative gameplay and cinematic state while expiring transient events', () => {
  for (const fixture of [() => { const game = createGame(); game.dispatch('start'); return game; }, levelOne, revealFixture, captureFixture]) {
    const game = fixture();
    game.setPaused(true);
    const before = structuredClone(game.state);
    before.events = [];
    advance(game, 20, intent({ movement: { x: 1, z: 1 }, interact: true, primary: true, restart: true }));
    assert.deepEqual(game.state, before);
    game.setPaused(false);
    game.update(.05);
    near(game.state.elapsed, before.elapsed + .05);
  }
});

test('accumulated 1.35-second reveal reaches level 2 without an extra frame', () => {
  const game = revealFixture();
  advance(game, 1.35);
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.equal(game.state.timeLeft, 120);
});

test('accumulated 120-second gameplay clock expires at the level limit', () => {
  const game = levelOne();
  advance(game, 120);
  assert.equal(game.state.phase, 'LOSE');
  assert.equal(game.state.timeLeft, 0);
});

test('simulation clamps large and invalid deltas without movement jumps', () => {
  const game = levelOne();
  const startX = game.state.world.player.x;
  game.update(999, intent({ movement: { x: 1, z: 0 } }));
  near(game.state.timeLeft, 119.95);
  near(game.state.world.player.x, startX + .2);
  for (const dt of [-1, NaN, Infinity]) game.update(dt, intent({ movement: { x: 1, z: 0 } }));
  near(game.state.timeLeft, 119.95);
  near(game.state.world.player.x, startX + .2);
  assert.equal(game.state.display.timer, '02:00');
  advance(game, .95);
  near(game.state.timeLeft, 119);
  assert.equal(game.state.display.timer, '01:59');
});

test('both level timeouts freeze play and provide the level-specific failure reason', () => {
  for (const level of [1, 2]) {
    const game = levelOne();
    if (level === 2) { game.state.phase = 'LEVEL_2'; game.state.world = createWorld(2); }
    game.state.timeLeft = .01;
    game.update(.02, intent({ interact: true }));
    assert.equal(game.state.phase, 'LOSE');
    assert.equal(game.state.timeLeft, 0);
    assert.match(game.state.reason, level === 1 ? /Room Care/ : /Inventory Correction/);
    assert.equal(game.state.display.resultDetail, game.state.reason);
    const position = { x: game.state.world.player.x, z: game.state.world.player.z };
    advance(game, 5, intent({ interact: true, movement: { x: 1, z: 1 } }));
    assert.deepEqual({ x: game.state.world.player.x, z: game.state.world.player.z }, position);
    assert.equal(game.state.score, 0);
  }
});

test('six cleanup jobs complete by movement and E, score once, and leave decorative toys untouched', () => {
  const game = levelOne();
  const world = game.state.world;
  const toysBefore = structuredClone(world.toys);
  assert.deepEqual(world.tasks.map(task => task.id), TASK_IDS);
  assert.equal(world.completedTasks, 0);
  for (const [index, task] of world.tasks.entries()) {
    walkTo(game, task);
    assert.equal(game.state.target.id, task.id);
    assert.equal(game.state.target.kind, 'task');
    assert.equal(game.state.target.prompt, `E — ${task.name}`);
    press(game);
    assert.equal(task.done, true);
    assert.equal(world.completedTasks, index + 1);
    assert.equal(game.state.score, (index + 1) * 50);
    for (let duplicate = 0; duplicate < 3; duplicate++) press(game);
    if(world.player.hiddenIn)press(game); // Repeated new presses may legitimately enter a nearby hiding place.
    assert.equal(game.state.score, (index + 1) * 50, 'finished job cannot award twice');
    assert.equal(world.completedTasks, index + 1);
  }
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  assert.equal(game.state.score, 300);
  assert.deepEqual(game.state.awards, TASK_AWARDS);
  assert.equal(world.completedTasks, 6);
  assert.deepEqual(world.toys, toysBefore);
  assert.equal(world.deliveredCount, 0, 'legacy sorting field is no longer a progression condition');
  assert.equal(world.player.carriedToyId, null);
  assert.ok(game.state.timeLeft > 0, 'all objectives reachable before the level timeout');
  const frozenTime = game.state.timeLeft;
  advance(game, 1.2, intent({ interact: true })); // Three duplicate presses already advanced reveal by .15.
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.equal(game.state.score, 300);
  assert.equal(game.state.timeLeft, 120);
  assert.ok(frozenTime < 120);
  assert.notEqual(game.state.world, world);
});

test('level 1 targeting uses range, nearest distance and stable ID ties, with stale input revalidation', () => {
  const world = createWorld(1);
  const player = world.player;
  player.x = 0;
  player.z = 0;
  world.tasks[0].x = .5;
  world.tasks[0].z = -1;
  world.tasks[1].x = -.5;
  world.tasks[1].z = -1;
  world.tasks[2].x = 6;
  world.tasks[2].z = 5;
  assert.equal(selectTarget(world).id, 'spill-1', 'exact ties use lexical stable ID');
  world.tasks.reverse();
  assert.equal(selectTarget(world).id, 'spill-1', 'source array order cannot alter tie');
  const target = selectTarget(world);
  player.x = 7;
  player.z = -5;
  assert.equal(selectTarget(world), null);
  assert.deepEqual(interact(world, target), [], 'out-of-range stale UI target is rejected');
  player.x = 0;
  player.z = 0;
  assert.deepEqual(interact(world, target), [{ type: 'task.completed', id: 'spill-1' }]);
  assert.deepEqual(interact(world, target), [], 'a finished task cannot be completed again');
  assert.equal(selectTarget(world).id, 'spill-2', 'unfinished nearby task remains eligible');
  assert.equal(world.completedTasks, 1);
});

test('timeout wins over a simultaneous sixth cleanup job and never starts the reveal', () => {
  const game = levelOne();
  const world = game.state.world;
  for (const task of world.tasks.slice(0, 5)) {
    walkTo(game, task);
    press(game);
  }
  const last = world.tasks.find(task => !task.done);
  walkTo(game, last);
  game.state.timeLeft = .025;
  press(game);
  assert.equal(game.state.phase, 'LOSE');
  assert.equal(game.state.score, 250);
  assert.equal(world.completedTasks, 5);
  assert.equal(last.done, false);
  assert.equal(game.state.awards.length, 5);
});

test('movement respects actor radius at bounds and does not gain speed diagonally', () => {
  const straight = createWorld(1);
  const diagonal = createWorld(1);
  straight.player.x = diagonal.player.x = 0;
  straight.player.z = diagonal.player.z = 0;
  movePlayer(straight, { x: 1, z: 0 }, .5);
  movePlayer(diagonal, { x: 1, z: 1 }, .5);
  near(Math.hypot(straight.player.x, straight.player.z), Math.hypot(diagonal.player.x, diagonal.player.z));
  movePlayer(straight, { x: 10, z: 10 }, 100);
  assert.equal(straight.player.x, ROOM.width / 2 - straight.player.radius);
  assert.equal(straight.player.z, ROOM.depth / 2 - straight.player.radius);
  movePlayer(straight, { x: -10, z: -10 }, 100);
  assert.equal(straight.player.x, -ROOM.width / 2 + straight.player.radius);
  assert.equal(straight.player.z, -ROOM.depth / 2 + straight.player.radius);
});

test('full two-level movement route wins at 1050 only after E at unlocked exit, with no duplicate awards', () => {
  const game = levelOne();
  completeLevelOne(game);
  const world = game.state.world;
  assert.equal(game.state.score, 300);
  walkTo(game, world.exit);
  assert.equal(game.state.target.kind, 'exit');
  assert.match(game.state.target.prompt, /LOCKED/);
  press(game);
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.equal(game.state.score, 300);
  assert.equal(world.enemy.spawnIn, null);
  assert.match(game.state.message.text, /EXIT LOCKED/);
  // Solve the journal/book puzzle before activating the pursuit.
  walkTo(game, {x:-3,z:2}); press(game); game.update(0,intent({interact:true}));
  walkTo(game, {x:[-.65,0,.65][world.secret.targetIndex],z:-5}, .2); press(game); advance(game,.7);
  for (const [index, control] of world.switches.entries()) {
    if(control.id === 'switch-3') {walkTo(game,{x:0,z:-5.2},.2);walkTo(game,{x:0,z:-7},.2);}
    walkTo(game, control);
    assert.equal(game.state.target.id, control.id);
    press(game);
    assert.equal(game.state.score, 300 + (index + 1) * 150);
    assert.equal(world.switchCount, index + 1);
    assert.equal(world.exit.unlocked, index === 2);
    assert.equal(game.state.phase, 'LEVEL_2');
    const score = game.state.score;
    press(game);
    assert.equal(game.state.score, score, 'used switches cannot award points twice');
  }
  assert.equal(world.enemy.active, true, 'full route exercised live pursuit');
  assert.ok(world.enemy.speed < world.player.speed);
  assert.equal(game.state.score, 750);
  advance(game,4.5);
  // Circle around the approaching mascot before returning through the doorway.
  walkTo(game,{x:2.4,z:-9},.2);walkTo(game,{x:2.4,z:-7},.2);walkTo(game,{x:0,z:-6.7},.2);walkTo(game,{x:0,z:-5},.2);
  walkTo(game, world.exit, 1.25, {evade:true});
  assert.equal(game.state.phase, 'LEVEL_2', 'walking into exit does not win');
  press(game);
  assert.equal(game.state.phase, 'WIN');
  assert.equal(game.state.score, 1050);
  assert.equal(game.state.display.score, '1050');
  assert.equal(game.state.display.resultTitle, 'YOU ESCAPED');
  assert.equal(game.state.awards.length, 10);
  assert.equal(new Set(game.state.awards).size, 10);
  const enemyAtWin = structuredClone(world.enemy);
  const timerAtWin = game.state.timeLeft;
  advance(game, 5, intent({ interact: true, movement: { x: 1, z: 1 } }));
  assert.equal(game.state.score, 1050);
  assert.equal(game.state.timeLeft, timerAtWin);
  assert.deepEqual(world.enemy, enemyAtWin);
  game.update(.05, intent({ restart: true }));
  assert.equal(game.state.phase, 'TITLE');
  assert.equal(game.state.score, 0);
  assert.equal(game.state.world.level, 1);
  assert.deepEqual(game.state.awards, []);
});

test('first switch warns immediately and enemy activates once after exactly three active seconds', () => {
  const game = levelTwoFixture();
  const world = game.state.world;
  walkTo(game, world.switches[0]);
  press(game);
  assert.equal(world.enemy.spawnIn, 3);
  assert.equal(world.enemy.active, false);
  assert.equal(world.enemy.wakeElapsed, 0);
  assert.deepEqual(game.state.events.map(({ type, id }) => ({ type, id })), [{ type: 'switch.disabled', id: 'switch-1' }]);
  assert.match(game.state.message.text, /mascot wakes in 3 seconds/);
  advance(game, 2.95);
  assert.equal(world.enemy.active, false);
  game.setPaused(true);
  const pausedEnemy = structuredClone(world.enemy);
  advance(game, 30);
  assert.deepEqual(world.enemy, pausedEnemy);
  game.setPaused(false);
  game.update(.05);
  assert.equal(world.enemy.active, true);
  assert.equal(world.enemy.spawnIn, null);
  near(world.enemy.wakeElapsed, 0);
  assert.deepEqual(game.state.events.map(event => event.type), ['enemy.spawned']);
  assert.match(game.state.message.text, /mascot is awake/);
  assert.deepEqual(updateEnemy(world, 0), [], 'spawn event cannot repeat');
  game.update(.05);
  near(world.enemy.wakeElapsed, .05);
  assert.deepEqual(game.state.events, [], 'wake cue cannot repeat on the next pursuit frame');
});

test('enemy fallback picks the farthest corner, pursuit speed stays below helper, and contact uses radii', () => {
  const world = createWorld(2);
  world.switchCount = 1;
  world.enemy.spawnIn = 3;
  world.player.x = world.enemy.x;
  world.player.z = world.enemy.z;
  assert.deepEqual(updateEnemy(world, 3), [{ type: 'enemy.spawned' }]);
  const cornerX = ROOM.width / 2 - world.enemy.radius - .3;
  const cornerZ = ROOM.depth / 2 - world.enemy.radius - .3;
  assert.equal(world.enemy.x, -cornerX);
  assert.equal(world.enemy.z, -cornerZ);
  assert.equal(isCaptured(world), false);
  for (const [switchCount, speed] of [[1, 2.3], [2, 2.5], [3, 2.7]]) {
    world.switchCount = switchCount;
    world.colliders=[]; world.hidingSpots=[];
    world.enemy.heading=-Math.PI/2;world.enemy.repath=0;world.enemy.path=[];world.enemy.mode='chase';world.enemy.lastSeen={x:5,z:0};world.enemy.searchTime=-100;
    world.enemy.x = -5;
    world.enemy.z = 0;
    world.player.x = 5;
    world.player.z = 0;
    updateEnemy(world, .1);
    near(world.enemy.x, -5 + speed * .1);
    near(world.enemy.speed, speed);
    assert.ok(world.enemy.speed < world.player.speed);
  }
  world.player.x = 0;
  world.player.z = 0;
  world.enemy.x = world.player.radius + world.enemy.radius;
  assert.equal(isCaptured(world), true);
  world.enemy.x += .0001;
  assert.equal(isCaptured(world), false);
  world.enemy.active = false;
  world.enemy.x = 0;
  assert.equal(isCaptured(world), false);
});

test('capture starts its cinematic and timeout wins immediately over capture or escape without a bonus', () => {
  for (const failure of ['capture', 'timeout', 'both']) {
    const game = levelTwoFixture();
    const world = game.state.world;
    world.switches.forEach(control => { control.disabled = true; });
    world.switchCount = 3;
    world.exit.unlocked = true;
    game.state.score = 750;
    game.state.awards.push('switch:switch-1', 'switch:switch-2', 'switch:switch-3');
    world.player.x = world.exit.x;
    world.player.z = world.exit.z;
    if (failure !== 'timeout') {
      world.enemy.active = true;
      world.enemy.x = world.player.x;
      world.enemy.z = world.player.z;
    }
    if (failure !== 'capture') game.state.timeLeft = .025;
    press(game);
    assert.equal(game.state.phase, failure === 'capture' ? 'CAPTURE' : 'LOSE', failure);
    assert.equal(game.state.score, 750, failure);
    assert.equal(game.state.awards.includes('escape'), false, failure);
    if (failure === 'capture') {
      assert.deepEqual(game.state.capture.player, { x: world.player.x, z: world.player.z, yaw: world.player.yaw, pitch: world.player.pitch });
      assert.deepEqual(game.state.capture.enemy, { x: world.enemy.x, z: world.enemy.z });
      advance(game, 8);
      assert.equal(game.state.phase, 'LOSE');
      assert.equal(game.state.display.resultTitle, 'YOU WERE CAUGHT');
      assert.match(game.state.reason, /caught/i);
    } else assert.match(game.state.reason, /Time ran out/);
  }
});

test('used switches and former level 1 toys are excluded from level 2 targeting', () => {
  const world = createWorld(2, { controlOrder: CONTROL_ORDER });
  world.player.x = world.toys[0].x;
  world.player.z = world.toys[0].z;
  assert.equal(selectTarget(world), null);
  const control = world.switches[0];
  world.player.x = control.x;
  world.player.z = control.z;
  const target = selectTarget(world);
  assert.equal(target.kind, 'switch');
  assert.deepEqual(interact(world, target), [{ type: 'switch.disabled', id: control.id }]);
  assert.deepEqual(interact(world, target), []);
  assert.equal(selectTarget(world), null);
  assert.equal(world.switchCount, 1);
  assert.equal(world.enemy.spawnIn, 3);
});

test('capture freezes positions, timer, score, torch, and all gameplay controls until exactly 6.2 active seconds', () => {
  const game = captureFixture();
  const snapshot = structuredClone(game.state);
  assert.equal(snapshot.phaseElapsed, 0);
  assert.equal(snapshot.capture.player.x, snapshot.world.player.x);
  assert.equal(snapshot.capture.enemy.z, snapshot.world.enemy.z);
  assert.notEqual(game.state.capture.player, game.state.world.player);
  assert.notEqual(game.state.capture.enemy, game.state.world.enemy);
  assert.deepEqual(snapshot.events.map(event => [event.type, event.id]), [['phase.changed', 'CAPTURE']]);
  const noisyInput = intent({ movement: { x: 1, z: -1 }, look: { x: 900, y: 900 }, turn: { x: 1, y: 1 }, interact: true, primary: true, restart: true, torch: true });
  advance(game, 6.15, noisyInput);
  assert.equal(game.state.phase, 'CAPTURE');
  near(game.state.phaseElapsed, 6.15);
  assert.deepEqual(game.state.world, snapshot.world);
  assert.deepEqual(game.state.capture, snapshot.capture);
  assert.equal(game.state.timeLeft, snapshot.timeLeft);
  assert.equal(game.state.score, snapshot.score);
  assert.equal(game.state.torchOn, snapshot.torchOn);
  assert.deepEqual(game.state.awards, snapshot.awards);
  assert.deepEqual(game.state.events, [], 'capture entry event does not repeat');
  game.dispatch('start');
  game.dispatch('restart');
  assert.equal(game.state.phase, 'CAPTURE', 'menu intents cannot skip the capture');
  game.setPaused(true);
  const paused = structuredClone(game.state);
  advance(game, 20, noisyInput);
  assert.deepEqual(game.state, paused);
  game.setPaused(false);
  game.update(.05, noisyInput);
  assert.equal(game.state.phase, 'LOSE', '6.20 seconds completes without an extra frame');
  assert.equal(game.state.display.resultTitle, 'YOU WERE CAUGHT');
  assert.deepEqual(game.state.world, snapshot.world);
  assert.equal(game.state.timeLeft, snapshot.timeLeft);
  assert.equal(game.state.score, snapshot.score);
  assert.deepEqual(game.state.events.map(event => [event.type, event.id]), [['phase.changed', 'LOSE']]);
  game.dispatch('restart');
  assert.equal(game.state.capture, null);
  assert.equal(game.state.phase, 'TITLE');
  assert.equal(game.state.world.completedTasks, 0);
  assert.ok(game.state.world.tasks.every(task => !task.done));
  assert.equal(game.state.world.enemy.active, false);
});

test('cleanup worlds own their task state and decorative toy or shelf targets cannot perform work', () => {
  const first = createWorld(1);
  const second = createWorld(1);
  assert.deepEqual(first.tasks.map(task => task.kind), ['spill', 'spill', 'rubbish', 'chair', 'books', 'blocks']);
  assert.deepEqual(first.tasks.map(({ x, z }) => [x, z]), [[-4.3, 2.7], [0, .8], [4.6, 2.2], [-5, -2], [0, -4.3], [4, -4.3]]);
  const task = first.tasks[0];
  first.player.x = task.x;
  first.player.z = task.z;
  const target = selectTarget(first);
  assert.equal(target.kind, 'task');
  assert.deepEqual(interact(first, { ...target, kind: 'toy' }), []);
  assert.deepEqual(interact(first, { ...target, kind: 'shelf' }), []);
  assert.equal(first.completedTasks, 0);
  assert.deepEqual(interact(first, target), [{ type: 'task.completed', id: task.id }]);
  assert.equal(second.tasks[0].done, false);
  assert.equal(second.completedTasks, 0);
  assert.equal(first.player.carriedToyId, null);
  assert.equal(first.toys[0].status, 'floor');
});

test('held E cannot complete a second eligible cleanup job until released and pressed again', () => withDOM(({ window }) => {
  const game = levelOne();
  const world = game.state.world;
  world.player.x = world.player.z = 0;
  Object.assign(world.tasks[0], { x: 0, z: -.5 });
  Object.assign(world.tasks[1], { x: 0, z: -1 });
  const input = createInput();
  window.emit('keydown', { code: 'KeyE' });
  game.update(.05, input.read());
  assert.equal(world.completedTasks, 1);
  assert.equal(game.state.score, 50);
  for (let frame = 0; frame < 8; frame++) {
    window.emit('keydown', { code: 'KeyE', repeat: true });
    game.update(.05, input.read());
  }
  assert.equal(world.completedTasks, 1);
  assert.equal(game.state.score, 50);
  assert.equal(world.tasks[1].done, false);
  window.emit('keyup', { code: 'KeyE' });
  window.emit('keydown', { code: 'KeyE' });
  game.update(.05, input.read());
  assert.equal(world.completedTasks, 2);
  assert.equal(game.state.score, 100);
  input.dispose();
}));

test('restart from either result clears every run field while preserving outer state identity and pause', () => {
  for (const phase of ['WIN', 'LOSE']) {
    const game = createGame();
    const identity = game.state;
    Object.assign(game.state, { phase, score: 1050, timeLeft: 13, phaseElapsed: 18, elapsed: 140, reason: 'old failure', awards: ['escape'], message: { text: 'old', remaining: 3 }, cinematic: getCinematic('INTRO', 3), target: { id: 'old' }, world: createWorld(2) });
    game.state.world.player.carriedToyId = 'bear';
    game.state.world.switches.forEach(item => { item.disabled = true; });
    game.state.world.enemy.active = true;
    game.state.world.enemy.spawnIn = 1;
    game.state.world.player.yaw = 2;
    game.state.world.player.pitch = 1;
    game.state.world.player.distanceWalked = 100;
    game.state.torchOn = false;
    game.state.muted = true;
    game.state.pointerLocked = true;
    game.state.events = [{ type: 'old', serial: 99 }];
    game.state.world.tasks[0].done = true;
    game.state.world.completedTasks = 6;
    game.state.capture = { player: { x: 2, z: 3, yaw: 1, pitch: .5 }, enemy: { x: 2, z: 3 } };
    game.setPaused(true);
    game.dispatch('restart');
    assert.equal(game.state, identity);
    const fresh = createGame().state;
    fresh.paused = true;
    assert.ok([0,1,2].includes(game.state.world.secret.targetIndex));
    fresh.world.secret.targetIndex = game.state.world.secret.targetIndex;
    fresh.world.enemy.seed=game.state.world.enemy.seed;
    assert.deepEqual([...game.state.world.controlOrder].sort(), CONTROL_ORDER);
    fresh.world.controlOrder = [...game.state.world.controlOrder];
    fresh.muted = true;
    assert.deepEqual(game.state, fresh);
  }
});

test('E is one physical press, is consumed without a target, and ignores repeats', () => withDOM(({ window }) => {
  const input = createInput();
  window.emit('keydown', { code: 'KeyE' });
  assert.equal(input.read().interact, true);
  assert.equal(input.read().interact, false);
  window.emit('keydown', { code: 'KeyE', repeat: true });
  window.emit('keydown', { code: 'KeyE', repeat: false });
  assert.equal(input.read().interact, false);
  window.emit('keyup', { code: 'KeyE' });
  window.emit('keydown', { code: 'KeyE' });
  assert.equal(input.read().interact, true);
  input.dispose();
}));

test('camera-relative forward and strafe movement follow yaw, preserve facing, and normalize diagonal speed', () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    for (const movement of [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 1, z: -1 }]) {
      const game = levelOne();
      const player = game.state.world.player;
      player.x = player.z = 0;
      game.update(0, intent({ look: { x: -yaw / .0022, y: 0 } }));
      const facing = structuredClone(player.facing);
      game.update(.05, intent({ movement }));
      const scale = Math.max(1, Math.hypot(movement.x, movement.z));
      near(player.x, (Math.cos(yaw) * movement.x + Math.sin(yaw) * movement.z) / scale * .2);
      near(player.z, (-Math.sin(yaw) * movement.x + Math.cos(yaw) * movement.z) / scale * .2);
      near(Math.hypot(player.x, player.z), .2);
      near(player.distanceWalked, .2);
      assert.deepEqual(player.facing, facing, 'strafe must not turn the camera or interaction cone');
    }
  }
});

test('look direction, keyboard turn rate, pitch limits, and invalid deltas keep a finite camera pose', () => {
  const game = levelOne();
  const player = game.state.world.player;
  game.update(.05, intent({ look: { x: 100, y: -100 } }));
  near(player.yaw, -.22);
  near(player.pitch, .22);
  assert.ok(player.facing.x > 0, 'mouse right looks toward world +X');
  game.update(.05, intent({ turn: { x: -1, y: 1 } }));
  near(player.yaw, -.22 + 1.65 * .05);
  near(player.pitch, .22 + 1.1 * .05);
  game.update(0, intent({ look: { x: 100000, y: -100000 } }));
  assert.ok(player.yaw >= -Math.PI && player.yaw <= Math.PI);
  assert.equal(player.pitch, 1.22);
  game.update(0, intent({ look: { x: 0, y: 100000 } }));
  assert.equal(player.pitch, -1.22);
  const pose = structuredClone(player);
  game.update(.05, intent({ look: { x: NaN, y: Infinity }, turn: { x: Infinity, y: NaN }, movement: { x: NaN, z: Infinity } }));
  near(player.yaw, pose.yaw);
  near(player.pitch, pose.pitch);
  near(player.x, pose.x);
  near(player.z, pose.z);
});

test('interaction rejects a closer object behind the player and revalidates stale facing before E', () => {
  const game = levelOne();
  const world = game.state.world;
  world.player.x = world.player.z = 0;
  Object.assign(world.tasks.find(task => task.id === 'spill-2'), { x: 0, z: .6 });
  Object.assign(world.tasks.find(task => task.id === 'spill-1'), { x: 0, z: -1 });
  const front = selectTarget(world);
  assert.equal(front.id, 'spill-1');
  game.update(0, intent({ look: { x: -Math.PI / .0022, y: 0 } }));
  assert.equal(game.state.target.id, 'spill-2');
  assert.deepEqual(interact(world, front), [], 'old prompt cannot collect an object now behind the camera');
  press(game);
  assert.equal(world.tasks.find(task => task.id === 'spill-2').done, true);
  assert.equal(world.tasks.find(task => task.id === 'spill-1').done, false);
  assert.equal(world.completedTasks, 1);
});

test('sixth job corrupts the room immediately and preserves first-person pose and torch through reveal', () => {
  const game = levelOne();
  game.update(.05, intent({ torch: true, look: { x: 0, y: -150 } }));
  const world = game.state.world;
  for (const task of world.tasks) {
    walkTo(game, task); press(game);
  }
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  assert.equal(game.state.cinematic.corruption, 1, 'no pre-corruption reveal frames');
  assert.equal(game.state.phaseElapsed, 0);
  assert.deepEqual(game.state.events.map(event => event.type), ['task.completed', 'phase.changed']);
  assert.equal(game.state.events[1].id, 'LEVEL_TRANSITION');
  const pose = structuredClone(world.player);
  const remaining = game.state.timeLeft;
  advance(game, 1.3, intent({ torch: true, look: { x: 400, y: 400 }, turn: { x: 1, y: 1 }, movement: { x: 1, z: 1 }, interact: true }));
  assert.deepEqual(world.player, pose);
  assert.equal(game.state.timeLeft, remaining);
  assert.equal(game.state.torchOn, false);
  game.update(.05);
  assert.equal(game.state.phase, 'LEVEL_2');
  for (const key of ['x', 'z', 'yaw', 'pitch', 'distanceWalked', 'facing']) assert.deepEqual(game.state.world.player[key], pose[key], key);
  assert.notEqual(game.state.world.player.facing, pose.facing);
  assert.equal(game.state.torchOn, false);
  assert.equal(game.state.timeLeft, 120);
  assert.equal(game.state.score, 300);
});

test('torch is gated by gameplay, mute remains usable during pause, and event serials are consumed per frame', () => {
  const game = createGame();
  game.update(.05, intent({ torch: true }));
  assert.equal(game.state.torchOn, true);
  assert.deepEqual(game.state.events, []);
  game.dispatch('start');
  assert.deepEqual(game.state.events, [{ type: 'phase.changed', id: 'INTRO', serial: 1 }]);
  advance(game, 15);
  assert.deepEqual(game.state.events, [{ type: 'phase.changed', id: 'LEVEL_1', serial: 2 }]);
  game.update(.05, intent({ torch: true }));
  assert.equal(game.state.torchOn, false);
  assert.deepEqual(game.state.events, [{ type: 'torch.toggled', id: 'off', serial: 3 }]);
  game.update(.05);
  assert.deepEqual(game.state.events, []);
  walkTo(game, game.state.world.tasks.find(task => task.id === 'spill-2'));
  press(game);
  assert.deepEqual(game.state.events, [{ type: 'task.completed', id: 'spill-2', serial: 4 }]);
  press(game);
  assert.deepEqual(game.state.events, [], 'duplicate E cannot repeat a cleanup cue');
  game.setPaused(true);
  const timer = game.state.timeLeft;
  game.update(.05, intent({ mute: true, torch: true, movement: { x: 1, z: 1 } }));
  assert.equal(game.state.muted, true);
  assert.equal(game.state.torchOn, false);
  assert.equal(game.state.timeLeft, timer);
  assert.deepEqual(game.state.events, []);
  game.state.phase = 'LOSE';
  game.dispatch('restart');
  assert.equal(game.state.torchOn, true);
  assert.equal(game.state.muted, true, 'audio preference survives a new run');
  game.setPaused(false);
  game.dispatch('start');
  assert.deepEqual(game.state.events, [{ type: 'phase.changed', id: 'INTRO', serial: 1 }]);
});

test('F, M, and Escape are one-shot intents and arrow look is separate from normalized movement', () => withDOM(({ window }) => {
  const input = createInput();
  for (const [code, key] of [['KeyF', 'torch'], ['KeyM', 'mute'], ['Escape', 'escape']]) {
    window.emit('keydown', { code });
    assert.equal(input.read()[key], true);
    assert.equal(input.read()[key], false);
    window.emit('keydown', { code, repeat: true });
    window.emit('keydown', { code });
    assert.equal(input.read()[key], false);
    window.emit('keyup', { code });
    window.emit('keydown', { code });
    assert.equal(input.read()[key], true);
  }
  input.clear();
  for (const code of ['ArrowRight', 'ArrowUp', 'KeyW', 'KeyQ']) window.emit('keydown', { code });
  assert.deepEqual(input.read(), intent({ movement: { x: 0, z: -1 }, turn: { x: 1, y: 1 } }));
  for (const code of ['ArrowLeft', 'KeyZ']) window.emit('keydown', { code });
  assert.deepEqual(input.read().turn, { x: 0, y: 0 });
  input.dispose();
}));

test('mouse drag works without pointer lock, consumes deltas once, and ignores outside or disabled gestures', () => withDOM(({ window, surface }) => {
  let gestures = 0;
  const input = createInput({ onGesture() { gestures++; } });
  input.setLookEnabled(true);
  window.emit('mousemove', { movementX: 5, movementY: 2 });
  window.emit('mousedown', { target: { tagName: 'BUTTON' }, button: 0 });
  window.emit('mousemove', { movementX: 5, movementY: 2 });
  window.emit('mousedown', { target: surface, button: 2 });
  assert.deepEqual(input.read().look, { x: 0, y: 0 });
  window.emit('mousedown', { target: surface, button: 0 });
  window.emit('mousemove', { movementX: 12, movementY: -5 });
  window.emit('mousemove', { movementX: 3, movementY: 2 });
  window.emit('mousemove', { movementX: NaN, movementY: Infinity });
  assert.deepEqual(input.read().look, { x: 15, y: -3 });
  assert.deepEqual(input.read().look, { x: 0, y: 0 });
  assert.equal(gestures, 1);
  window.emit('mouseup');
  window.emit('mousemove', { movementX: 12, movementY: -5 });
  assert.deepEqual(input.read().look, { x: 0, y: 0 });
  window.emit('mousedown', { target: surface, button: 0 });
  window.emit('mousemove', { movementX: 12, movementY: -5 });
  input.setLookEnabled(false);
  window.emit('mousemove', { movementX: 12, movementY: -5 });
  assert.deepEqual(input.read().look, { x: 0, y: 0 });
  input.dispose();
}));

test('pointer lock accepts movement, clears stale deltas on changes, and releases when disposed', () => withDOM(({ window, document, surface }) => {
  const changes = [];
  let requests = 0;
  surface.requestPointerLock = () => { requests++; document.pointerLockElement = surface; document.emit('pointerlockchange'); };
  const input = createInput({ onPointerLockChange: value => changes.push(value) });
  input.setLookEnabled(true);
  input.requestPointerLock();
  input.requestPointerLock();
  assert.equal(requests, 1, 'already-locked requests do nothing');
  assert.equal(input.isPointerLocked(), true);
  window.emit('mousemove', { movementX: -8, movementY: 4 });
  assert.deepEqual(input.read().look, { x: -8, y: 4 });
  window.emit('mousemove', { movementX: 9, movementY: 9 });
  input.releasePointerLock();
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual(input.read().look, { x: 0, y: 0 });
  input.requestPointerLock();
  input.dispose();
  assert.equal(document.pointerLockElement, null);
  assert.equal(window.total() + document.total(), 0);
  input.requestPointerLock();
  assert.equal(requests, 2, 'disposed input cannot acquire lock again');
}));

test('denied pointer lock preserves drag fallback and blur clears mouse, turn, and pending actions', () => withDOM(({ window, document, surface }) => {
  const changes = [];
  surface.requestPointerLock = () => { throw new Error('Pointer lock unsupported'); };
  const input = createInput({ onPointerLockChange: value => changes.push(value) });
  input.setLookEnabled(true);
  window.emit('mousedown', { target: surface, button: 0 });
  window.emit('mousemove', { movementX: 6, movementY: -4 });
  assert.deepEqual(input.read().look, { x: 6, y: -4 });
  assert.deepEqual(changes, [false]);
  for (const code of ['ArrowRight', 'KeyF', 'KeyM', 'Escape']) window.emit('keydown', { code });
  window.emit('mousemove', { movementX: 6, movementY: -4 });
  document.focused = false;
  window.emit('blur');
  assert.deepEqual(input.read(), intent());
  document.focused = true;
  window.emit('focus');
  window.emit('mousemove', { movementX: 6, movementY: -4 });
  assert.deepEqual(input.read(), intent(), 'focus does not restore a previous drag or held keys');
  input.dispose();
}));

test('held E cannot leak through clear/phase changes until a fresh press', () => withDOM(({ window }) => {
  const input = createInput();
  window.emit('keydown', { code: 'KeyE' });
  assert.equal(input.read().interact, true);
  input.clear();
  for (let count = 0; count < 3; count++) window.emit('keydown', { code: 'KeyE', repeat: true });
  assert.equal(input.read().interact, false);
  window.emit('keyup', { code: 'KeyE' });
  window.emit('keydown', { code: 'KeyE' });
  assert.equal(input.read().interact, true);
  input.dispose();
}));

test('diagonal input normalizes, aliases do not double speed, and arrows prevent scrolling', () => withDOM(({ window }) => {
  const input = createInput();
  assert.equal(window.emit('keydown', { code: 'ArrowRight' }).prevented, true);
  window.emit('keydown', { code: 'KeyD' });
  window.emit('keydown', { code: 'KeyW' });
  const movement = input.read().movement;
  near(Math.hypot(movement.x, movement.z), 1);
  near(movement.x, Math.SQRT1_2);
  near(movement.z, -Math.SQRT1_2);
  window.emit('keydown', { code: 'KeyA' });
  assert.equal(input.read().movement.x, 0);
  input.dispose();
}));

test('blur and visibility loss clear movement/actions; focus returns with empty input', () => withDOM(({ window, document }) => {
  const changes = [];
  const input = createInput({ onFocusChange: value => changes.push(value) });
  window.emit('keydown', { code: 'KeyD' });
  window.emit('keydown', { code: 'KeyE' });
  document.focused = false;
  window.emit('blur');
  assert.deepEqual(input.read(), intent());
  window.emit('keydown', { code: 'KeyE' });
  assert.equal(input.read().interact, false);
  document.focused = true;
  window.emit('focus');
  assert.deepEqual(input.read(), intent());
  window.emit('keydown', { code: 'KeyW' });
  document.hidden = true;
  document.emit('visibilitychange');
  assert.deepEqual(input.read(), intent());
  assert.deepEqual(changes.slice(-3), [false, true, false]);
  input.dispose();
}));

test('modified shortcuts and editable text do not create game intents', () => withDOM(({ window }) => {
  const input = createInput();
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { target: { tagName: 'INPUT' } }, { target: { isContentEditable: true } }]) {
    window.emit('keydown', { code: 'KeyE', ...options });
    assert.equal(input.read().interact, false);
  }
  input.dispose();
}));

test('input disposal is idempotent and removes all ten input listeners', () => withDOM(({ window, document }) => {
  const input = createInput();
  assert.equal(window.total() + document.total(), 10);
  input.dispose();
  input.dispose();
  assert.equal(window.total() + document.total(), 0);
  window.emit('keydown', { code: 'KeyE' });
  assert.deepEqual(input.read(), intent());
}));

function runMain(env, { failRender = false } = {}) {
  let game;
  let onAction;
  let nextId = 0;
  const raf = new Map();
  const count = { sceneCreated: 0, renders: 0, sceneDisposed: 0, uiDisposed: 0, audioCreated: 0, audioDisposed: 0, audioUpdates: 0, audioUnlocks: 0 };
  const audio = { muted: false, volume: .5, frames: [] };
  const errors = [];
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
  runInNewContext(source, {
    window: env.window, document: env.document,
    createGame() { return game = createGame(); }, createInput,
    createAudio() {
      count.audioCreated++;
      let disposed = false;
      return {
        unlock() { count.audioUnlocks++; },
        update(state, dt) { count.audioUpdates++; audio.muted = state.muted; audio.frames.push({ phase: state.phase, paused: state.paused, events: structuredClone(state.events), dt }); },
        setMuted(value) { audio.muted = value; }, setVolume(value) { audio.volume = value; },
        dispose() { if (!disposed) { disposed = true; count.audioDisposed++; } },
      };
    },
    createScene() { count.sceneCreated++; return { resize() {}, sync() {}, render() { count.renders++; if (failRender) throw new Error('Injected renderer failure'); }, dispose() { count.sceneDisposed++; } }; },
    createUI(options) { onAction = options.onAction; return { update() {}, showError(message) { errors.push(message); }, dispose() { count.uiDisposed++; } }; },
    requestAnimationFrame(callback) { const id = ++nextId; raf.set(id, callback); return id; },
    cancelAnimationFrame(id) { raf.delete(id); }, console: { error: error => errors.push(error.message) },
  }, { filename: 'main.js (Node mock DOM)' });
  return { game, count, errors, raf, audio, action: (action, value) => onAction(action, value), frame(time) { const entry = raf.entries().next().value; assert.ok(entry, 'one animation frame should be pending'); raf.delete(entry[0]); entry[1](time); } };
}

test('main startup propagates an initially unfocused/hidden document to coordinator pause', () => {
  for (const options of [{ focused: false }, { hidden: true }]) withDOM(env => {
    const app = runMain(env);
    assert.deepEqual(app.errors, []);
    assert.equal(app.game.state.paused, true, 'Initial focus state must reach game.setPaused before any animation');
  }, options);
});

test('main keeps one RAF/listener set across repeated resets and disposes once on pagehide', () => withDOM(env => {
  const app = runMain(env);
  const listenerCount = env.window.total() + env.document.total();
  for (let run = 0; run < 20; run++) {
    app.game.state.phase = run % 2 ? 'WIN' : 'LOSE';
    app.game.state.score = 1050;
    env.window.emit('keydown', { code: 'KeyE' });
    app.action('restart');
    app.frame(run * 20);
    assert.equal(app.game.state.phase, 'TITLE');
    assert.equal(app.game.state.score, 0);
    assert.equal(app.raf.size, 1);
    assert.equal(env.window.total() + env.document.total(), listenerCount);
  }
  assert.equal(app.count.sceneCreated, 1);
  assert.equal(app.count.audioCreated, 1);
  assert.deepEqual(app.errors, []);
  env.window.emit('pagehide');
  assert.equal(app.raf.size, 0);
  assert.equal(env.window.total() + env.document.total(), 0);
  assert.equal(app.count.sceneDisposed, 1);
  assert.equal(app.count.uiDisposed, 1);
  assert.equal(app.count.audioDisposed, 1);
  env.window.emit('pagehide');
  assert.equal(app.count.sceneDisposed, 1);
}));

test('main resets frame timing on focus return instead of applying hidden elapsed time', () => withDOM(env => {
  const app = runMain(env);
  app.action('start');
  app.game.state.phaseElapsed = 15;
  app.frame(0);
  assert.equal(app.game.state.phase, 'LEVEL_1');
  app.frame(50);
  const timeLeft = app.game.state.timeLeft;
  env.document.focused = false;
  env.window.emit('blur');
  app.frame(100000);
  assert.equal(app.game.state.timeLeft, timeLeft);
  env.document.focused = true;
  env.window.emit('focus');
  app.frame(200000);
  assert.equal(app.game.state.timeLeft, timeLeft);
  app.frame(200050);
  near(app.game.state.timeLeft, timeLeft - .05);
  env.window.emit('pagehide');
}));

test('fatal frame failure releases keyboard listeners so the error-screen button can receive Enter', () => withDOM(env => {
  const app = runMain(env, { failRender: true });
  app.frame(0);
  assert.equal(app.raf.size, 0, 'fatal error stops the animation loop');
  assert.ok(app.errors.some(message => /playroom stopped.*Injected renderer failure/i.test(message)));
  const key = env.window.emit('keydown', { code: 'Enter', target: { tagName: 'BUTTON' } });
  assert.equal(key.prevented, false, 'native Enter activation must reach the recovery button');
  assert.equal(env.window.count('keydown'), 0, 'fatal error disposes game keyboard listeners');
  env.window.emit('pagehide');
}));

test('Escape pauses an active run and Enter resumes without hidden elapsed time or carried inputs', () => withDOM(env => {
  const app = runMain(env);
  app.action('start');
  app.game.state.phaseElapsed = 15;
  app.frame(0);
  app.frame(50);
  const before = structuredClone(app.game.state.world.player);
  const timer = app.game.state.timeLeft;
  for (const code of ['KeyW', 'KeyE', 'Escape']) env.window.emit('keydown', { code });
  app.frame(100);
  assert.equal(app.game.state.paused, true);
  assert.equal(app.game.state.timeLeft, timer);
  assert.deepEqual(app.game.state.world.player, before);
  app.frame(10000);
  assert.equal(app.game.state.timeLeft, timer);
  env.window.emit('keydown', { code: 'Enter' });
  app.frame(10050);
  assert.equal(app.game.state.paused, false);
  assert.equal(app.game.state.phase, 'LEVEL_1');
  assert.deepEqual(app.game.state.world.player, before);
  assert.equal(app.game.state.world.player.carriedToyId, null);
  assert.ok(app.game.state.timeLeft >= timer - .05 - 1e-9, 'resume uses at most the current frame delta');
  env.window.emit('pagehide');
}));

test('losing pointer lock pauses an active run and the resume action works without lock support', () => withDOM(env => {
  const app = runMain(env);
  app.action('start');
  app.game.state.phaseElapsed = 15;
  app.frame(0);
  env.document.pointerLockElement = env.surface;
  env.document.emit('pointerlockchange');
  app.frame(50);
  assert.equal(app.game.state.pointerLocked, true);
  const timer = app.game.state.timeLeft;
  env.document.exitPointerLock();
  assert.equal(app.game.state.paused, true);
  assert.equal(app.game.state.pointerLocked, false);
  app.frame(20000);
  assert.equal(app.game.state.timeLeft, timer);
  app.action('resume');
  assert.equal(app.game.state.paused, false);
  app.frame(30000);
  assert.equal(app.game.state.timeLeft, timer);
  app.frame(30050);
  near(app.game.state.timeLeft, timer - .05);
  env.window.emit('pagehide');
}));

test('main routes audio gestures, mute, volume, and semantic events without adding another frame loop', () => withDOM(env => {
  const app = runMain(env);
  app.action('volume', .25);
  assert.equal(app.audio.volume, .25);
  app.action('start');
  app.game.state.phaseElapsed = 15;
  app.frame(0);
  assert.deepEqual(app.audio.frames.at(-1).events.map(event => event.id), ['LEVEL_1']);
  env.window.emit('keydown', { code: 'KeyF' });
  env.window.emit('keydown', { code: 'KeyM' });
  app.frame(50);
  assert.equal(app.audio.muted, true);
  assert.deepEqual(app.audio.frames.at(-1).events.map(event => event.type), ['torch.toggled']);
  app.frame(100);
  assert.deepEqual(app.audio.frames.at(-1).events, []);
  assert.ok(app.count.audioUnlocks >= 4);
  assert.equal(app.raf.size, 1);
  assert.equal(app.count.audioCreated, 1);
  env.window.emit('pagehide');
  assert.equal(app.count.audioDisposed, 1);
}));

test('focus loss synchronously pauses audio even when a hidden browser never executes another RAF', () => withDOM(env => {
  const app = runMain(env);
  app.action('start');
  app.game.state.phaseElapsed = 15;
  app.frame(0);
  app.frame(50);
  const audioUpdates = app.count.audioUpdates;
  const remaining = app.game.state.timeLeft;
  env.document.focused = false;
  env.window.emit('blur');
  assert.equal(app.game.state.paused, true);
  assert.equal(app.count.audioUpdates, audioUpdates + 1, 'focus event must reach audio without a new frame');
  assert.equal(app.audio.frames.at(-1).paused, true);
  assert.equal(app.audio.frames.at(-1).dt, 0);
  assert.equal(app.game.state.timeLeft, remaining);
  assert.equal(app.raf.size, 1, 'focus handling does not create an additional loop');
  env.window.emit('pagehide');
}));

test('main pauses capture on Escape and focus loss, then resumes its timeline without moving the captured actors', () => withDOM(env => {
  const app = runMain(env);
  app.action('start');
  app.game.state.phase = 'LEVEL_2';
  const world = app.game.state.world = createWorld(2);
  world.enemy.active = true;
  world.enemy.x = world.player.x;
  world.enemy.z = world.player.z;
  app.frame(0);
  assert.equal(app.game.state.phase, 'CAPTURE');
  const actors = structuredClone(world);
  const timer = app.game.state.timeLeft;
  env.window.emit('keydown', { code: 'Escape' });
  app.frame(50);
  assert.equal(app.game.state.paused, true);
  app.frame(15000);
  assert.equal(app.game.state.phaseElapsed, 0);
  assert.equal(app.audio.frames.at(-1).paused, true);
  env.window.emit('keydown', { code: 'Enter' });
  app.frame(15050);
  assert.equal(app.game.state.paused, false);
  assert.equal(app.game.state.phase, 'CAPTURE');
  near(app.game.state.phaseElapsed, .05);
  env.document.hidden = true;
  env.document.emit('visibilitychange');
  assert.equal(app.game.state.paused, true);
  assert.equal(app.audio.frames.at(-1).paused, true, 'capture audio pauses without waiting for RAF');
  app.frame(30000);
  near(app.game.state.phaseElapsed, .05);
  env.document.hidden = false;
  env.document.emit('visibilitychange');
  app.frame(40000);
  near(app.game.state.phaseElapsed, .05);
  app.frame(40050);
  near(app.game.state.phaseElapsed, .1);
  assert.deepEqual(world, actors);
  assert.equal(app.game.state.timeLeft, timer);
  assert.equal(app.raf.size, 1);
  env.window.emit('pagehide');
}));
