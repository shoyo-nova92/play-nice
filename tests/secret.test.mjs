import { walkTo, completeCleanupAndEscape } from './route-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, createWorld, selectTarget, interact, movePlayer, updateEnemy, isCaptured } from '../src/levels.js';
import { createGame } from '../src/game.js';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const intent = overrides => ({ movement: { x: 0, z: 0 }, ...overrides });
const BOOK_X = [-.65, 0, .65];
const LABELS = ['MOON', 'STAR', 'SUN'];
const CONTROLS = ['switch-1', 'switch-2', 'switch-3'];
const ORDERS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
].map(order => order.map(index => CONTROLS[index]));
function advance(game, seconds, input = intent()) {
  const count = Math.floor(seconds / .05 + 1e-8);
  for (let index = 0; index < count; index++) game.update(.05, input);
  const remaining = seconds - count * .05;
  if (remaining > 1e-8) game.update(remaining, input);
}
function gameFixture(level = 1, secretIndex = 1, controlOrder = CONTROLS) {
  const game = createGame();
  game.state.phase = `LEVEL_${level}`;
  const random = Math.random;
  try { Math.random = () => .42; game.state.world = createWorld(level, { secretIndex, controlOrder }); }
  finally { Math.random = random; }
  return game;
}
function openWorld() {
  const world = createWorld(1, { secretIndex: 0 });
  Object.assign(world.secret, { clueRead: true, open: true, slide: 1 });
  return world;
}
function approach(world, x, z) {
  Object.assign(world.player, { x, z: z === -5 ? -4.5 : z + .2, facing: { x: 0, z: -1 }, yaw: 0 });
}
test('secret state has deterministic fixtures, independently randomized runs, and no legacy toy shelves', () => {
  for (const index of [0, 1, 2]) {
    const world = createWorld(1, { secretIndex: index });
    assert.deepEqual(world.secret, { clueRead: false, targetIndex: index, open: false, slide: 0 });
    assert.deepEqual(world.shelves, []);
  }
  const random = Math.random;
  try {
    for (const [value, expected] of [[0, 0], [.34, 1], [.9999, 2]]) {
      Math.random = () => value;
      assert.equal(createWorld(1).secret.targetIndex, expected);
    }
  } finally { Math.random = random; }
  const first = createWorld(1, { secretIndex: 1 });
  const second = createWorld(1, { secretIndex: 1 });
  first.secret.open = true;
  assert.equal(second.secret.open, false);
  assert.equal(first.tasks.find(task => task.id === 'books').name, 'SHELVE BOOKS');
  assert.equal(first.tasks.find(task => task.id === 'blocks').name, 'STORE TOYS IN BASKET');
  for (const invalid of [-1, 3, .5, NaN]) assert.throws(() => createWorld(1, { secretIndex: invalid }), /secretIndex/);
});

test('journal and lever books work in both levels, but no lever is eligible before reading the clue', () => {
  for (const level of [1, 2]) {
    const world = createWorld(level, { secretIndex: 1 });
    approach(world, 0, -5);
    assert.notEqual(selectTarget(world)?.kind, 'secret-book');
    const fakeBook = { id: 'secret-book-1', kind: 'secret-book' };
    assert.deepEqual(interact(world, fakeBook), []);
    approach(world, -3, 2);
    const journal = selectTarget(world);
    assert.equal(journal.id, 'journal');
    assert.equal(journal.kind, 'journal');
    assert.deepEqual(interact(world, journal), [{ type: 'journal.read', id: 'journal' }]);
    assert.equal(world.secret.clueRead, true);
    assert.deepEqual(interact(world, journal), [{ type: 'journal.read', id: 'journal' }], 'the clue can be read again');
    world.tasks.find(task => task.id === 'books').done = true;
    for (const index of [0, 1, 2]) {
      approach(world, BOOK_X[index], -5);
      const book = selectTarget(world);
      assert.equal(book.id, `secret-book-${index}`);
      assert.equal(book.kind, 'secret-book');
      assert.equal(book.name, LABELS[index]);
    }
  }
});

