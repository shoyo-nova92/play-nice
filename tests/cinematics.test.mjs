import test from 'node:test';
import assert from 'node:assert/strict';
import { getCinematic } from '../src/cinematics.js';

test('opening establishes parent cleanup story before control', () => {
  const first = getCinematic('INTRO', 0);
  assert.match(first.subtitle, /your child's room/i);
  const parent = getCinematic('INTRO', 2.5);
  assert.match(parent.title, /never cleans/i);
  assert.match(parent.subtitle, /teach him good habits/i);
  assert.match(getCinematic('INTRO', 8).subtitle, /spills.*litter.*books.*blocks.*chair/i);
});

test('gentle bunny view precedes the late smile question', () => {
  const gentle = getCinematic('INTRO', 6.5);
  assert.match(gentle.subtitle, /gentle/i);
  assert.deepEqual(gentle.camera.position, [3.6, 1.6, 2.3]);
  assert.deepEqual(gentle.camera.target, [6.8, 1.45, 4.8]);
  assert.match(getCinematic('INTRO', 11.5).title, /was he always smiling/i);
  assert.match(getCinematic('INTRO', 14.5).title, /was he always smiling/i);
});

test('all opening camera shots stay inside the room and settle exactly before 15 seconds', () => {
  for (let tick = 0; tick <= 300; tick += 1) {
    const t = tick / 20;
    const shot = getCinematic('INTRO', t);
    const [x, y, z] = shot.camera.position;
    assert.ok(Math.abs(x) < 8 && Math.abs(z) < 6 && y > 0 && y < 3.6);
    assert.equal(shot.complete, t >= 15);
  }
  for (const t of [14.5, 14.99, 15]) {
    assert.deepEqual(getCinematic('INTRO', t).camera, {
      position: [0, 1.6, 4.7], target: [0, 1.6, -4.3],
    });
  }
});

test('reveal corrupts instantly, shows bunny close-up and ends at 1.35 seconds', () => {
  const first = getCinematic('LEVEL_TRANSITION', 0);
  assert.equal(first.corruption, 1);
  assert.equal(first.overlayOpacity, 1);
  assert.deepEqual(first.camera, { position: [4, 1.65, 3], target: [6.8, 2, 4.8] });
  const revealed = getCinematic('LEVEL_TRANSITION', .1);
  assert.equal(revealed.title, 'THAT IS NOT HOW YOU LEFT HIM.');
  assert.equal(revealed.subtitle, 'Every child learns. Tonight, so do you.');
  assert.ok(revealed.overlayOpacity < .2);
  assert.deepEqual(getCinematic('LEVEL_TRANSITION', .6).lines, ['Disable three controls. Reach the exit.']);
  assert.equal(getCinematic('LEVEL_TRANSITION', 1.349).complete, false);
  assert.equal(getCinematic('LEVEL_TRANSITION', 1.35).complete, true);
});

test('cinematic reads are deterministic and return independent camera arrays', () => {
  const a = getCinematic('INTRO', 14.7), b = getCinematic('INTRO', 14.7);
  assert.deepEqual(a, b);
  a.camera.position[0] = 999;
  assert.deepEqual(b.camera.position, [0, 1.6, 4.7]);
  for (const phase of ['TITLE', 'LEVEL_1', 'LEVEL_2', 'CAPTURE', 'WIN', 'LOSE']) {
    assert.equal(getCinematic(phase, 5), null);
  }
});
