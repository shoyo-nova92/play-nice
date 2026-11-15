export const ROOM = Object.freeze({ width: 16, depth: 12 });

/** Each run/level gets its own mutable objects; meshes must read these positions. */
export function createWorld(level, { secretIndex, controlOrder } = {}) {
  if (level !== 1 && level !== 2) throw new Error(`Unknown level: ${level}`);
  if (secretIndex !== undefined && (!Number.isInteger(secretIndex) || secretIndex < 0 || secretIndex > 2)) throw new RangeError('secretIndex must be 0, 1, or 2.');
  const switchIds = ['switch-1', 'switch-2', 'switch-3'];
  if (controlOrder !== undefined && (!Array.isArray(controlOrder) || controlOrder.length !== 3 || new Set(controlOrder).size !== 3 || controlOrder.some(id => !switchIds.includes(id)))) throw new RangeError('controlOrder must contain each switch ID exactly once.');
  const order = controlOrder ? [...controlOrder] : [...switchIds];
  if (!controlOrder) {
    for (let index = order.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
  }
  const toys = [
    { id: 'bear', name: 'RED BEAR', x: -4.3, z: 2.7, color: 0xdf5146, shelfId: 'shelf-bear' },
    { id: 'ball', name: 'BLUE BALL', x: 0, z: 0.8, color: 0x549dcc, shelfId: 'shelf-ball' },
    { id: 'duck', name: 'YELLOW DUCK', x: 4.6, z: 2.2, color: 0xefbe4e, shelfId: 'shelf-duck' },
  ].map((toy) => ({ ...toy, status: level === 1 ? 'floor' : 'delivered' }));
  const tasks = [
    { id: 'spill-1', kind: 'spill', name: 'WIPE SPILL 01', x: -4.3, z: 2.7 },
    { id: 'spill-2', kind: 'spill', name: 'WIPE SPILL 02', x: 0, z: 0.8 },
    { id: 'rubbish', kind: 'rubbish', name: 'COLLECT RUBBISH', x: 4.6, z: 2.2 },
    { id: 'chair', kind: 'chair', name: 'STRAIGHTEN CHAIR', x: -5, z: -2 },
    { id: 'books', kind: 'books', name: 'SHELVE BOOKS', x: 0, z: -4.3 },
    { id: 'blocks', kind: 'blocks', name: 'STORE TOYS IN BASKET', x: 4, z: -4.3 },
  ].map(task => ({ ...task, done: level === 2 }));

  return {
    level,
    player: { x: 0, z: 4.7, radius: 0.35, speed: 4, carriedToyId: null, facing: { x: 0, z: -1 }, yaw: 0, pitch: 0, distanceWalked: 0, hiddenIn: null, peeking: false, moving: false, sneaking: false },
    toys,
    shelves: [],
    secret: { clueRead: false, targetIndex: secretIndex ?? Math.floor(Math.random() * 3), open: false, slide: 0 },
    controlOrder: order,
    tasks,
    hidingSpots: [
      { id: 'hide-box-1', kind: 'box', x: -6, z: 4.8, bodyX: -6, bodyZ: 3.7, width: 1.3, depth: 1.1, entryYaw: Math.PI },
      { id: 'hide-box-2', kind: 'box', x: 5.8, z: 2.1, bodyX: 5.8, bodyZ: 1, width: 1.3, depth: 1.1, entryYaw: Math.PI },
      { id: 'hide-closet', kind: 'closet', x: 6.8, z: -1.575, bodyX: 6.8, bodyZ: -2.7, width: 1.45, depth: 1.15, entryYaw: Math.PI },
    ],
    colliders: [
      { id: 'journal-table', x: -3, z: 2, width: 1.15, depth: .86 },
      { id: 'child-table', x: -5.9, z: -2, width: 1.35, depth: 1.25 },
      { id: 'extra-chair', x: -6.8, z: -2, width: .72, depth: .66 },
      { id: 'task-chair', x: -5, z: -2, width: .8, depth: .9 },
      { id: 'stool-west', x: -7, z: 5.2, width: .72, depth: .66 },
      { id: 'stool-east', x: 7.35, z: 0, width: .72, depth: .66 },
      { id: 'window-table', x: -7.42, z: -1.45, width: .8, depth: 2.3 },
      { id: 'bookcase', x: 0, z: -5.45, width: 2.95, depth: .95 },
      { id: 'basket', x: 4, z: -4.21, width: .96, depth: .8 },
      { id: 'archive-rack-west', x: -2.63, z: -8.55, width: .55, depth: 3.4 },
      { id: 'archive-rack-east', x: 2.63, z: -8.55, width: .55, depth: 3.4 },
      { id: 'archive-desk', x: 0, z: -9.2, width: 1.6, depth: .85 },
      { id: 'rocker', x: 7.05, z: 2.6, width: 1.2, depth: 1.05 },
    ],
    completedTasks: level === 2 ? tasks.length : 0,
    switches: level === 2 ? [
      { id: 'switch-1', name: 'CONTROL 01', x: -7.75, z: 2.5, rotation: Math.PI / 2, disabled: false },
      { id: 'switch-2', name: 'CONTROL 02', x: -4, z: -5.75, rotation: 0, disabled: false },
      { id: 'switch-3', name: 'CONTROL 03 — ARCHIVE', x: 0, z: -10.75, rotation: 0, disabled: false },
    ] : [],
    exit: { id: 'exit', name: 'EXIT', x: 6.6, z: -4.5, unlocked: false },
    enemy: { x: 6.8, z: 4.8, radius: 0.55, speed: 2.3, active: false, spawnIn: null, wakeElapsed: 0, mode: 'patrol', lastSeen: null, heading: 0, sawHide: false, searchTime: 0, patrolIndex: 0, seed: Math.floor(Math.random() * 0x7fffffff), path: [], repath: 0 },
    deliveredCount: 0,
    switchCount: 0,
  };
}

// Actual footprints are shared with the renderer; the sliding case is dynamic.
export function getColliders(world) {
  return [...world.colliders.map(item => item.id === 'bookcase' ? { ...item, x: 3.2 * world.secret.slide } : item),
    ...world.hidingSpots.map(spot => ({ id: spot.id, x: spot.bodyX, z: spot.bodyZ, width: spot.width, depth: spot.depth }))];
}
/** Stop the sliding case rather than letting it enclose an actor. */
export function advanceSecret(world, dt) {
  if (!world.secret.open) return;
  const next = world.secret.slide + dt / .7;
  const proposed = next >= 1 - 1e-8 ? 1 : next;
  const caseRect=world.colliders.find(item=>item.id==='bookcase');
  if(!caseRect){world.secret.slide=proposed;return;}
  const safe=[world.player,...(world.enemy.active?[world.enemy]:[])].every(actor=>{
    const dx=Math.max(0,Math.abs(actor.x-3.2*proposed)-caseRect.width/2);
    const dz=Math.max(0,Math.abs(actor.z-caseRect.z)-caseRect.depth/2);
    return dx*dx+dz*dz >= actor.radius*actor.radius-1e-8;
  });
  if(safe)world.secret.slide=proposed;
}

function geometry(world, radius) {
  const open = world.secret.open && world.secret.slide >= .95;
  const rects = getColliders(world);
  const front = -6 + radius, rear = -6 - radius;
  const allowed = (x, z) => {
    const epsilon = 1e-8;
    if (z > 6 - radius + epsilon || z < (open ? -11 + radius : front) - epsilon) return false;
    const limit = !open || z >= front - epsilon ? 8 - radius : z <= rear + epsilon ? 3 - radius : 1.5 - radius;
    if (Math.abs(x) > limit + epsilon) return false;
    return rects.every(rect => {
      const dx = Math.max(0, Math.abs(x - rect.x) - rect.width / 2);
      const dz = Math.max(0, Math.abs(z - rect.z) - rect.depth / 2);
      if (!radius) return dx > epsilon || dz > epsilon || Math.abs(x - rect.x) >= rect.width / 2 - epsilon || Math.abs(z - rect.z) >= rect.depth / 2 - epsilon;
      return dx * dx + dz * dz >= radius * radius - epsilon;
    });
  };
  return { allowed, rects, front, rear };
}
// Sweep the circular actor over the complete segment, including rounded corners.
function fraction(shape, from, dx, dz, radius) {
  const times = [0, 1];
  const cross = (start, delta, edges) => {
    if (!delta) return;
    for (const edge of edges) { const t = (edge - start) / delta; if (t > 0 && t < 1) times.push(t); }
  };
  cross(from.x, dx, [-8 + radius, 8 - radius, -3 + radius, 3 - radius, -1.5 + radius, 1.5 - radius]);
  cross(from.z, dz, [6 - radius, shape.front, shape.rear, -11 + radius]);
  for (const rect of shape.rects) {
    const xs = [rect.x - rect.width / 2, rect.x + rect.width / 2];
    const zs = [rect.z - rect.depth / 2, rect.z + rect.depth / 2];
    cross(from.x, dx, [xs[0] - radius, ...xs, xs[1] + radius]);
    cross(from.z, dz, [zs[0] - radius, ...zs, zs[1] + radius]);
    if (radius && dx * dx + dz * dz > 0) for (const x of xs) for (const z of zs) {
      const a = dx * dx + dz * dz;
      const b = 2 * ((from.x - x) * dx + (from.z - z) * dz);
      const c = (from.x - x) ** 2 + (from.z - z) ** 2 - radius * radius;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) if (t > 0 && t < 1) times.push(t);
    }
  }
  times.sort((a, b) => a - b);
  for (let index = 0; index < times.length - 1; index++) {
    const t = (times[index] + times[index + 1]) / 2;
    if (!shape.allowed(from.x + dx * t, from.z + dz * t)) return times[index];
  }
  return 1;
}
function moveActor(world, actor, dx, dz) {
  const shape = geometry(world, actor.radius);
  const t = fraction(shape, actor, dx, dz, actor.radius);
  actor.x += dx * t; actor.z += dz * t;
  if (t >= 1) return;
  const left = 1 - t;
  const blockedX = dx && !shape.allowed(actor.x + Math.sign(dx) * 1e-5, actor.z);
  const blockedZ = dz && !shape.allowed(actor.x, actor.z + Math.sign(dz) * 1e-5);
  const sx = blockedX ? 0 : dx * left, sz = blockedZ ? 0 : dz * left;
  if (sx || sz) { const slide = fraction(shape, actor, sx, sz, actor.radius); actor.x += sx * slide; actor.z += sz * slide; }
}
export function hasLineOfSight(world, from, to) {
  return fraction(geometry(world, 0), from, to.x - from.x, to.z - from.z, 0) >= 1 - 1e-8;
}
const navigationCache = new WeakMap();
export function findPath(world, from, to, radius = .55) {
  const shape = geometry(world, radius);
  const clear = (a, b) => fraction(shape, a, b.x - a.x, b.z - a.z, radius) >= 1 - 1e-8;
  if (shape.allowed(to.x, to.z) && clear(from, to)) return [{ x: to.x, z: to.z }];
  const key = `${radius}:${world.secret.open}:${world.secret.slide.toFixed(3)}:${JSON.stringify(world.colliders)}`;
  let cache = navigationCache.get(world);
  if (!cache || cache.key !== key) {
    const nodes = new Map();
    for (let ix = -15; ix <= 15; ix++) for (let iz = -21; iz <= 11; iz++) {
      const point = { x: ix * .5, z: iz * .5, id: `${ix},${iz}`, ix, iz };
      if (shape.allowed(point.x, point.z)) nodes.set(point.id, point);
    }
    cache = { key, nodes }; navigationCache.set(world, cache);
  }
  const nearest = point => {
    const sorted=[...cache.nodes.values()].sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z));
    for(const node of sorted.slice(0,32)) {
      if(clear(point,node))return {...node,prefix:[]};
      for(const bend of [{x:node.x,z:point.z},{x:point.x,z:node.z}])
        if(shape.allowed(bend.x,bend.z)&&clear(point,bend)&&clear(bend,node))return {...node,prefix:[bend]};
    }
    return null;
  };
  const start = nearest(from);
  // Interaction objects may be solid: use the nearest reachable approach cell.
  const solidGoal = !shape.allowed(to.x, to.z);
  const goal = solidGoal ? {x:to.x,z:to.z,id:null} : nearest(to);
  if (!start || !goal) return [];
  const open = [start.id], costs = new Map([[start.id, 0]]), came = new Map();
  const closed = new Set();
  for (let iteration = 0; open.length && iteration < 1400; iteration++) {
    open.sort((a, b) => costs.get(a) + Math.hypot(cache.nodes.get(a).x - goal.x, cache.nodes.get(a).z - goal.z) - costs.get(b) - Math.hypot(cache.nodes.get(b).x - goal.x, cache.nodes.get(b).z - goal.z));
    const id = open.shift(), current = cache.nodes.get(id);
    if (id === goal.id || (solidGoal && Math.hypot(current.x-to.x,current.z-to.z) <= 1.25)) {
      const path = [current]; let cursor = id;
      while (came.has(cursor)) { cursor = came.get(cursor); path.push(cache.nodes.get(cursor)); }
      path.reverse();
      const result = [...(start.prefix || [])]; let anchor = result.at(-1) || from, index = 0;
      while (index < path.length) { let next = index; while (next + 1 < path.length && clear(anchor, path[next + 1])) next++; result.push({ x: path[next].x, z: path[next].z }); anchor = path[next]; index = next + 1; }
      if (shape.allowed(to.x, to.z)) {
        for(const bend of [...(goal.prefix || [])].reverse()) {if(clear(anchor,bend)){result.push(bend);anchor=bend;}}
        if(clear(anchor,to))result.push({x:to.x,z:to.z});
      }
      return result;
    }
    closed.add(id);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const next = cache.nodes.get(`${current.ix + dx},${current.iz + dz}`);
      if (!next || closed.has(next.id) || !clear(current, next)) continue;
      const cost = costs.get(id) + Math.hypot(dx, dz) * .5;
      if (cost >= (costs.get(next.id) ?? Infinity)) continue;
      came.set(next.id, id); costs.set(next.id, cost); if (!open.includes(next.id)) open.push(next.id);
    }
  }
  return [];
}

