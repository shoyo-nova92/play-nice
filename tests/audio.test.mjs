import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

// Contract/lifecycle tests only: this graph cannot establish audible quality.
class AudioParamMock {
  constructor(value = 0) { this.value = value; }
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class AudioNodeMock {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.connections = [];
    this.stopped = false;
    for (const name of ['gain', 'frequency', 'detune', 'pan', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) {
      this[name] = new AudioParamMock();
    }
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start() { this.started = true; }
  stop(time) {
    this.stopAt = time ?? this.context.currentTime;
    if (time === undefined) { this.stopped = true; this.onended?.(); }
  }
}
class AudioContextMock {
  static instances = [];
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.nodes = [];
    this.destination = new AudioNodeMock(this, 'destination');
    AudioContextMock.instances.push(this);
  }
  node(type) { const node = new AudioNodeMock(this, type); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createConvolver() { return this.node('convolver'); }
  createBufferSource() { return this.node('buffer-source'); }
  createOscillator() { return this.node('oscillator'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('panner'); }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: index => data[index] };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.nodes) {
      if (node.stopAt <= this.currentTime && !node.stopped) {
        node.stopped = true;
        node.onended?.();
      }
    }
  }
}

const originalAudioContext = globalThis.AudioContext;
const originalWebkitContext = globalThis.webkitAudioContext;
const created = [];
afterEach(() => {
  for (const audio of created.splice(0)) audio.dispose();
  if (originalAudioContext === undefined) delete globalThis.AudioContext;
  else globalThis.AudioContext = originalAudioContext;
  if (originalWebkitContext === undefined) delete globalThis.webkitAudioContext;
  else globalThis.webkitAudioContext = originalWebkitContext;
  AudioContextMock.instances.length = 0;
});

function makeAudio(Context = AudioContextMock) {
  delete globalThis.webkitAudioContext;
  if (Context) globalThis.AudioContext = Context;
  else delete globalThis.AudioContext;
  const audio = createAudio();
  created.push(audio);
  return audio;
}
function state(overrides = {}) {
  return {
    phase: 'LEVEL_1', elapsed: 0, paused: false, muted: false, torchOn: true, events: [],
    world: {
      level: 1,
      player: { x: 0, z: 0, yaw: 0, distanceWalked: 0 },
      enemy: { x: 3, z: 0, active: false, speed: 2 },
    },
    ...overrides,
  };
}

test('audio stays lazy and repeated unlock/reset reuses one context', async () => {
  const audio = makeAudio();
  assert.equal(audio.getDiagnostics().contextCreated, false);
  audio.update(state({ phase: 'TITLE' }));
  assert.equal(AudioContextMock.instances.length, 0);
  assert.equal(await audio.unlock(), true);
  assert.equal(await audio.unlock(), true);
  audio.update(state({ phase: 'INTRO', elapsed: 4 }));
  audio.update(state({ phase: 'TITLE', elapsed: 0 }));
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.getDiagnostics().contextsCreated, 1);
  assert.equal(audio.getDiagnostics().loopSources, 8);
  assert.equal(audio.getDiagnostics().ready, true);
});

test('unsupported, denied resume and construction failure remain nonfatal', async () => {
  const unsupported = makeAudio(null);
  assert.equal(await unsupported.unlock(), false);
  assert.doesNotThrow(() => unsupported.update(state()));
  assert.equal(unsupported.getDiagnostics().supported, false);
  class DeniedContext extends AudioContextMock {
    resume() { return Promise.reject(new Error('User gesture required')); }
  }
  const denied = makeAudio(DeniedContext);
  assert.equal(await denied.unlock(), false);
  assert.match(denied.getDiagnostics().lastError, /gesture/);
  denied.update(state({ phase: 'INTRO' }));
  assert.equal(denied.getDiagnostics().cueTotal, 0);
  class FailedContext { constructor() { throw new Error('Audio device unavailable'); } }
  const failed = makeAudio(FailedContext);
  assert.equal(await failed.unlock(), false);
  assert.doesNotThrow(() => failed.update(state()));
  assert.match(failed.getDiagnostics().lastError, /device/);
});

test('partially failed graph does not schedule or break updates', async () => {
  class FailedGraph extends AudioContextMock {
    createConvolver() { throw new Error('Convolver unavailable'); }
  }
  const audio = makeAudio(FailedGraph);
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.getDiagnostics().ready, false);
  assert.doesNotThrow(() => audio.update(state({ phase: 'INTRO' })));
  assert.equal(audio.getDiagnostics().cueTotal, 0);
});