test('every random clue has exactly one valid lever, wrong books retain the puzzle, and opening cannot repeat', () => {
  for (const correct of [0, 1, 2]) {
    const world = createWorld(1, { secretIndex: correct });
    world.secret.clueRead = true;
    world.tasks.find(task => task.id === 'books').done = true;
    for (const wrong of [0, 1, 2].filter(index => index !== correct)) {
      approach(world, BOOK_X[wrong], -5);
      const target = selectTarget(world);
      assert.deepEqual(interact(world, target), [{ type: 'secret.wrong', id: `secret-book-${wrong}` }]);
      assert.equal(world.secret.open, false);
      assert.equal(world.secret.slide, 0);
    }
    approach(world, BOOK_X[correct], -5);
    const target = selectTarget(world);
    assert.deepEqual(interact(world, target), [{ type: 'secret.opened', id: `secret-book-${correct}` }]);
    assert.equal(world.secret.open, true);
    assert.equal(world.secret.slide, 0, 'opening animation belongs to the authoritative game update');
    assert.notEqual(selectTarget(world)?.kind, 'secret-book');
    assert.deepEqual(interact(world, target), []);
    assert.equal(world.completedTasks, 0);
    assert.equal(world.switchCount, 0);
  }
});

test('secret interactions still revalidate distance, facing, and current eligibility', () => {
  const world = createWorld(1, { secretIndex: 2 });
  approach(world, -3, 2);
  const journal = selectTarget(world);
  world.player.facing = { x: 0, z: 1 };
  world.player.z = 2.5;
  assert.deepEqual(interact(world, journal), []);
  assert.equal(world.secret.clueRead, false);
  approach(world, -3, 2);
  interact(world, journal);
  approach(world, .65, -5);
  const book = selectTarget(world);
  world.player.z = -2;
  assert.deepEqual(interact(world, book), []);
  assert.equal(world.secret.open, false);
  approach(world, .65, -5);
  world.secret.clueRead = false;
  assert.deepEqual(interact(world, book), []);
});

test('closed or insufficiently moved bookcase blocks the front wall even at the doorway center', () => {
  for (const secret of [{ open: false, slide: 1 }, { open: true, slide: 0 }, { open: true, slide: .949999 }]) {
    const world = createWorld(1, { secretIndex: 0 }); world.colliders=[];world.hidingSpots=[];
    Object.assign(world.secret, secret);
    Object.assign(world.player, { x: 0, z: -5 });
    movePlayer(world, { x: 0, z: -1 }, 20);
    near(world.player.z, -5.65);
    near(world.player.x, 0);
  }
  const world = openWorld(); world.colliders=[];world.hidingSpots=[]; // Isolate wall/door collision from prop tests.
  world.secret.slide = .95;
  Object.assign(world.player, { x: 0, z: -5 });
  movePlayer(world, { x: 0, z: -1 }, 1);
  near(world.player.z, -9);
});

test('open passage permits return travel and preserves radius clearance at all hidden-room walls', () => {
  const world = openWorld(); world.colliders=[];world.hidingSpots=[]; // Isolate wall/door collision from prop tests.
  Object.assign(world.player, { x: 0, z: -5 });
  movePlayer(world, { x: 0, z: -1 }, 10);
  near(world.player.z, -10.65);
  movePlayer(world, { x: 1, z: 0 }, 10);
  near(world.player.x, 2.65);
  movePlayer(world, { x: -1, z: 0 }, 10);
  near(world.player.x, -2.65);
  movePlayer(world, { x: 1, z: 0 }, 2.65 / 4);
  near(world.player.x, 0);
  movePlayer(world, { x: 0, z: 1 }, 10);
  near(world.player.z, 5.65);
});

test('solid front wall blocks both directions outside the opening and doorway posts constrain sideways motion', () => {
  for (const side of [-1, 1]) {
    const world = openWorld(); world.colliders=[];world.hidingSpots=[]; // Isolate wall/door collision from prop tests.
    Object.assign(world.player, { x: side * 2, z: -5 });
    movePlayer(world, { x: 0, z: -1 }, 10);
    near(world.player.z, -5.65);
    Object.assign(world.player, { x: side * 2, z: -8 });
    movePlayer(world, { x: 0, z: 1 }, 10);
    near(world.player.z, -6.35);
    Object.assign(world.player, { x: 0, z: -6 });
    movePlayer(world, { x: side, z: 0 }, 10);
    near(world.player.x, side * 1.15);
    near(world.player.z, -6);
  }
});