export function movePlayer(world, movement, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  let x = Number.isFinite(movement?.x) ? movement.x : 0;
  let z = Number.isFinite(movement?.z) ? movement.z : 0;
  const length = Math.hypot(x, z);
  if (!length) return;
  const scale = Math.max(1, length);
  x /= scale;
  z /= scale;
  const player = world.player;
  const beforeX = player.x;
  const beforeZ = player.z;
  if (player.hiddenIn) return;
  const speed = player.sneaking ? 1.8 : player.speed;
  moveActor(world, player, x * speed * dt, z * speed * dt);
  player.distanceWalked += Math.hypot(player.x - beforeX, player.z - beforeZ);
}

const INTERACTION_DISTANCE = 1.3;

export function selectTarget(world, { ignoreFacing = false } = {}) {
  if (world.player.hiddenIn) return { id: world.player.hiddenIn, kind: 'hide-exit', name: 'LEAVE HIDING', x: world.player.x, z: world.player.z, prompt: 'E — LEAVE HIDING' };
  let candidates;
  if (world.level === 1) {
    candidates = world.tasks.filter(task => !task.done)
      .map(task => ({ ...task, kind: 'task', prompt: `E — ${task.name}` }));
  } else if (world.level === 2) {
    candidates = world.switches.filter((item) => !item.disabled)
      .map((item) => ({ ...item, kind: 'switch', prompt: `E — DISABLE ${item.name}` }));
    candidates.push({ ...world.exit, kind: 'exit', prompt: world.exit.unlocked ? 'E — EXIT THE PLAYROOM' : 'E — EXIT LOCKED · DISABLE ALL SWITCHES' });
  } else {
    return null;
  }
  candidates.push({ id: 'journal', kind: 'journal', name: 'READ THE JOURNAL', x: -3, z: 2, prompt: 'E — READ THE JOURNAL' });
  candidates.push(...world.hidingSpots.map(spot => ({ ...spot, kind: 'hide', name: spot.kind === 'closet' ? 'HIDE IN CLOSET' : 'HIDE IN BOX', prompt: spot.kind === 'closet' ? 'E — HIDE IN CLOSET' : 'E — HIDE IN BOX' })));
  if (world.secret.clueRead && world.tasks.find(task => task.id === 'books')?.done && !world.secret.open) {
    const labels = ['MOON', 'STAR', 'SUN'];
    [-.65, 0, .65].forEach((x, index) => candidates.push({ id: `secret-book-${index}`, kind: 'secret-book', name: labels[index], x, z: -5, prompt: `E — PULL THE ${labels[index]} BOOK` }));
  }
  let nearest = null;
  let nearestDistance = INTERACTION_DISTANCE * INTERACTION_DISTANCE;
  for (const candidate of candidates) {
    const distance = (candidate.x - world.player.x) ** 2 + (candidate.z - world.player.z) ** 2;
    if (distance > nearestDistance) continue;
    if (!ignoreFacing && distance > .04) {
      const facing = world.player.facing;
      const dot = ((candidate.x - world.player.x) * facing.x + (candidate.z - world.player.z) * facing.z) / Math.sqrt(distance);
      if (dot < .25) continue;
    }
    if (nearest && distance === nearestDistance && candidate.id > nearest.id) continue;
    nearest = candidate;
    nearestDistance = distance;
  }
  if (!nearest) return null;
  const { id, kind, name, x, z, prompt } = nearest;
  return { id, kind, name, x, z, prompt };
}