test('audio reads state without mutation and deduplicates phase/event cues', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'INTRO' });
  const before = JSON.stringify(snapshot);
  audio.update(snapshot, 0.016); audio.update(snapshot, 0.016);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(audio.getDiagnostics().cueCounts.intro, 1);
  snapshot.phase = 'LEVEL_1'; snapshot.events = [{ type: 'toy.picked', id: 'bear', serial: 1 }];
  audio.update(snapshot, 0.016); audio.update(snapshot, 0.016);
  assert.equal(audio.getDiagnostics().cueCounts['toy.picked'], 1);
  snapshot.events = [{ type: 'toy.picked', id: 'bear', serial: 1 }];
  audio.update(snapshot, 0.016);
  assert.equal(audio.getDiagnostics().cueCounts['toy.picked'], 1);
  snapshot.phase = 'TITLE'; snapshot.events = []; audio.update(snapshot, 0.016);
  snapshot.phase = 'LEVEL_1'; snapshot.events = [{ type: 'toy.picked', id: 'bear', serial: 1 }];
  audio.update(snapshot, 0.016);
  assert.equal(audio.getDiagnostics().cueCounts['toy.picked'], 2);
});

test('reveal impact starts at phase entry once and suppresses final happy delivery', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state(); audio.update(snapshot);
  snapshot.phase = 'LEVEL_TRANSITION';
  snapshot.phaseElapsed = 0;
  snapshot.events = [{ type: 'toy.delivered', id: 'duck', serial: 1 }];
  audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.reveal, 1);
  assert.equal(audio.getDiagnostics().cueCounts['toy.delivered'], undefined);
  snapshot.phaseElapsed = 1.34; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.reveal, 1);
});

test('footsteps require traveled distance and do not replay unchanged positions', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state(); audio.update(snapshot);
  snapshot.elapsed = 1; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], undefined);
  snapshot.world.player.distanceWalked = 1.4; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], 1);
  snapshot.world.player.distanceWalked = 2.8; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], 2);
});

test('enemy stereo follows yaw and heartbeat follows proximity', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'LEVEL_2' });
  snapshot.world.level = 2; snapshot.world.enemy.active = true;
  audio.update(snapshot);
  assert.equal(audio.getDiagnostics().enemyPan, 1);
  assert.ok(audio.getDiagnostics().cueCounts['enemy-step'] > 0);
  assert.ok(audio.getDiagnostics().cueCounts.heartbeat > 0);
  snapshot.world.player.yaw = Math.PI; snapshot.elapsed = 1;
  audio.update(snapshot);
  assert.ok(audio.getDiagnostics().enemyPan < -0.99);
  const beats = audio.getDiagnostics().cueCounts.heartbeat;
  snapshot.world.enemy.x = 14; snapshot.elapsed = 3; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.heartbeat, beats);
});

test('pause and mute silence voices and stop scheduling without a replay backlog', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ events: [{ type: 'toy.picked', serial: 1 }] });
  audio.update(snapshot);
  assert.ok(audio.getDiagnostics().activeVoices > 0);
  const cues = audio.getDiagnostics().cueTotal;
  snapshot.paused = true; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  snapshot.elapsed = 20; snapshot.events = [{ type: 'toy.picked', serial: 2 }];
  snapshot.world.player.distanceWalked = 100; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueTotal, cues);
  snapshot.paused = false; snapshot.muted = true; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueTotal, cues);
  snapshot.muted = false; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['toy.picked'], 1);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], undefined);
  assert.equal(audio.getDiagnostics().contextsCreated, 1);
});

test('torch semantic event and state fallback produce one click', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state(); audio.update(snapshot);
  snapshot.torchOn = false; snapshot.events = [{ type: 'torch.toggled', serial: 1 }];
  audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['torch.toggled'], 1);
  snapshot.torchOn = true; snapshot.events = []; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['torch.toggled'], 2);
});

test('rapid cues stay within voice budget and finished/disposed graphs disconnect', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state();
  for (let serial = 0; serial < 100; serial += 1) {
    snapshot.events = [{ type: 'toy.delivered', serial }]; audio.update(snapshot);
  }
  assert.equal(audio.getDiagnostics().peakVoices, 28);
  assert.ok(audio.getDiagnostics().activeVoices <= 28);
  const context = AudioContextMock.instances[0];
  context.advance(5);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  audio.dispose(); audio.dispose();
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  assert.equal(audio.getDiagnostics().loopSources, 0);
  assert.equal(audio.getDiagnostics().persistentNodes, 0);
  assert.equal(audio.getDiagnostics().ready, false);
  assert.equal(context.state, 'closed');
  assert.equal(context.nodes.filter(node => node.connections.length).length, 0);
  assert.equal(await audio.unlock(), false);
});