test('swept movement cannot bypass a solid wall with a diagonal endpoint inside the secret room', () => {
  const world = openWorld(); world.colliders=[];world.hidingSpots=[]; // Isolate wall/door collision from prop tests.
  Object.assign(world.player, { x: 4, z: -5 });
  movePlayer(world, { x: -4, z: -3 }, 1.25); // Unclipped endpoint would be (0,-8).
  near(world.player.z, -5.65);
  assert.ok(world.player.x >= -1.15 && world.player.x <= 1.15, 'tangential sliding may reach the opening, but cannot cross this frame');
  movePlayer(world, { x: 0, z: -1 }, .5);
  assert.ok(world.player.z < -6.35, 'a later movement can cross when actually aligned');
  Object.assign(world.player, { x: 2, z: -8 });
  movePlayer(world, { x: 4, z: 3 }, 1.25); // Endpoint (6,-5) is main room, but crossing misses the doorway.
  assert.ok(world.player.z <= -6.35 + 1e-8);
  assert.ok(world.player.x <= 2.65 + 1e-8);
});

test('a valid diagonal through both doorway edges is allowed and ordinary room wall sliding remains intact', () => {
  const world = openWorld(); world.colliders=[];world.hidingSpots=[]; // Isolate wall/door collision from prop tests.
  Object.assign(world.player, { x: -2, z: -5 });
  movePlayer(world, { x: 4, z: -2 }, Math.hypot(4, 2) / 4);
  near(world.player.x, 2);
  near(world.player.z, -7);
  const closed = createWorld(1, { secretIndex: 0 });
  Object.assign(closed.player, { x: 0, z: 0 });
  movePlayer(closed, { x: 1, z: 1 }, 100);
  near(closed.player.x, 7.65);
  near(closed.player.z, 5.65);
});

test('enemy patrol routes through the doorway in both directions and detects a player it reaches', () => {
  for (const inward of [true, false]) {
    const world = createWorld(2, { secretIndex: 0 });
    Object.assign(world.secret, { clueRead: true, open: true, slide: 1 });
    Object.assign(world.enemy, { active: true, x: inward ? 6 : 1.5, z: inward ? -5 : -8 });
    Object.assign(world.player, { x: inward ? -1.5 : 6, z: inward ? -8 : -5 });
    world.enemy.patrolTarget = { x: world.player.x, z: world.player.z };
    let crossed = false;
    for (let tick = 0; tick < 800 && !isCaptured(world); tick++) {
      const previous = { x: world.enemy.x, z: world.enemy.z };
      updateEnemy(world, .05);
      const enemy = world.enemy;
      assert.ok(Math.hypot(enemy.x - previous.x, enemy.z - previous.z) <= enemy.speed * .05 + 1e-8, 'routing cannot teleport or exceed pursuit speed');
      if (enemy.z < -5.45 - 1e-8 && enemy.z > -6.55 + 1e-8) assert.ok(Math.abs(enemy.x) <= .95 + 1e-8, 'enemy radius must fit inside the doorway');
      if ((previous.z + 6) * (enemy.z + 6) <= 0 && previous.z !== enemy.z) {
        const fraction = (-6 - previous.z) / (enemy.z - previous.z);
        const crossingX = previous.x + (enemy.x - previous.x) * fraction;
        assert.ok(Math.abs(crossingX) <= .95 + 1e-8, 'wall crossing must occur inside the opening');
        crossed = true;
      }
    }
    assert.equal(crossed, true);
    assert.equal(isCaptured(world), true, 'patrol must detect and catch a visible nearby player after crossing');
  }
});

test('closed or still-opening passage cannot be crossed by the enemy, including large pursuit steps', () => {
  for (const secret of [{ open: false, slide: 0 }, { open: true, slide: .94 }]) {
    const world = createWorld(2, { secretIndex: 0 });
    Object.assign(world.secret, secret);
    Object.assign(world.enemy, { active: true, x: 4, z: -3 });
    Object.assign(world.player, { x: 0, z: -8 });
    world.enemy.patrolTarget = { x: 0, z: -8 };
    updateEnemy(world, 20);
    assert.ok(world.enemy.z >= -5.45 - 1e-8);
    assert.equal(isCaptured(world), false);
    for (let tick = 0; tick < 100; tick++) updateEnemy(world, .05);
    assert.ok(world.enemy.z >= -5.45 - 1e-8);
    Object.assign(world.secret, { open: true, slide: 1 });
    for (let tick = 0; tick < 500 && !isCaptured(world); tick++) updateEnemy(world, .05);
    assert.equal(isCaptured(world), true, 'opening the passage releases a previously blocked pursuer');
  }
});