export function interact(world, target) {
  if (!target) return [];
  // Use current logical eligibility/proximity, never trust a stale UI target.
  const selected = selectTarget(world);
  if (!selected || selected.id !== target.id || selected.kind !== target.kind) return [];
  if (selected.kind === 'hide-exit') {
    world.player.hiddenIn = null; world.player.peeking = false; world.enemy.sawHide = false;
    return [{ type: 'hide.exited', id: selected.id }];
  }
  if (selected.kind === 'hide') {
    const spot = world.hidingSpots.find(item => item.id === selected.id);
    world.enemy.sawHide = world.enemy.active && seesPlayer(world) && Math.hypot(world.enemy.x - world.player.x, world.enemy.z - world.player.z) < 5;
    world.player.hiddenIn = spot.id;
    world.player.x = spot.x; world.player.z = spot.z;
    world.player.yaw = spot.entryYaw; world.player.pitch = 0;
    world.player.facing = { x: -Math.sin(spot.entryYaw), z: -Math.cos(spot.entryYaw) };
    world.player.moving = false; world.player.peeking = false;
    if (!world.enemy.sawHide && world.enemy.active) { world.enemy.mode = 'search'; world.enemy.searchTime = 0; }
    return [{ type: 'hide.entered', id: spot.id }];
  }
  if (selected.kind === 'journal') {
    world.secret.clueRead = true;
    return [{ type: 'journal.read', id: 'journal' }];
  }
  if (selected.kind === 'secret-book') {
    const index = Number(selected.id.slice('secret-book-'.length));
    if (index !== world.secret.targetIndex) return [{ type: 'secret.wrong', id: selected.id }];
    world.secret.open = true;
    return [{ type: 'secret.opened', id: selected.id }];
  }
  if (world.level === 2) {
    if (selected.kind === 'exit') {
      return [{ type: world.exit.unlocked && world.switchCount === 3 ? 'exit.used' : 'exit.locked', id: 'exit' }];
    }
    const control = world.switches.find((item) => item.id === selected.id);
    if (!control || control.disabled) return [];
    if (world.controlOrder[world.switchCount] !== control.id) return [{ type: 'control.wrong', id: control.id }];
    control.disabled = true;
    world.switchCount += 1;
    world.exit.unlocked = world.switchCount === 3;
    if (world.switchCount === 1) world.enemy.spawnIn = 3;
    world.enemy.speed = Math.min(2.7, 2.3 + 0.2 * (world.switchCount - 1));
    return [{ type: 'switch.disabled', id: control.id }];
  }
  const task = world.tasks.find(item => item.id === selected.id);
  if (!task || task.done || selected.kind !== 'task') return [];
  task.done = true;
  world.completedTasks += 1;
  return [{ type: 'task.completed', id: task.id }];
}