test('volume defaults match UI and clamp safely', async () => {
  const audio = makeAudio(); await audio.unlock();
  assert.equal(audio.getDiagnostics().volume, 0.55);
  audio.setVolume(10); assert.equal(audio.getDiagnostics().volume, 1);
  audio.setVolume(-1); assert.equal(audio.getDiagnostics().volume, 0);
  audio.setVolume(NaN); assert.equal(audio.getDiagnostics().volume, 0);
  audio.setVolume(0.4); audio.setMuted(true);
  assert.equal(audio.getDiagnostics().muted, true);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
});

test('rain remains continuous and thunder follows lightning by 1.2 seconds once per cycle', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state();
  audio.update(snapshot);
  assert.equal(audio.getDiagnostics().loopSources, 8);
  assert.ok(audio.getDiagnostics().cueCounts['window-patter'] > 0);
  assert.ok(audio.getDiagnostics().windowPan < 0);
  snapshot.elapsed = 1; audio.update(snapshot);
  snapshot.elapsed = 2.199; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, undefined);
  snapshot.elapsed = 2.2; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, 1);
  snapshot.elapsed = 12; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, 1);
  snapshot.elapsed = 13.2; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, 2);
  snapshot.world.player.yaw = Math.PI; audio.update(snapshot);
  assert.ok(audio.getDiagnostics().windowPan > 0);
});

test('muted weather crosses silently without delayed thunder backlog', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state(); audio.update(snapshot);
  snapshot.muted = true; snapshot.elapsed = 2.2; audio.update(snapshot);
  snapshot.muted = false; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, undefined);
  snapshot.elapsed = 13.2; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.thunder, 1);
  const cues = audio.getDiagnostics().cueTotal;
  snapshot.paused = true; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueTotal, cues);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
});

test('six capture beats fit the 6.2-second scaled timeline and LOSE does not catch twice', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'LEVEL_2', elapsed: 20 });
  snapshot.world.level = 2; snapshot.world.enemy.active = true;
  audio.update(snapshot);
  snapshot.phase = 'CAPTURE'; snapshot.phaseElapsed = 0;
  const beats = [[0, 'grab'], [.6, 'fall'], [.8, 'drag'], [3, 'lift'], [5.2, 'smile'], [6.5, 'break']];
  for (const [at, name] of beats) {
    if (at > 0) {
      snapshot.phaseElapsed = at * 6.2 / 8 - .001; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
      assert.equal(audio.getDiagnostics().cueCounts[`capture.${name}`], undefined);
    }
    snapshot.phaseElapsed = at * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot); audio.update(snapshot);
    assert.equal(audio.getDiagnostics().cueCounts[`capture.${name}`], 1);
  }
  assert.deepEqual([...audio.getDiagnostics().captureBeats].sort(), [...beats.map(([, name]) => name), 'torch'].sort());
  assert.equal(audio.getDiagnostics().cueCounts['capture.torch'], 1);
  snapshot.phase = 'LOSE'; snapshot.reason = 'The mascot caught you.'; snapshot.elapsed = 26.2;
  audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts.capture, undefined);
  assert.equal(audio.getDiagnostics().cueCounts.timeout, undefined);
  assert.equal(audio.getDiagnostics().cueCounts['capture.grab'], 1);
});

test('capture pause holds beats and mute skips past beats without replaying them', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'CAPTURE', phaseElapsed: 0, elapsed: 20 });
  snapshot.world.level = 2; audio.update(snapshot);
  snapshot.paused = true; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  assert.equal(audio.getDiagnostics().cueCounts['capture.fall'], undefined);
  snapshot.paused = false; snapshot.phaseElapsed = .6 * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.fall'], 1);
  snapshot.muted = true; snapshot.phaseElapsed = 3 * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
  snapshot.muted = false; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.drag'], undefined);
  assert.equal(audio.getDiagnostics().cueCounts['capture.lift'], undefined);
  snapshot.phaseElapsed = 5.2 * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.smile'], 1);
  snapshot.phase = 'TITLE'; snapshot.elapsed = 0; audio.update(snapshot);
  snapshot.phase = 'CAPTURE'; snapshot.phaseElapsed = 0; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.grab'], 2);
  assert.equal(audio.getDiagnostics().contextsCreated, 1);
});

test('cleanup cues deduplicate and final job yields to the reveal impact', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ events: [{ type: 'task.completed', id: 'spill-1', serial: 1 }] });
  audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['task.completed'], 1);
  snapshot.events = [{ type: 'task.completed', id: 'blocks', serial: 2 }];
  snapshot.phase = 'LEVEL_TRANSITION'; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['task.completed'], 1);
  assert.equal(audio.getDiagnostics().cueCounts.reveal, 1);
});