test('journal modal freezes play and closes once on E, Enter, or Escape without also interacting', () => {
  for (const close of ['interact', 'primary', 'escape']) {
    const game = gameFixture();
    approach(game.state.world, -3, 2);
    game.update(.05, intent({ interact: true }));
    assert.equal(game.state.reading, true);
    assert.equal(game.state.world.secret.clueRead, true);
    const snapshot = structuredClone(game.state);
    advance(game, 5, intent({ movement: { x: 1, z: -1 }, look: { x: 100, y: 100 }, torch: true }));
    assert.deepEqual(game.state.world, snapshot.world);
    assert.equal(game.state.timeLeft, snapshot.timeLeft);
    assert.equal(game.state.elapsed, snapshot.elapsed);
    assert.equal(game.state.torchOn, snapshot.torchOn);
    game.update(.05, intent({ [close]: true }));
    assert.equal(game.state.reading, false);
    assert.equal(game.state.timeLeft, snapshot.timeLeft);
    assert.deepEqual(game.state.events, []);
    assert.equal(game.state.score, 0);
  }
});

test('puzzle events never award cleanup score and slide advances only during active unpaused play', () => {
  const game = gameFixture(1, 1);
  const world = game.state.world;
  approach(world, -3, 2);
  game.update(.05, intent({ interact: true }));
  game.dispatch('close-book');
  world.tasks.find(task => task.id === 'books').done = true;
  approach(world, BOOK_X[0], -5);
  game.update(.05, intent({ interact: true }));
  assert.equal(game.state.events[0].type, 'secret.wrong');
  approach(world, BOOK_X[1], -5);
  game.update(.05, intent({ interact: true }));
  assert.equal(game.state.events[0].type, 'secret.opened');
  const oldTarget = { ...game.state.target, kind: 'secret-book', id: 'secret-book-1' };
  for (let repeat = 0; repeat < 5; repeat++) assert.deepEqual(interact(world, oldTarget), []);
  assert.equal(game.state.score, 0);
  assert.deepEqual(game.state.awards, []);
  assert.equal(world.completedTasks, 0);
  near(world.secret.slide, 0);
  advance(game, .35);
  near(world.secret.slide, .5);
  game.setPaused(true);
  advance(game, 10);
  near(world.secret.slide, .5);
  game.setPaused(false);
  game.state.reading = true;
  advance(game, 10);
  near(world.secret.slide, .5);
  game.dispatch('close-book');
  advance(game, .35);
  near(world.secret.slide, 1);
  advance(game, 2);
  near(world.secret.slide, 1);
});

test('a movement-driven journal and secret-room detour preserves mandatory cleanup progression and level-two secret state', () => {
  const game = gameFixture(1, 2);
  const world = game.state.world;
  walkTo(game, { x: -3, z: 2 });
  assert.equal(game.state.target.kind, 'journal');
  game.update(.05, intent({ interact: true }));
  game.update(.05, intent({ interact: true })); // Fresh press closes the journal.
  walkTo(game, world.tasks.find(task => task.id === 'books'));
  game.update(.05, intent({ interact: true }));
  assert.equal(game.state.score, 50);
  walkTo(game, { x: .65, z: -5 }, .2);
  assert.equal(game.state.target.id, 'secret-book-2');
  game.update(.05, intent({ interact: true }));
  advance(game, .7);
  walkTo(game, { x: 0, z: -5.3 }, .15);
  walkTo(game, { x: 0, z: -8 }, .15);
  assert.ok(world.player.z < -7.8);
  walkTo(game, { x: 0, z: -5 }, .15);
  for (const task of world.tasks.filter(task => !task.done)) {
    walkTo(game, task);
    game.update(.05, intent({ interact: true }));
  }
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  assert.equal(game.state.score, 300);
  const secret = structuredClone(world.secret);
  advance(game, 1.35);
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.deepEqual(game.state.world.secret, secret);
  assert.ok(game.state.world.tasks.every(task => task.done));
  assert.equal(game.state.score, 300);
});

