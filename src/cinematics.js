const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const blend = (from, to, t) => from.map((value, i) => value + (to[i] - value) * smooth(t));

export function getCinematic(phase, elapsed) {
  if (phase !== 'INTRO' && phase !== 'LEVEL_TRANSITION') return null;
  const shot = { kind: 'boot', title: '', subtitle: '', lines: [], progress: 0, overlayOpacity: 1, corruption: 0, camera: null, complete: false };
  if (phase === 'LEVEL_TRANSITION') {
    // The physical room and sky change on the FIRST frame, never dissolve.
    Object.assign(shot, { kind: 'reveal', corruption: 1, progress: clamp(elapsed / 1.35), complete: elapsed + 1e-8 >= 1.35, overlayOpacity: elapsed < .10 ? 1 : .12 });
    shot.camera = { position: [4, 1.65, 3], target: [6.8, 2, 4.8] };
    shot.title = elapsed < .1 ? '' : 'THAT IS NOT HOW YOU LEFT HIM.';
    shot.subtitle = elapsed < .1 ? '' : 'Every child learns. Tonight, so do you.';
    shot.lines = elapsed > .55 ? ['Disable three controls. Reach the exit.'] : [];
    return shot;
  }
  shot.progress = clamp(elapsed / 5);
  shot.complete = elapsed + 1e-8 >= 15;
  shot.camera = { position: [0, 1.6, 4.7], target: [0, 1.6, -4.3] };
  if (elapsed < 2) {
    shot.title = 'ONE LAST JOB.';
    shot.subtitle = "Clean your child's room before bed.";
  } else if (elapsed < 5) {
    shot.title = 'HE NEVER CLEANS IT.';
    shot.subtitle = "Maybe it's time to teach him good habits.";
    shot.lines = ['Start with the spills.', ...(elapsed >= 3.5 ? ['Then put everything back.'] : [])];
  } else {
    shot.kind = 'room';
    shot.overlayOpacity = elapsed < 6 ? 1 - smooth(elapsed - 5) : 0;
    if (elapsed < 7.5) {
      shot.title = 'HE LOVES THAT OLD BUNNY.';
      shot.subtitle = 'It has always looked so gentle.';
      shot.camera = { position: [3.6, 1.6, 2.3], target: [6.8, 1.45, 4.8] };
    } else if (elapsed < 11) {
      shot.title = 'CLEAN AND ARRANGE THE ROOM.';
      shot.subtitle = 'Wipe spills. Collect litter. Arrange books, blocks and the chair.';
      shot.camera = { position: blend([-1.8, 1.6, 3.8], [.5, 1.6, 3.8], (elapsed - 7.5) / 3.5), target: [0, .8, -4.3] };
    } else if (elapsed < 12.5) {
      shot.title = 'WAS HE ALWAYS SMILING?';
      shot.subtitle = 'You must be tired.';
      shot.camera = { position: [3.6, 1.6, 2.3], target: [6.8, 1.45, 4.8] };
    } else {
      shot.title = 'WAS HE ALWAYS SMILING?';
      shot.subtitle = 'WASD move · Mouse look · E interact · F torch';
      shot.camera = { position: blend([3.6, 1.6, 2.3], [0, 1.6, 4.7], (elapsed - 12.5) / 2), target: blend([6.8, 1.45, 4.8], [0, 1.6, -4.3], (elapsed - 12.5) / 2) };
    }
  }
  return shot;
}
