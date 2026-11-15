import assert from 'node:assert/strict';
import { findPath, movePlayer } from '../src/levels.js';

export function walkTo(game, target, threshold = .7, { sneak = false, evade = false } = {}) {
  const world = game.state.world;
  const destination = target.z === -5 && Math.abs(target.x) <= .7 ? { x: target.x, z: -4.5 } : target;
  let path = findPath(world, world.player, destination, world.player.radius);
  assert.ok(path.length, `no route to ${JSON.stringify(target)}`);
  let next = 0, replan = 0;
  for (let tick = 0; tick < 1800; tick++) {
    assert.ok(['LEVEL_1', 'LEVEL_2'].includes(game.state.phase), `route to (${target.x},${target.z}) failed in ${game.state.phase}; player=(${world.player.x.toFixed(2)},${world.player.z.toFixed(2)}), enemy=(${world.enemy.x.toFixed(2)},${world.enemy.z.toFixed(2)})`);
    const player = world.player;
    if (Math.hypot(target.x - player.x, target.z - player.z) <= (!target.id && evade ? Math.max(threshold, 1) : threshold)) {
      const yaw = Math.atan2(-(target.x - player.x), -(target.z - player.z));
      const delta = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
      game.update(0, { look: { x: -delta / .0022, y: 0 } });
      if (!target.id || game.state.target?.id === target.id) return;
    }
    while (next < path.length && Math.hypot(path[next].x - player.x, path[next].z - player.z) < .09) next++;
    if (next >= path.length) {
      const yaw = Math.atan2(-(target.x - player.x), -(target.z - player.z));
      const delta = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
      game.update(0, { look: { x: -delta / .0022, y: 0 } });
      return;
    }
    const point = path[next], dx = point.x - player.x, dz = point.z - player.z;
    let direction = Math.atan2(dx, dz);
    const enemy = world.enemy;
    if (evade && enemy.active && Math.hypot(enemy.x - player.x, enemy.z - player.z) < 4) {
      let bestScore = -Infinity;
      for (let candidate = 0; candidate < 32; candidate++) {
        const angle = candidate * Math.PI / 16;
        const test = { ...player, facing: { ...player.facing } };
        let safe = Infinity;
        const simulation = { ...world, player: test };
        let ex = enemy.x, ez = enemy.z;
        for (let step = 0; step < 10; step++) {
          movePlayer(simulation, { x: Math.sin(angle), z: Math.cos(angle) }, .05);
          const edx = test.x - ex, edz = test.z - ez, distance = Math.hypot(edx, edz);
          if (distance) { ex += edx / distance * enemy.speed * .05; ez += edz / distance * enemy.speed * .05; }
          safe = Math.min(safe, Math.hypot(test.x - ex, test.z - ez));
        }
        const progress = Math.hypot(dx, dz) - Math.hypot(point.x - test.x, point.z - test.z);
        const travelled = Math.hypot(test.x - player.x, test.z - player.z);
        const score = progress + Math.min(safe, 2.3) * .3 - Math.max(0, 1.6 - safe) * 15 - Math.max(0, 1 - travelled) * 3;
        if (score > bestScore) { bestScore = score; direction = angle; }
      }
      if (++replan >= 10) {
        path = findPath(world, player, destination, player.radius); next = 0; replan = 0;
        assert.ok(path.length, `evasion loses navigation at (${player.x},${player.z}) toward (${destination.x},${destination.z})`);
      }
    }
    const yaw = Math.atan2(-Math.sin(direction), -Math.cos(direction));
    const delta = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
    game.update(Math.min(.05, Math.hypot(dx, dz) / (sneak ? 1.8 : 4)), { look: { x: -delta / .0022, y: 0 }, movement: { x: 0, z: -1 }, sneak });
  }
  assert.fail(`route timed out before reaching ${JSON.stringify(target)}`);
}

const intent = overrides => ({ movement: { x: 0, z: 0 }, ...overrides });
function advance(game, seconds) {
  const frames = Math.floor(seconds / .05 + 1e-8);
  for (let frame = 0; frame < frames; frame++) game.update(.05, intent());
  const remainder = seconds - frames * .05;
  if (remainder > 1e-8) game.update(remainder, intent());
}

// A representative seeded patrol fixture, not a promise that one route wins
// against every random patrol. Every live action is an ordinary input intent.
export function completeCleanupAndEscape(game) {
  const order = [...game.state.world.controlOrder];

  walkTo(game, { x: -3, z: 2 });
  game.update(.05, intent({ interact: true }));
  game.update(.05, intent({ interact: true }));
  walkTo(game, game.state.world.tasks.find(task => task.id === 'books'));
  game.update(.05, intent({ interact: true }));
  walkTo(game, { x: 0, z: -5 }, .2);
  game.update(.05, intent({ interact: true }));
  advance(game, .7);
  for (const task of game.state.world.tasks.filter(task => !task.done)) {
    walkTo(game, task);
    game.update(.05, intent({ interact: true }));
  }
  assert.equal(game.state.phase, 'LEVEL_TRANSITION');
  const savedRandom = Math.random;
  try { Math.random = () => .2; advance(game, 1.35); }
  finally { Math.random = savedRandom; }
  assert.equal(game.state.phase, 'LEVEL_2');
  assert.equal(game.state.score, 300);
  const world = game.state.world;
  for (const [index, id] of order.entries()) {
    if (id === 'switch-3') {
      walkTo(game, { x: 0, z: -5.2 }, .2);
      walkTo(game, { x: 0, z: -7 }, .2);
    }
    if (id === 'switch-1' && order[0] === 'switch-2' && order[1] === 'switch-3') {
      walkTo(game, { x: 3, z: -1 }, .2);
      walkTo(game, { x: 3, z: 4.8 }, .2);
      walkTo(game, { x: -4, z: 4.8 }, .2, { evade: true });
      walkTo(game, { x: -4, z: 2.5 }, .2, { evade: true });
    }
    const control = world.switches.find(item => item.id === id);
    walkTo(game, control, .7);
    assert.equal(game.state.target.id, id);
    game.update(.05, intent({ interact: true }));
    assert.equal(game.state.score, 300 + (index + 1) * 150);
    if (id === 'switch-3') {
      if (index > 0) {
        advance(game, 4.5);
        assert.equal(game.state.phase, 'LEVEL_2', 'shelter behind archive desk while search expires');
      }
      walkTo(game, { x: 2.4, z: -9 }, .2);
      walkTo(game, { x: 2.4, z: -7 }, .2);
      walkTo(game, { x: 0, z: -6.7 }, .2);
      walkTo(game, { x: 0, z: -5 }, .2);
    }
  }
  if (order[0] === 'switch-2' && order[1] === 'switch-3') {
    // Stay at the perimeter rather than crossing the mascot's central route.
    walkTo(game, { x: -4, z: -1 }, .2);
    walkTo(game, { x: 1, z: 0 }, .2);
  }
  if (order[0] === 'switch-1' && order[1] === 'switch-3') {
    walkTo(game, { x: -3, z: -2.5 }, .2);
    walkTo(game, { x: 1, z: 0 }, .2);
  }
  walkTo(game, world.exit, 1.25, { evade: true });
  game.update(.05, intent({ interact: true }));
  assert.equal(game.state.phase, 'WIN');
  assert.equal(game.state.score, 1050);
  assert.equal(new Set(game.state.awards).size, 10);
  assert.ok(game.state.timeLeft > 0);

  return game.state.world;
}