test('restart closes the passage, clears the journal, and chooses a new legal clue without sharing the old state', () => {
  const game = gameFixture(2, 2);
  const oldSecret = game.state.world.secret;
  Object.assign(oldSecret, { clueRead: true, open: true, slide: 1 });
  game.state.reading = true;
  game.state.phase = 'LOSE';
  const random = Math.random;
  try {
    Math.random = () => 0;
    game.dispatch('restart');
  } finally { Math.random = random; }
  assert.equal(game.state.phase, 'TITLE');
  assert.equal(game.state.reading, false);
  assert.notEqual(game.state.world.secret, oldSecret);
  assert.deepEqual(game.state.world.secret, { clueRead: false, targetIndex: 0, open: false, slide: 0 });
  assert.equal(game.state.world.player.z, 4.7);
});


test('lever books stay unavailable until the real book-shelving job is finished', () => {
 const world=createWorld(1,{secretIndex:1});world.secret.clueRead=true;
 approach(world,0,-5);assert.notEqual(selectTarget(world)?.kind,'secret-book');
 approach(world,0,-4.3);assert.equal(selectTarget(world).id,'books');
 interact(world,selectTarget(world));approach(world,0,-5);
 assert.equal(selectTarget(world).id,'secret-book-1');
});

test('patrol clears the wall before detecting a player hugging the archive side',()=>{
 const world=createWorld(2);Object.assign(world.secret,{open:true,slide:1});
 Object.assign(world.enemy,{active:true,x:6,z:-5});Object.assign(world.player,{x:1.8,z:-6.6});
 world.enemy.patrolTarget={x:1.8,z:-6.6};
 for(let i=0;i<600&&!isCaptured(world);i++)updateEnemy(world,.05);
 assert.equal(isCaptured(world),true);
});


test('archive wall control makes the secret passage mandatory for escape',()=>{
 const world=createWorld(2,{secretIndex:0,controlOrder:CONTROLS});
 const control=world.switches.find(item=>item.id==='switch-3');
 assert.equal(control.z,-10.75);assert.equal(control.rotation,0);
 for(const item of world.switches.slice(0,2)){
  approach(world,item.x,item.z);interact(world,selectTarget(world));
 }
 assert.equal(world.switchCount,2);assert.equal(world.exit.unlocked,false);
 Object.assign(world.player,{x:0,z:-5.65,facing:{x:0,z:-1}});
 movePlayer(world,{x:0,z:-1},20);
 assert.ok(world.player.z>=-5.65);assert.notEqual(selectTarget(world)?.id,control.id);
 Object.assign(world.secret,{clueRead:true,open:true,slide:1});
 for(const point of findPath(world,world.player,{x:control.x,z:control.z},world.player.radius)) {
  const dx=point.x-world.player.x,dz=point.z-world.player.z;
  const distance=Math.hypot(dx,dz);
  if(distance)movePlayer(world,{x:dx/distance,z:dz/distance},distance/world.player.speed);
 }
 const dx=control.x-world.player.x,dz=control.z-world.player.z,distance=Math.hypot(dx,dz);
 world.player.facing={x:dx/distance,z:dz/distance};
 assert.equal(selectTarget(world).id,control.id);interact(world,selectTarget(world));
 assert.equal(world.switchCount,3);assert.equal(world.exit.unlocked,true);
});

test('archive back-corner navigation produces legs that the real circular player can walk', () => {
  const world = openWorld();
  Object.assign(world.player, { x: 2.4565806933424037, z: -10.6 });
  const destination = { x: 0, z: -4.5 };
  const path = findPath(world, world.player, destination, world.player.radius);
  assert.ok(path.length, 'a legal corner position must retain an exit route');
  for (const point of path) {
    const dx = point.x - world.player.x, dz = point.z - world.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance) movePlayer(world, { x: dx / distance, z: dz / distance }, distance / world.player.speed);
    near(world.player.x, point.x);
    near(world.player.z, point.z);
  }
  near(world.player.x, destination.x);
  near(world.player.z, destination.z);
});