test('wrong control produces one distinct rejection for each serial', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'LEVEL_2', events: [{ type: 'control.wrong', id: 'switch-2', serial: 1 }] });
  snapshot.world.level = 2;
  audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['control.wrong'], 1);
  assert.equal(audio.getDiagnostics().cueCounts['switch.disabled'], undefined);
  snapshot.events = [{ type: 'control.wrong', id: 'switch-2', serial: 2 }]; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['control.wrong'], 2);
  snapshot.muted = true; snapshot.events = [{ type: 'control.wrong', serial: 3 }]; audio.update(snapshot);
  snapshot.muted = false; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['control.wrong'], 2);
});

test('layered capture keeps its transient budget, limiter and disposal bounds', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'CAPTURE', phaseElapsed: 0, elapsed: 20 });
  snapshot.world.level = 2;
  audio.update(snapshot);
  const context = AudioContextMock.instances[0];
  const sourceCount = () => context.nodes.filter(node => ['oscillator', 'buffer-source'].includes(node.kind)).length;
  // At least five transient grab layers supplement the eight persistent beds.
  assert.ok(sourceCount() >= 13);
  const once = sourceCount(); audio.update(snapshot);
  assert.equal(sourceCount(), once);
  for (const time of [.6, .8, 3, 5.2, 6.5]) {
    snapshot.phaseElapsed = time * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
    assert.ok(audio.getDiagnostics().activeVoices <= 28);
  }
  assert.equal(audio.getDiagnostics().contextsCreated, 1);
  assert.equal(audio.getDiagnostics().loopSources, 8);
  assert.equal(audio.getDiagnostics().cueCounts['capture.break'], 1);
  const limiter = context.nodes.find(node => node.kind === 'compressor');
  assert.equal(limiter.ratio.value, 20);
  assert.equal(limiter.threshold.value, -8);
  assert.equal(audio.getDiagnostics().volume, .55);
  audio.setMuted(true);
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  audio.dispose();
  assert.equal(context.nodes.filter(node => node.connections.length).length, 0);
});

test('dropped torch bounces once before the floor hit on the accelerated timeline', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'CAPTURE', phaseElapsed: 0, elapsed: 20 });
  snapshot.world.level = 2; audio.update(snapshot);
  snapshot.phaseElapsed = .18 * 6.2 / 8 - .001; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.torch'], undefined);
  snapshot.phaseElapsed = .18 * 6.2 / 8; snapshot.elapsed = 20 + snapshot.phaseElapsed; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['capture.torch'], 1);
  assert.equal(audio.getDiagnostics().cueCounts['capture.fall'], undefined);
  assert.ok(audio.getDiagnostics().activeVoices <= 28);
});

test('hiding silences player footsteps, adds breathing/peek cloth and consumes distance', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state(); audio.update(snapshot);
  snapshot.world.player.hiddenIn = 'hide-box-1'; snapshot.world.player.peeking = false;
  snapshot.world.player.distanceWalked = 20;
  snapshot.events = [{ type: 'hide.entered', id: 'hide-box-1', serial: 1 }];
  snapshot.elapsed = 1; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['hide.entered'], 1);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], undefined);
  assert.equal(audio.getDiagnostics().cueCounts['hide.breath'], 1);
  snapshot.world.player.peeking = true; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['hide.peek'], 1);
  snapshot.world.player.hiddenIn = null; snapshot.world.player.peeking = false;
  snapshot.events = [{ type: 'hide.exited', id: 'hide-box-1', serial: 2 }]; audio.update(snapshot); audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['hide.exited'], 1);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], undefined);
  snapshot.world.player.distanceWalked = 21.4; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['player-step'], 1);
});

test('patrol footsteps follow actual motion and joints remain positional without fake stationary steps', async () => {
  const audio = makeAudio(); await audio.unlock();
  const snapshot = state({ phase: 'LEVEL_2' });
  snapshot.world.level = 2; snapshot.world.enemy.active = true; snapshot.world.enemy.mode = 'patrol';
  snapshot.world.enemy.speed = 2.3;
  audio.update(snapshot);
  const steps = audio.getDiagnostics().cueCounts['enemy-step'];
  snapshot.elapsed = 1; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['enemy-step'], steps);
  snapshot.world.enemy.x += .5; snapshot.elapsed = 1.5; audio.update(snapshot);
  snapshot.world.enemy.x += .5; snapshot.elapsed = 2; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueCounts['enemy-step'], steps + 1);
  assert.ok(audio.getDiagnostics().enemyPan > .99);
  assert.ok(audio.getDiagnostics().cueCounts['enemy-joint'] > 0);
  snapshot.paused = true; audio.update(snapshot);
  const total = audio.getDiagnostics().cueTotal;
  snapshot.elapsed = 5; audio.update(snapshot);
  assert.equal(audio.getDiagnostics().cueTotal, total);
});
