# PLAY NICE — original sound design

Implementation: `src/audio.js`. This module authors all sound with native Web Audio oscillators, filtered noise and a short synthesized room impulse. No network, audio downloads, music samples, external libraries or copyrighted soundtrack are used. The current browser audio implementation follows the [Web Audio API specification](https://www.w3.org/TR/webaudio/).

## Integration contract

`createAudio()` returns `unlock()`, `update(state, dt)`, `setMuted(boolean)`, `setVolume(0..1)`, `dispose()`, and `getDiagnostics()`.

- Construct once for the application; call `unlock()` synchronously within Start/resume/input gestures. It returns a handled Promise<boolean>. Missing Web Audio, blocked resume or failed setup never throws into gameplay.
- Call `update(state, dt)` once per frame after the game update. State is read only. It consumes phase, elapsed seconds, pause/mute/torch state, semantic events with serial IDs, player distanceWalked/yaw/position, and enemy position/speed/active status. Missing optional fields are safe.
- Game owns the displayed mute state. When `state.muted` is present it takes precedence on the next update; UI should change game state as well as call `setMuted` for immediate response. Volume is internal and defaults to 55%, scaled to 0.33 master gain.
- Semantic cue IDs are deduplicated monotonically per run. Returning to TITLE or elapsed time resetting clears run tracking without creating another AudioContext. Rendering/updating an unchanged event array cannot replay it.
- No audio callback changes score, phase, timing, movement or world data. No timers, RAF callbacks or DOM listeners are installed by this module.

## Listening design

- Initial room: low beating electrical hum, filtered air, sparse detuned toybox notes and intermittent wooden creaks. The melody is deliberately incomplete and slightly uneasy.
- Exterior storm: two continuous filtered-noise layers supply rain wash and glass patter. Small irregular impacts and window-relative stereo placement make the rain feel outside the room. The window bed becomes quieter farther from its logical position at (-8, -1.5).
- Shared storm clock: renderer lightning occurs at `state.elapsed % 11 = 1`; one low, panned thunder roll begins at 2.2 in the same cycle, a 1.2-second delay. Audio uses the same elapsed clock, consumes muted crossings without backlog, and never creates a timer or separate weather simulation.
- Abrupt reveal: existing short sounds cut; one filtered impact and downward bass drop begin immediately at LEVEL_TRANSITION, covering its 1.35-second duration. It does not wait until the end of the transition or repeat every frame.
- Corrupted room: sub drone, slow low pulse, breathing-shaped air and the same room creaks in a darker context. Enemy footsteps become louder with distance and pan relative to the helper's yaw; faster pulse pairs form a heartbeat as the mascot approaches.
- Player footsteps use accumulated movement distance, not held-key duration. Alternating left/right sole impacts stop when the helper stops moving. Sneaking reduces their gain to 35% and softens the filter. While hidden, footsteps are suppressed and traveled distance is consumed so leaving a hiding spot cannot replay a backlog.
- `task.completed` uses a short cloth/cleanup sound and quiet confirmation chime; switches use a latch and mechanical power-down; wrong target/locked exit use a short low denial; torch uses a small click. Legacy toy cues remain harmless for older fixtures. A final completed task yields to the reveal impact rather than playing a cheerful chime over it. The approaching fabric mascot adds intermittent cloth rustle.
- `CAPTURE` now lasts **6.2 seconds**. Audio scales `phaseElapsed * 8 / 6.2`, matching the renderer's accelerated legacy timeline. Real-time beat starts are grab 0, floor impact 0.465, dragging 0.62, lift 2.325, smile 4.03, and lens break 5.0375 seconds. Each plays once and never drives game timing. The subsequent LOSE phase does not replay a capture impact. Timeout and escape retain separate stingers.
- Stronger capture revision: the grab combines a sharp midrange attack, low cloth hit, bass drop, short rough descending tone and one offset high-frequency snap. The fall adds floor resonance and a smaller rebound; dragging uses four finite alternating scrapes; lifting combines cloth strain and rising rough harmonics. The grin separates two uneasy pitches across stereo over a low growl and breath. The lens break combines an initial crack, three short spatial fragments, resonance and a low drop. These are finite voice layers within the existing budget, not a new playback loop or an increased master volume.
- `control.wrong` is a distinct mechanical rejection followed by two descending rough tones. It does not play switch-success audio and remains deduplicated by event serial.
- A dropped torch cue starts at scaled time 0.18 (about 0.1395 real seconds): three diminishing metal bounces and a rolling rattle follow its fall. All seven transient sources have finite durations; no extra loop is introduced.
- `hide.entered` and `hide.exited` play quiet wood/cloth transitions once per event serial. Hidden breathing is muffled; changing peek state adds a small cloth sound. The mascot keeps distance/yaw-positioned footsteps while patrolling, searching or chasing, using observed travel rather than a constant footstep timer. Short joint cracks and cloth movement remain directional. Audio never supplies AI hearing decisions.

## Resource and output bounds

One lazy AudioContext; eight persistent ambience sources (six room layers plus two rain layers); at most 28 transient voices. Every transient owns its nodes and disconnects after playback, voice stealing, restart, pause or mute. A common room reverb avoids per-sound convolution nodes. Moderate levels feed a dynamics compressor configured as a limiter (20:1 ratio, fast attack). User volume remains available independently of mute.

Pause/mute fades the master to silence, stops transient voices and stops scheduling new sounds. Shared loops remain silent and reusable; no context is added on resume. No missed events or steps are played as a backlog. Disposal stops/disconnects all sources and closes the context with rejection handling.

## Verification status

Author ran an isolated Node assertion harness with a simulated Web Audio graph on 2026-11-15. Passed:

- Lazy creation; repeated unlock reuses one context; unsupported API and rejected resume return false safely.
- Input state remains byte-for-byte unchanged; repeated phase/event updates do not duplicate cues; restart accepts new-run serial IDs.
- Immediate reveal impact occurs once; movement distance emits footsteps; enemy on the right pans right, and rotating yaw by pi pans it left; proximity emits heartbeat.
- Pause and mute stop transient voices and add no cues; no missed-footstep backlog on resume.
- Rapid events cap at 28 voices; ended voices disconnect; disposal leaves zero connected nodes, no loops/voices and a closed context; repeated disposal is safe.
- Volume clamps to 0..1 and defaults to 55%.

The maintained suite is `tests/audio.test.mjs`. Command `node --test tests/audio.test.mjs` passed **21 tests, 0 failures** after the stealth/dropped-torch revision, including missing API, rejected resume and partially failed graph setup. Added checks prove rain-loop count, window stereo orientation, thunder at 2.2/13.2 seconds, no muted-weather backlog, scaled 6.2-second capture thresholds once, no second capture on LOSE, pause/mute/reset behavior, and unique cleanup/rejection/hide cues. The layered capture test checks multiple grab sources, no repeat scheduling, the 28-voice cap, retained limiter/default volume and complete disposal. New tests cover the dropped-torch threshold, hidden footsteps/breath/peek behavior, and motion-driven patrol footsteps. A floating-point boundary at the torch trigger was reproduced and fixed with the same small timing tolerance as the other beats. The test graph is intentionally a simulation and does not replace actual browser playback checks.

These scheduling/lifecycle checks do not establish subjective audio balance or prove that a speaker/headphone output was heard. Actual browser unlock, listening and user volume balance remain unverified by the author. The coordinator owns browser playback validation. `getDiagnostics()` exposes support/readiness/context state, voice/loop/node counts, cue counters, enemy pan/distance, window pan, last thunder cycle, consumed capture beats and the last nonfatal error for that check.