function seesPlayer(world) {
  const { enemy, player } = world;
  const dx = player.x - enemy.x, dz = player.z - enemy.z;
  const distance = Math.hypot(dx, dz);
  if (player.hiddenIn && (!player.peeking || distance >= 2)) return false;
  if (distance > 9 || !hasLineOfSight(world, enemy, player)) return false;
  if (distance <= 2) return true;
  return (-Math.sin(enemy.heading) * dx - Math.cos(enemy.heading) * dz) / distance >= .2;
}
const PATROL = [{ x: 4, z: 4 }, { x: -4, z: 4.7 }, { x: -6.3, z: .4 }, { x: -3.5, z: -4.2 }, { x: 2, z: -2.8 }, { x: 4.7, z: -.5 }];
export function updateEnemy(world, dt) {
  if (world.level !== 2 || !Number.isFinite(dt) || dt < 0) return [];
  const { enemy, player } = world;
  const events = [];
  let movementTime = dt;
  if (!enemy.active) {
    if (enemy.spawnIn === null) return events;
    const untilSpawn = enemy.spawnIn;
    enemy.spawnIn = Math.max(0, untilSpawn - dt);
    if (enemy.spawnIn > 1e-9) return events;
    enemy.spawnIn = null; enemy.active = true;
    movementTime = Math.max(0, dt - untilSpawn);
    if (Math.hypot(enemy.x - player.x, enemy.z - player.z) < 4.5) {
      const shape = geometry(world, enemy.radius);
      const corners = [{ x: -7.15, z: -5.15 }, { x: 7.15, z: -5.15 }, { x: -7.15, z: 5.15 }, { x: 7.15, z: 5.15 }]
        .filter(point => shape.allowed(point.x, point.z));
      corners.sort((a, b) => Math.hypot(b.x - player.x, b.z - player.z) - Math.hypot(a.x - player.x, a.z - player.z));
      if (corners[0]) { enemy.x = corners[0].x; enemy.z = corners[0].z; }
    }
    events.push({ type: 'enemy.spawned' });
  }
  enemy.speed = Math.min(2.7, 2.3 + .2 * Math.max(0, world.switchCount - 1));
  enemy.wakeElapsed += movementTime;
  const distance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  const heard = !player.hiddenIn && player.moving && distance <= (player.sneaking ? 2 : 6);
  const visible = seesPlayer(world);
  const spotted = visible || heard || (player.hiddenIn && enemy.sawHide);
  enemy.noiseLevel = heard ? (player.sneaking ? .3 : 1) : 0;
  const previousMode = enemy.mode;
  if (spotted) {
    enemy.mode = 'chase'; enemy.lastSeen = { x: player.x, z: player.z }; enemy.searchTime = 0;
  } else if (enemy.mode === 'chase' || enemy.mode === 'search') {
    enemy.mode = 'search'; enemy.searchTime += movementTime;
    if (enemy.searchTime >= 4) { enemy.mode = 'patrol'; enemy.lastSeen = null; enemy.patrolTarget = null; }
  }
  let target;
  if (enemy.mode === 'chase' || enemy.mode === 'search') target = enemy.lastSeen;
  else {
    const destinations = world.secret.open && world.secret.slide >= .95 ? [...PATROL, { x: 0, z: -7.5 }, { x: 1.5, z: -10.3 }] : PATROL;
    if (!enemy.patrolTarget || Math.hypot(enemy.x - enemy.patrolTarget.x, enemy.z - enemy.patrolTarget.z) < .4) {
      enemy.seed = (Math.imul(enemy.seed, 1664525) + 1013904223) >>> 0;
      enemy.patrolIndex = (enemy.patrolIndex + 1 + enemy.seed % (destinations.length - 1)) % destinations.length;
      enemy.patrolTarget = { ...destinations[enemy.patrolIndex] };
    }
    target = enemy.patrolTarget;
  }
  if (!target || movementTime <= 0) return events;
  enemy.repath -= movementTime;
  const targetKey = `${Math.round(target.x * 2)},${Math.round(target.z * 2)}`;
  if (enemy.repath <= 0 || previousMode !== enemy.mode || targetKey !== enemy.pathTarget || !enemy.path.length) {
    enemy.path = findPath(world, enemy, target, enemy.radius); enemy.pathTarget = targetKey; enemy.repath = .45;
  }
  let budget = enemy.speed * movementTime;
  for (let step = 0; budget > 1e-8 && enemy.path.length && step < 100; step++) {
    const next = enemy.path[0], dx = next.x - enemy.x, dz = next.z - enemy.z;
    const remaining = Math.hypot(dx, dz);
    if (remaining < .04) { enemy.path.shift(); continue; }
    const travel = Math.min(remaining, budget), before = { x: enemy.x, z: enemy.z };
    enemy.heading = Math.atan2(-dx, -dz);
    moveActor(world, enemy, dx / remaining * travel, dz / remaining * travel);
    budget -= travel;
    if (Math.hypot(enemy.x - before.x, enemy.z - before.z) < travel * .25) { enemy.repath = 0; break; }
    if (remaining <= travel + .04) enemy.path.shift();
  }
  return events;
}

export function isCaptured(world) {
  if (world.level !== 2 || !world.enemy.active) return false;
  const { player, enemy } = world;
  const distance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  if (player.hiddenIn && !enemy.sawHide && !(player.peeking && distance < 2)) return false;
  if (distance > player.radius + enemy.radius) return false;
  const behind = (enemy.x - player.x) * player.facing.x + (enemy.z - player.z) * player.facing.z < 0;
  return behind || hasLineOfSight(world, enemy, player);
}
