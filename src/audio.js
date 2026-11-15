const MAX_VOICES = 28;
const LOOP_COUNT = 8;
const ACTIVE_PHASES = new Set(['LEVEL_1', 'LEVEL_2']);
const CAPTURE_BEATS = [[0, 'grab'], [0.6, 'fall'], [0.8, 'drag'], [3, 'lift'], [5.2, 'smile'], [6.5, 'break']];
const CAPTURE_TIME_SCALE = 8 / 6.2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Original, local Web Audio sound design. No DOM, game writes, timers or downloads. */
export function createAudio() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let context = null;
  let constructionAttempted = false;
  let disposed = false;
  let muted = false;
  let paused = false;
  let volume = 0.55;
  let lastError = '';
  let master, limiter, ambience, effects, roomSend, reverb, noiseBuffer;
  const persistentNodes = [];
  const loops = [];
  const voices = new Set();
  let peakVoices = 0;
  let contextsCreated = 0;
  let cueTotal = 0;
  const cueCounts = Object.create(null);
  let randomState = 71321;
  let lastPhase = null;
  let lastElapsed = 0;
  let clock = 0;
  let lastSerial = -1;
  let seenObjects = new WeakSet();
  let nextMelody = 1.2;
  let melodyIndex = 0;
  let nextCreak = 4;
  let nextPulse = 0;
  let nextHeartbeat = 0;
  let nextEnemyStep = 0;
  let stepDistance = 0;
  let foot = 1;
  let enemyPan = 0;
  let enemyDistance = null;
  let lastTorch = null;
  let lastThunderCycle = null;
  let nextPatter = 0;
  let nextCloth = 0;
  let windowPan = 0;
  let captureBeats = new Set();
  let nextJoint = 0;
  let nextHiddenBreath = 0;
  let wasPeeking = false;
  let lastEnemyPosition = null;
  let enemyStepDistance = 0;

  const random = () => ((randomState = (1664525 * randomState + 1013904223) >>> 0) / 4294967296);
  function smooth(param, value, seconds = 0.06) {
    if (!context || !param) return;
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  }
  function applyVolume() { if (master) smooth(master.gain, disposed || muted || paused ? 0 : volume * 0.6, 0.025); }
  function disconnect(node) { try { node?.disconnect(); } catch { /* Already disconnected. */ } }
  function stopVoice(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Source may already have ended. */ }
    voice.nodes.forEach(disconnect);
  }
  function clearVoices() { for (const voice of [...voices]) stopVoice(voice); }
  function canPlay() { return context?.state === 'running' && loops.length === LOOP_COUNT && !disposed && !muted && !paused && volume > 0; }
  function countCue(name) { cueTotal += 1; cueCounts[name] = (cueCounts[name] ?? 0) + 1; }

  function makeLoop({ frequency, type = 'sine', noise = false, filter = 350, filterType = 'lowpass', pan = null }) {
    const source = noise ? context.createBufferSource() : context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0;
    const nodes = [source, gain];
    if (noise) {
      source.buffer = noiseBuffer;
      source.loop = true;
      const tone = context.createBiquadFilter();
      tone.type = filterType; tone.frequency.value = filter; tone.Q.value = 0.4;
      source.connect(tone); tone.connect(gain); nodes.push(tone);
    } else {
      source.type = type;
      source.frequency.value = frequency;
      source.connect(gain);
    }
    let panner = null;
    if (pan !== null && typeof context.createStereoPanner === 'function') {
      panner = context.createStereoPanner(); panner.pan.value = pan;
      gain.connect(panner); panner.connect(ambience); nodes.push(panner);
    } else gain.connect(ambience);
    source.start();
    const loop = { source, gain, panner, nodes };
    loops.push(loop);
    return loop;
  }

  function buildGraph() {
    master = context.createGain(); master.gain.value = 0;
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 2; limiter.ratio.value = 20;
    limiter.attack.value = 0.003; limiter.release.value = 0.2;
    ambience = context.createGain(); ambience.gain.value = 1;
    effects = context.createGain(); effects.gain.value = 1;
    roomSend = context.createGain(); roomSend.gain.value = 0.16;
    reverb = context.createConvolver();
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noise.length; index += 1) noise[index] = random() * 2 - 1;
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 1.4), context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (random() * 2 - 1) * (1 - index / data.length) ** 3 * 0.28;
      }
    }
    reverb.buffer = impulse;
    ambience.connect(master); effects.connect(master);
    effects.connect(roomSend); roomSend.connect(reverb); reverb.connect(master);
    master.connect(limiter); limiter.connect(context.destination);
    persistentNodes.push(master, limiter, ambience, effects, roomSend, reverb);
    makeLoop({ frequency: 47 });
    makeLoop({ frequency: 47.35 });
    makeLoop({ frequency: 94, type: 'triangle' });
    makeLoop({ noise: true, filter: 430 });
    makeLoop({ frequency: 34 });
    makeLoop({ noise: true, filter: 870 });
    makeLoop({ noise: true, filter: 1350, filterType: 'lowpass', pan: -0.4 });
    makeLoop({ noise: true, filter: 3200, filterType: 'bandpass', pan: -0.6 });
    applyVolume();
  }

  // A voice owns every transient node it creates; end/steal/pause all disconnect it.
  function sound({ frequency = 220, endFrequency, type = 'sine', duration = 0.3,
    attack = 0.008, gain = 0.1, pan = 0, noise = false, filter = 900,
    filterType = 'lowpass', q = 0.7, delay = 0, detune = 0 } = {}) {
    if (!canPlay()) return;
    while (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);
    const start = context.currentTime + delay;
    const source = noise ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    const nodes = [source, envelope];
    let output = source;
    if (noise) {
      source.buffer = noiseBuffer;
      source.loop = true;
      const tone = context.createBiquadFilter();
      tone.type = filterType; tone.frequency.value = filter; tone.Q.value = q;
      source.connect(tone); output = tone; nodes.push(tone);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, start);
      source.detune.value = detune;
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    }
    output.connect(envelope);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(attack, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner(); panner.pan.value = clamp(pan, -1, 1);
      envelope.connect(panner); panner.connect(effects); nodes.push(panner);
    } else envelope.connect(effects);
    const voice = { source, nodes, end: start + duration + 0.03 };
    voices.add(voice); peakVoices = Math.max(peakVoices, voices.size);
    source.onended = () => { if (voices.delete(voice)) nodes.forEach(disconnect); };
    source.start(start, ...(noise ? [random() * 1.8] : []));
    source.stop(voice.end);
  }

  function chime(frequency, pan = 0, delay = 0, gain = 0.075) {
    sound({ frequency, gain, pan, delay, duration: 1.3 });
    sound({ frequency: frequency * 2.004, gain: gain * 0.23, pan, delay, duration: 0.7 });
  }
  function cue(type) {
    if (!canPlay()) return;
    countCue(type);
    switch (type) {
      case 'intro': chime(392, -0.15); chime(466.16, 0.2, 0.25, 0.045); break;
      case 'toy.picked':
        sound({ noise: true, filter: 1800, gain: 0.055, duration: 0.12 });
        chime(659.25, 0, 0.03, 0.05); break;
      case 'toy.delivered': chime(523.25, -0.12); chime(783.99, 0.12, 0.12); break;
      case 'task.completed':
        sound({ noise: true, filterType: 'bandpass', filter: 1250, gain: 0.095, attack: 0.025, duration: 0.27, pan: -0.1 });
        sound({ noise: true, filter: 420, gain: 0.07, duration: 0.15, delay: 0.11, pan: 0.1 });
        chime(659.25, 0, 0.13, 0.045); break;
      case 'switch.disabled':
        sound({ noise: true, filter: 2500, gain: 0.11, duration: 0.07 });
        sound({ frequency: 110, endFrequency: 48, type: 'triangle', gain: 0.17, duration: 0.45 }); break;
      case 'interaction.wrong': case 'exit.locked':
        sound({ frequency: 147, endFrequency: 131, type: 'triangle', gain: 0.09, duration: 0.18 });
        sound({ frequency: 139, gain: 0.05, duration: 0.23 }); break;
      case 'control.wrong':
        sound({ noise: true, filterType: 'bandpass', filter: 1450, q: 1.2, gain: 0.11, duration: 0.06 });
        sound({ frequency: 164.81, endFrequency: 116.54, type: 'sawtooth', gain: 0.055, duration: 0.2 });
        sound({ frequency: 155.56, endFrequency: 110, type: 'triangle', gain: 0.08, duration: 0.27, delay: 0.09 }); break;
      case 'hide.entered':
        sound({ noise: true, filter: 520, gain: 0.1, attack: 0.025, duration: 0.38, pan: -0.12 });
        sound({ frequency: 140, endFrequency: 75, type: 'triangle', gain: 0.065, duration: 0.2 });
        sound({ noise: true, filterType: 'bandpass', filter: 900, gain: 0.04, attack: 0.08, duration: 0.5, delay: 0.1 }); break;
      case 'hide.exited':
        sound({ noise: true, filterType: 'bandpass', filter: 1350, gain: 0.085, attack: 0.035, duration: 0.35, pan: 0.13 });
        sound({ frequency: 96, endFrequency: 154, type: 'triangle', gain: 0.045, duration: 0.24 }); break;
      case 'hide.peek':
        sound({ noise: true, filterType: 'bandpass', filter: 1150, gain: 0.045, attack: 0.035, duration: 0.27, pan: -0.12 }); break;
      case 'torch.toggled':
        sound({ noise: true, filter: 3000, gain: 0.07, duration: 0.035 });
        sound({ frequency: 780, endFrequency: 450, gain: 0.035, duration: 0.045 }); break;
      case 'enemy.spawned':
        sound({ noise: true, filter: 210, gain: 0.22, attack: 0.13, duration: 1.5, pan: enemyPan });
        sound({ frequency: 88, endFrequency: 37, type: 'triangle', gain: 0.16, duration: 1.2, pan: enemyPan }); break;
      case 'reveal':
        clearVoices();
        sound({ noise: true, filter: 1500, gain: 0.29, duration: 0.8 });
        sound({ frequency: 125, endFrequency: 29, gain: 0.37, duration: 1.25 });
        sound({ frequency: 48, endFrequency: 34, type: 'triangle', gain: 0.14, duration: 1.25 }); break;
      case 'capture': case 'capture.grab':
        clearVoices();
        // The jump comes from fast contrast and separated frequency layers,
        // while the shared master and limiter retain the user's output level.
        sound({ noise: true, filterType: 'bandpass', filter: 2100, q: 0.8, gain: 0.27, attack: 0.002, duration: 0.19 });
        sound({ noise: true, filter: 750, gain: 0.23, attack: 0.004, duration: 0.6, pan: -0.18 });
        sound({ frequency: 185, endFrequency: 36, type: 'triangle', gain: 0.31, attack: 0.003, duration: 0.75 });
        sound({ frequency: 720, endFrequency: 285, type: 'sawtooth', gain: 0.045, attack: 0.005, duration: 0.29, pan: 0.22 });
        sound({ noise: true, filterType: 'highpass', filter: 2600, gain: 0.075, duration: 0.08, delay: 0.07, pan: 0.4 }); break;
      case 'capture.fall':
        sound({ noise: true, filter: 720, gain: 0.29, attack: 0.003, duration: 0.37 });
        sound({ frequency: 120, endFrequency: 27, gain: 0.3, attack: 0.003, duration: 0.7 });
        sound({ noise: true, filterType: 'bandpass', filter: 1700, q: 1.1, gain: 0.115, duration: 0.09, delay: 0.035, pan: -0.3 });
        sound({ frequency: 210, endFrequency: 160, type: 'triangle', gain: 0.055, duration: 0.27, delay: 0.12, pan: 0.25 }); break;
      case 'capture.torch':
        // Three diminishing metal bounces and a short rolling rattle, all finite.
        for (let i = 0; i < 3; i += 1) {
          const delay = i * 0.13;
          sound({ frequency: 1180 - i * 145, endFrequency: 780 - i * 110, type: 'triangle',
            gain: 0.075 / (1 + i), attack: 0.002, duration: 0.2, delay, pan: 0.3 + i * 0.08 });
          sound({ noise: true, filterType: 'bandpass', filter: 2600 - i * 200, q: 2.5,
            gain: 0.07 / (1 + i), duration: 0.055, delay, pan: 0.3 + i * 0.08 });
        }
        sound({ noise: true, filterType: 'bandpass', filter: 1550, q: 2.2,
          gain: 0.055, attack: 0.05, duration: 0.55, delay: 0.28, pan: 0.5 }); break;
      case 'capture.drag':
        sound({ noise: true, filterType: 'bandpass', filter: 820, q: 1.2, gain: 0.19, attack: 0.08, duration: 2.15, pan: -0.25 });
        sound({ noise: true, filter: 220, gain: 0.12, attack: 0.12, duration: 2.05, pan: 0.2 });
        for (let i = 0; i < 4; i += 1) {
          sound({ noise: true, filterType: 'bandpass', filter: 1100 + i * 170, gain: 0.075,
            attack: 0.03, duration: 0.28, delay: 0.18 + i * 0.45, pan: i % 2 ? 0.28 : -0.28 });
        }
        break;
      case 'capture.lift':
        sound({ noise: true, filterType: 'bandpass', filter: 1550, gain: 0.14, attack: 0.08, duration: 1.15 });
        sound({ frequency: 77, endFrequency: 225, type: 'triangle', gain: 0.1, attack: 0.08, duration: 1.85, pan: 0.18 });
        sound({ frequency: 109, endFrequency: 310, type: 'sawtooth', gain: 0.032, attack: 0.12, duration: 1.5, pan: -0.2 });
        sound({ noise: true, filter: 420, gain: 0.07, attack: 0.2, duration: 1.7, delay: 0.25 }); break;
      case 'capture.smile':
        sound({ frequency: 466.16, endFrequency: 440, gain: 0.08, attack: 0.045, duration: 1.3, pan: -0.3 });
        sound({ frequency: 493.88, endFrequency: 520, gain: 0.065, attack: 0.045, duration: 1.3, pan: 0.3 });
        sound({ frequency: 97, endFrequency: 63, type: 'triangle', gain: 0.1, attack: 0.08, duration: 1.25 });
        sound({ noise: true, filterType: 'bandpass', filter: 690, q: 2.2, gain: 0.11, attack: 0.13, duration: 1.15 });
        sound({ noise: true, filterType: 'highpass', filter: 3500, gain: 0.04, duration: 0.07, delay: 0.52, pan: -0.25 }); break;
      case 'capture.break':
        sound({ noise: true, filterType: 'highpass', filter: 3300, gain: 0.25, attack: 0.001, duration: 0.32 });
        sound({ noise: true, filterType: 'bandpass', filter: 4800, q: 2, gain: 0.13, duration: 0.22, delay: 0.06, pan: 0.55 });
        sound({ noise: true, filterType: 'highpass', filter: 4300, gain: 0.09, duration: 0.12, delay: 0.16, pan: -0.55 });
        sound({ noise: true, filterType: 'bandpass', filter: 2700, q: 2.5, gain: 0.065, duration: 0.3, delay: 0.31, pan: 0.22 });
        sound({ frequency: 155, endFrequency: 29, gain: 0.27, attack: 0.003, duration: 1.35 });
        sound({ frequency: 820, endFrequency: 570, type: 'triangle', gain: 0.035, duration: 0.65, delay: 0.04, pan: -0.15 }); break;
      case 'timeout':
        sound({ frequency: 196, endFrequency: 49, gain: 0.18, duration: 1.3 });
        sound({ frequency: 207.65, endFrequency: 51.9, gain: 0.09, duration: 1.3 }); break;
      case 'win':
        clearVoices();
        chime(392, -0.2, 0, 0.075); chime(523.25, 0.15, 0.22, 0.07);
        chime(587.33, -0.1, 0.48, 0.045);
        sound({ noise: true, filter: 1900, attack: 0.4, gain: 0.045, duration: 1.6 }); break;
    }
  }

  function resetTracking(now, distance = 0) {
    clearVoices();
    lastSerial = -1; seenObjects = new WeakSet();
    nextMelody = now + 1.2; nextCreak = now + 4;
    nextPulse = now; nextHeartbeat = now; nextEnemyStep = now;
    melodyIndex = 0; stepDistance = distance; foot = 1;
    lastThunderCycle = Math.floor((now - 2.2) / 11);
    nextPatter = now + 0.1; nextCloth = now + 2; captureBeats.clear();
    nextJoint = now + 1.8; nextHiddenBreath = now; wasPeeking = false;
    lastEnemyPosition = null; enemyStepDistance = 0;
  }

  function panFrom(player, x, z) {
    if (!player) return 0;
    const dx = x - player.x, dz = z - player.z;
    const distance = Math.hypot(dx, dz), yaw = player.yaw ?? 0;
    return distance > 0.001 ? clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance, -1, 1) : 0;
  }
  function captureTimeline(state, audible) {
    if (state.phase !== 'CAPTURE') return;
    const elapsed = Math.max(0, Number.isFinite(state.phaseElapsed) ? state.phaseElapsed : 0) * CAPTURE_TIME_SCALE;
    for (const [at, name] of CAPTURE_BEATS) {
      if (elapsed + 1e-8 < at || captureBeats.has(name)) continue;
      captureBeats.add(name);
      if (audible) cue(`capture.${name}`);
    }
    if (elapsed + 1e-8 >= 0.18 && !captureBeats.has('torch')) {
      captureBeats.add('torch');
      if (audible) cue('capture.torch');
    }
  }
  function weather(state, now, audible) {
    // Renderer lightning is at elapsed%11=1; this arrives 1.2 seconds later.
    const cycle = Math.floor((now - 2.2 + 1e-8) / 11);
    const crossed = lastThunderCycle !== null && cycle > lastThunderCycle;
    lastThunderCycle = cycle;
    const player = state.world?.player;
    windowPan = panFrom(player, -8, -1.5);
    if (!audible) { nextPatter = now + 0.15; return; }
    if (loops[6].panner) smooth(loops[6].panner.pan, windowPan * 0.6);
    if (loops[7].panner) smooth(loops[7].panner.pan, windowPan * 0.88);
    const distance = player ? Math.hypot(player.x + 8, player.z + 1.5) : 8;
    const windowGain = 0.4 + 0.6 * clamp(1 - distance / 18, 0, 1);
    const resultGain = ['WIN', 'LOSE'].includes(state.phase) ? 0.55 : 1;
    smooth(loops[6].gain.gain, (0.032 + 0.006 * Math.sin(now * 0.29)) * resultGain);
    smooth(loops[7].gain.gain, (0.026 + 0.005 * Math.sin(now * 0.73)) * windowGain * resultGain);
    if (crossed && state.phase !== 'TITLE') {
      countCue('thunder');
      sound({ noise: true, filter: 310, gain: 0.14, attack: 0.12, duration: 3.3, pan: windowPan * 0.7 });
      sound({ frequency: 57, endFrequency: 26, gain: 0.08, attack: 0.08, duration: 2.4, pan: windowPan * 0.45 });
      sound({ noise: true, filter: 150, gain: 0.08, attack: 0.18, duration: 2.3, delay: 0.35, pan: -windowPan * 0.25 });
    }
    if (now >= nextPatter) {
      countCue('window-patter');
      sound({ noise: true, filterType: 'bandpass', filter: 1900 + random() * 1700,
        q: 1.4, gain: (0.015 + random() * 0.015) * windowGain, duration: 0.045 + random() * 0.055,
        pan: clamp(windowPan * 0.8 + (random() - 0.5) * 0.15, -1, 1) });
      nextPatter = now + 0.18 + random() * 0.26;
    }
  }

  function scheduleEnvironment(state, now) {
    const player = state.world?.player;
    const enemy = state.world?.enemy;
    const horror = state.phase === 'LEVEL_TRANSITION' || state.world?.level === 2;
    const result = state.phase === 'WIN' || state.phase === 'LOSE';
    const roomGain = result ? 0.2 : 1;
    smooth(loops[0].gain.gain, (horror ? 0.018 : 0.032) * roomGain);
    smooth(loops[1].gain.gain, (horror ? 0.013 : 0.025) * roomGain);
    smooth(loops[2].gain.gain, (horror ? 0.005 : 0.008) * roomGain);
    smooth(loops[3].gain.gain, (horror ? 0.012 : 0.019) * roomGain);
    smooth(loops[4].gain.gain, horror ? 0.045 * roomGain : 0);
    smooth(loops[5].gain.gain, horror ? (0.012 + 0.022 * Math.max(0, Math.sin(now * 1.1))) * roomGain : 0);
    if (state.phase === 'CAPTURE') return;
    if (result || state.phase === 'TITLE') return;
    if (!horror && now >= nextMelody) {
      const melody = [523.25, 622.25, 783.99, 739.99, 622.25, 493.88];
      const pitch = melody[melodyIndex++ % melody.length];
      countCue('toybox'); chime(pitch * (1 + (random() - 0.5) * 0.003), (random() - 0.5) * 1.2, 0, 0.045);
      nextMelody = now + 2.4 + random() * 1.8;
    }
    if (now >= nextCreak) {
      countCue('creak');
      const pan = random() * 1.6 - 0.8;
      sound({ frequency: 145 + random() * 90, endFrequency: 420 + random() * 140,
        type: 'triangle', duration: 0.9, attack: 0.15, gain: 0.028, pan });
      sound({ noise: true, filterType: 'bandpass', filter: 780, q: 3,
        duration: 1.2, attack: 0.18, gain: 0.045, pan });
      nextCreak = now + (horror ? 5 : 7) + random() * 5;
    }
    if (horror && now >= nextPulse) {
      countCue('horror-pulse');
      sound({ frequency: 43, endFrequency: 32, gain: 0.1, duration: 0.9, attack: 0.06 });
      nextPulse = now + 2.7;
    }
    if (!ACTIVE_PHASES.has(state.phase) || !player) return;
    const walked = Number.isFinite(player.distanceWalked) ? player.distanceWalked : stepDistance;
    const hidden = Boolean(player.hiddenIn);
    if (hidden) {
      stepDistance = walked;
      if (now >= nextHiddenBreath) {
        countCue('hide.breath');
        sound({ noise: true, filterType: 'bandpass', filter: player.peeking ? 680 : 370,
          q: 0.8, gain: 0.045, attack: 0.25, duration: 1.05 });
        nextHiddenBreath = now + 1.8 + random() * 0.6;
      }
      if (Boolean(player.peeking) !== wasPeeking) cue('hide.peek');
    } else nextHiddenBreath = now + 0.4;
    wasPeeking = hidden && Boolean(player.peeking);
    if (walked < stepDistance) stepDistance = walked;
    if (!hidden && walked - stepDistance >= (player.sneaking ? 1.05 : 1.25)) {
      stepDistance = walked; foot *= -1;
      countCue('player-step');
      const stepGain = player.sneaking ? 0.35 : 1;
      sound({ noise: true, filter: player.sneaking ? 550 : 820, gain: 0.085 * stepGain, duration: 0.13, pan: foot * 0.16 });
      sound({ frequency: 92, endFrequency: 48, gain: 0.065 * stepGain, duration: 0.12, pan: foot * 0.16 });
    }
    if (!horror || !enemy?.active) { lastEnemyPosition = null; enemyStepDistance = 0; return; }
    const dx = enemy.x - player.x, dz = enemy.z - player.z;
    enemyDistance = Math.hypot(dx, dz);
    const yaw = player.yaw ?? 0;
    enemyPan = enemyDistance > 0.001 ? clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / enemyDistance, -1, 1) : 0;
    const closeness = clamp(1 - enemyDistance / 12, 0, 1);
    if (lastEnemyPosition) {
      enemyStepDistance += Math.min(0.75, Math.hypot(enemy.x - lastEnemyPosition.x, enemy.z - lastEnemyPosition.z));
    }
    const firstEnemyPosition = !lastEnemyPosition;
    lastEnemyPosition = { x: enemy.x, z: enemy.z };
    if (now >= nextJoint && enemyDistance < 13) {
      countCue('enemy-joint');
      sound({ noise: true, filterType: 'bandpass', filter: 1700, q: 2.5,
        gain: 0.025 + closeness * 0.055, attack: 0.002, duration: 0.065, pan: enemyPan });
      sound({ frequency: 270, endFrequency: 105, type: 'triangle',
        gain: 0.02 + closeness * 0.035, duration: 0.12, delay: 0.045, pan: enemyPan });
      nextJoint = now + 2.4 + random() * 2.4;
    }
    if (now >= nextCloth) {
      countCue('cloth-rustle');
      sound({ noise: true, filterType: 'bandpass', filter: 1200, gain: 0.02 + closeness * 0.04,
        attack: 0.03, duration: 0.35, pan: enemyPan });
      nextCloth = now + 1.1 + random() * 0.65;
    }
    // Patrol/chase/search all use actual travel; a listening pause has no fake steps.
    if (now >= nextEnemyStep && (firstEnemyPosition || enemyStepDistance >= 0.9)) {
      enemyStepDistance = 0;
      countCue('enemy-step');
      sound({ frequency: 63, endFrequency: 27, gain: 0.055 + closeness * 0.12,
        duration: 0.25, pan: enemyPan });
      sound({ noise: true, filter: 480, gain: 0.025 + closeness * 0.08,
        duration: 0.21, pan: enemyPan });
      nextEnemyStep = now + 0.75 / Math.max(1, enemy.speed ?? 2);
    }
    if (now >= nextHeartbeat && enemyDistance < 10) {
      countCue('heartbeat');
      const gain = 0.035 + closeness * 0.09;
      sound({ frequency: 59, endFrequency: 38, gain, duration: 0.14 });
      sound({ frequency: 51, endFrequency: 34, gain: gain * 0.7, duration: 0.16, delay: 0.15 });
      nextHeartbeat = now + 1.15 - closeness * 0.65;
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (muted) clearVoices();
    applyVolume();
  }
  function setVolume(value) {
    if (Number.isFinite(value)) volume = clamp(value, 0, 1);
    if (volume === 0) clearVoices();
    applyVolume();
  }

  return {
    unlock() {
      if (disposed || !AudioContextClass) return Promise.resolve(false);
      try {
        if (!context && !constructionAttempted) {
          constructionAttempted = true;
          context = new AudioContextClass({ latencyHint: 'interactive' });
          contextsCreated += 1;
          buildGraph();
        }
        if (!context || context.state === 'closed' || loops.length !== LOOP_COUNT) return Promise.resolve(false);
        // resume is invoked in the gesture's synchronous stack; rejection is absorbed.
        return Promise.resolve(context.resume()).then(() => context.state === 'running').catch((error) => {
          lastError = error?.message ?? 'Audio resume was blocked.'; return false;
        });
      } catch (error) { lastError = error?.message ?? 'Audio is unavailable.'; return Promise.resolve(false); }
    },
    update(state, dt = 0) {
      if (disposed || !state) return;
      try {
        const now = Number.isFinite(state.elapsed) ? state.elapsed : clock + Math.max(0, Math.min(0.1, dt || 0));
        clock = now;
        const restart = (lastPhase !== null && state.phase === 'TITLE' && lastPhase !== 'TITLE') || now < lastElapsed - 0.01;
        if (restart) resetTracking(now, state.world?.player?.distanceWalked ?? 0);
        lastElapsed = now;
        if (typeof state.muted === 'boolean' && state.muted !== muted) setMuted(state.muted);
        const wasPaused = paused;
        paused = Boolean(state.paused);
        if (paused && !wasPaused) clearVoices();
        if (paused !== wasPaused) applyVolume();
        const previousPhase = lastPhase;
        const phaseChanged = state.phase !== previousPhase;
        if (phaseChanged && state.phase === 'CAPTURE') captureBeats.clear();
        lastPhase = state.phase;
        const newEvents = [];
        for (const event of state.events ?? []) {
          if (!event || typeof event !== 'object') continue;
          if (Number.isFinite(event.serial)) {
            if (event.serial <= lastSerial) continue;
            lastSerial = event.serial;
          } else {
            if (seenObjects.has(event)) continue;
            seenObjects.add(event);
          }
          newEvents.push(event);
        }
        const torchChanged = lastTorch !== null && state.torchOn !== undefined && state.torchOn !== lastTorch;
        if (state.torchOn !== undefined) lastTorch = state.torchOn;
        if (!canPlay()) {
          // Consume positions/cues while silent so unmuting never replays a backlog.
          stepDistance = state.world?.player?.distanceWalked ?? stepDistance;
          nextMelody = now + 1.2; nextCreak = now + 3;
          nextPulse = now + 0.3; nextEnemyStep = now + 0.15; nextHeartbeat = now + 0.25;
          nextJoint = now + 0.4; nextHiddenBreath = now + 0.25;
          wasPeeking = Boolean(state.world?.player?.hiddenIn && state.world?.player?.peeking);
          lastEnemyPosition = state.world?.enemy ? { x: state.world.enemy.x, z: state.world.enemy.z } : null;
          enemyStepDistance = 0;
          weather(state, now, false); captureTimeline(state, false);
          return;
        }
        for (const voice of [...voices]) if (voice.end <= context.currentTime) stopVoice(voice);
        if (phaseChanged) {
          if (state.phase === 'INTRO') cue('intro');
          else if (state.phase === 'LEVEL_TRANSITION') cue('reveal');
          else if (state.phase === 'WIN') cue('win');
          else if (state.phase === 'LOSE' && previousPhase !== 'CAPTURE') cue(/caught|capture|mascot/i.test(state.reason ?? '') ? 'capture' : 'timeout');
        }
        const known = new Set(['toy.picked', 'toy.delivered', 'task.completed', 'switch.disabled', 'control.wrong', 'interaction.wrong', 'exit.locked', 'torch.toggled', 'enemy.spawned', 'hide.entered', 'hide.exited']);
        for (const event of newEvents) {
          // Third delivery is swallowed by the abrupt reveal, preserving the impact.
          if (['toy.delivered', 'task.completed'].includes(event.type) && state.phase === 'LEVEL_TRANSITION') continue;
          if (known.has(event.type)) cue(event.type);
        }
        if (torchChanged && !newEvents.some((event) => event.type === 'torch.toggled')) cue('torch.toggled');
        captureTimeline(state, true);
        weather(state, now, true);
        scheduleEnvironment(state, now);
      } catch (error) {
        lastError = error?.message ?? 'Audio scheduling failed.';
        clearVoices();
        if (master) smooth(master.gain, 0, 0.02);
      }
    },
    setMuted,
    setVolume,
    dispose() {
      if (disposed) return;
      disposed = true; clearVoices();
      for (const loop of loops) {
        try { loop.source.stop(); } catch { /* Already stopped. */ }
        loop.nodes.forEach(disconnect);
      }
      loops.length = 0;
      persistentNodes.forEach(disconnect); persistentNodes.length = 0;
      noiseBuffer = null;
      if (context && context.state !== 'closed') {
        try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Unsupported close. */ }
      }
    },
    getDiagnostics() {
      return { supported: Boolean(AudioContextClass), ready: loops.length === LOOP_COUNT && !disposed, contextCreated: Boolean(context), contextsCreated,
        contextState: context?.state ?? 'not-created', disposed, muted, paused, volume,
        activeVoices: voices.size, maxVoices: MAX_VOICES, peakVoices, loopSources: loops.length,
        persistentNodes: persistentNodes.length + loops.reduce((count, loop) => count + loop.nodes.length, 0),
        cueTotal, cueCounts: { ...cueCounts }, lastPhase, enemyPan, enemyDistance, windowPan, lastThunderCycle,
        captureBeats: [...captureBeats], lastError };
    },
  };
}