test('control order is a fresh validated permutation and deterministic fixtures cannot share mutable arrays', () => {
  const random = Math.random;
  const seen = new Set();
  try {
    for (const first of [.1, .5, .9]) for (const second of [.1, .9]) {
      const values = [first, second];
      Math.random = () => values.shift() ?? .5;
      const order = createWorld(1, { secretIndex: 0 }).controlOrder;
      assert.deepEqual([...order].sort(), CONTROLS);
      seen.add(order.join(','));
    }
  } finally { Math.random = random; }
  assert.equal(seen.size, 6, 'all six permutations must be possible');
  const supplied = ['switch-3', 'switch-1', 'switch-2'];
  const world = createWorld(2, { controlOrder: supplied });
  supplied.reverse();
  assert.deepEqual(world.controlOrder, ['switch-3', 'switch-1', 'switch-2']);
  for (const invalid of [null, [], ['switch-1', 'switch-1', 'switch-2'], ['switch-1', 'switch-2', 'missing']]) assert.throws(() => createWorld(2, { controlOrder: invalid }), /controlOrder/);
});

test('every control permutation rejects out-of-order presses without score, count, disabling, or spawn changes', () => {
  for (const order of ORDERS) {
    const game = gameFixture(2, 1, order);
    const world = game.state.world;
    Object.assign(world.secret, { clueRead: true, open: true, slide: 1 });
    for (const [step, expected] of order.entries()) {
      for (const wrong of world.switches.filter(control => !control.disabled && control.id !== expected)) {
        approach(world, wrong.x, wrong.z);
        const before = { score: game.state.score, count: world.switchCount, spawn: world.enemy.spawnIn, speed: world.enemy.speed, awards: [...game.state.awards] };
        game.update(0, intent({ interact: true }));
        assert.deepEqual(game.state.events.map(({ type, id }) => ({ type, id })), [{ type: 'control.wrong', id: wrong.id }]);
        assert.equal(game.state.score, before.score);
        assert.equal(world.switchCount, before.count);
        assert.equal(world.enemy.spawnIn, before.spawn);
        assert.equal(world.enemy.speed, before.speed);
        assert.deepEqual(game.state.awards, before.awards);
        assert.equal(wrong.disabled, false);
        assert.equal(world.exit.unlocked, false);
      }
      const control = world.switches.find(item => item.id === expected);
      approach(world, control.x, control.z);
      game.update(0, intent({ interact: true }));
      assert.equal(world.switchCount, step + 1);
      assert.equal(game.state.score, (step + 1) * 150);
      assert.equal(control.disabled, true);
      assert.equal(world.enemy.spawnIn, 3);
      assert.equal(world.exit.unlocked, step === 2);
      game.update(0, intent({ interact: true }));
      assert.equal(game.state.score, (step + 1) * 150);
    }
  }
});

test('journal control sequence survives intro and level transition, then rerolls only on a new run', () => {
  const game = createGame();
  game.dispatch('start');
  const selected = ['switch-3', 'switch-2', 'switch-1'];
  game.state.world.controlOrder = [...selected];
  advance(game, 15);
  assert.equal(game.state.phase, 'LEVEL_1');
  assert.deepEqual(game.state.world.controlOrder, selected);
  approach(game.state.world, -3, 2);
  game.update(0, intent({ interact: true }));
  assert.equal(game.state.reading, true);
  assert.deepEqual(game.state.world.controlOrder, selected);
  game.dispatch('close-book');
  game.state.phase = 'LEVEL_TRANSITION';
  game.state.phaseElapsed = 0;
  advance(game, 1.35);
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.deepEqual(game.state.world.controlOrder, selected);
  game.state.phase = 'LOSE';
  const random = Math.random;
  try { Math.random = () => .99; game.dispatch('restart'); }
  finally { Math.random = random; }
  assert.deepEqual(game.state.world.controlOrder, CONTROLS);
  assert.equal(game.state.world.switchCount, 0);
});

for (const order of ORDERS) test(`physical puzzle and pursuit route can escape control order ${order.map(id => id.at(-1)).join('→')} at 1,050`, () => {
  const game = gameFixture(1, 1, order);
  completeCleanupAndEscape(game);
});
