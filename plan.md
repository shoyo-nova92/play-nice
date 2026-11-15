> Latest authorized revision: STEALTH_CAPTURE.md supersedes simple openfloor movement and directpursuit. Solidprops, hiding/peek, patrol/hearing/search, slightlyfasterenemy, persistentredgrin and droppedtorch capture6.2s are being implemented.

> Latest revision: a fresh randomized permutation of controls01/02/03 is selected once per run, retained through both levels and shown in the table journal. Wrong-order control use gives feedback without changing score, progress or enemy activation. New run selects again (repeats are possible). Local player fill light, stronger capture face/eye lighting, heavily frosted window, and layered capture sound are implemented;98 automated tests pass. Browser visual and listening checks remain unverified.

> Latest update: all three controls are wall-mounted. Control03 is on the secret archive back wall; solving the journal/book puzzle is now REQUIRED to unlock the exit. Updated movement-driven full run passes with1050points. Browser visual verification remains unavailable.

> Latest authoritative amendment: FAMILY_SECRET_ROOM.md adds parent/child story, correct bookcase/toybasket, changing bunny expression and an optional clue-book sliding-wall secret room.

> ACTIVE AMENDMENT: Latest request replaces toy sorting with six cleaning/arranging jobs (50 each), adds storm/rain/thunder and tracking-eye teddies, and8s CAPTURE before caughtLOSE. STORM_CLEANUP_CAPTURE.md supersedes conflicting sections below.

# PLAY NICE — 3D implementation plan

Status: IMPLEMENTATION AUTHORIZED. The user requested this first-person horror revision on 2026-11-15. Latest request overrides former overhead-camera, slow-reveal, and optional-audio choices. See HORROR_UPGRADE.md for concrete interfaces and CONTINUE_HERE.md for progress.

## 1. Authoritative decisions

- Build a genuine 3D desktop-browser game with first-person controls inside one enclosed, dimly lit playroom.
- Working title: PLAY NICE. Tagline: Every toy has its place. So do you.
- Original allocation: four hours, with the last hour reserved for verification. The user accepted uncertain additional extraction time and subsequently authorized this horror revision. Keep assignments bounded and preserve working backups; do not omit mandatory sound or first-person presentation to fit the original allocation.
- The original document's five-hour budget, dated event schedule, and 97-minute warning are superseded. No current judging deadline has been confirmed.
- This plan and spec.md replace the archived 2D design. The archive is historical reference only.
- Target a 2–4 minute run with two mechanically different playable levels, a pre-game cinematic, persistent points, and explicit win/lose screens.

## 2. Scope and technology

Use HTML, CSS, vanilla JavaScript ES modules, and Three.js for 3D rendering. Use one pinned Three.js version stored locally with the project. Three.js 0.170.0 is pinned locally with its license and dependency record. No React, game engine migration, backend, multiplayer, external APIs, online assets, or CDN runtime dependency.

Preview through a local static HTTP server. Offline-capable means the game works without Internet once its local files and server are available; opening index.html directly is not the supported launch path. Document the exact server command based on tools actually installed.

Create everything from simple 3D primitives: boxes for shelves and switches, spheres for the ball and character parts, simple rounded-looking toy assemblies, and a silhouette mascot. No model downloads, skeletal animation, physics engine, navmesh, procedural world, combat, or detached free-flying camera.

Use ready-made extracted surface textures, dim practical lamps, and a shadow-casting handheld torch. HTML overlays supply restrained menus, HUD, prompts, and cinematic text. Sound design is mandatory: an original Web Audio room ambience, toybox melody, footsteps, threat cues, and a hard reveal impact. A muted or unavailable audio device must never block gameplay.

### Texture sourcing — required

Use existing texture files rather than drawing, generating, or procedurally creating replacement surface art. The user specifically required extracting and reusing textures from their local Resident Evil packages. Ten decoded Village textures now live in assets/extracted/: wood, plaster, metals, concrete, skin atlas, tiles, fabric, and peeling wall. ASSET_PROVENANCE.md and the two manifests record exact sources, sizes, hashes, and reproducible extraction. Do not label package assets CC0; no open license was established. No source package is modified.

All runtime images are local. Keep the original six textures and their manifest unchanged; selectively extract only additional files needed by the room. Prefer 1024px surfaces; the hand atlas is 2048px to retain its usable skin region. Plain materials are acceptable for small geometry and loading fallback. Text labels may use a canvas; these are not painted surface assets. If future external artwork is added, verify its license and retain credits. QA checks provenance, image dimensions, local loading, and appearance. No bulk unpacking of the GB-sized libraries is necessary.

## 3. Gameplay and story

The player is HELPER_01, a small helper in an apparently friendly playroom. They sort three toys. The system then reports INVENTORY COUNT: 3 / 4 and identifies the helper as the missing object. The same room becomes corrupted. The player must disable three switches and escape a pursuing mascot.

Emotional progression: unease, routine, sudden violation, pursuit, escape. The room is already an unsettling closed nursery at night, with faded toy colors, worn tiles, wood and plaster, small practical lights, and a window onto trees. A seated long-eared mascot is present before it wakes. At the reveal the sky turns blood red instantly and the lamps cut. Use the supplied reference images for atmosphere and first-person composition; do not insert their screenshot UI.

Controls: WASD moves relative to view; mouse looks; E interacts; F toggles the torch; M toggles sound; Esc pauses and releases the mouse; Enter activates menu/resume; R restarts from results. Keyboard fallback: up/down move, left/right turn, Q/Z look up/down. Click the room for mouse lock or hold-drag if unavailable. No jumping, combat, or inventory menu.

## 4. Exact screen flow

TITLE → INTRO → LEVEL_1 → LEVEL_TRANSITION → LEVEL_2 → WIN.

Either active level can transition to LOSE. WIN and LOSE offer a clearly labeled RESTART RUN action returning to TITLE with all run state cleared. There are no per-level checkpoints in the minimum build.

Only the central game coordinator changes these phases. Movement and interaction are enabled only in LEVEL_1 and LEVEL_2. Timers and enemy movement stop outside active gameplay.

## 5. Mandatory opening cinematic

After ENTER THE NURSERY, play a 15-second in-engine cinematic before enabling control. At 0-2 seconds: AFTER HOURS / NURSERY 04. At 2-5: TOYS 03, HELPERS 01, DOOR LOCKED. At 5-10: reveal the room from inside and explain the matching toys/shelves. At 10-12.5: show the seated mascot, HE IS ONLY A TOY. At 12.5-15: settle into the player's exact eye-height view and display controls.

Use elapsed seconds, never blocking waits or frame counts. The 15-second opening is separate from the abrupt between-level change. No skip in the minimum version. Sound accompanies the opening but unavailable audio never blocks play.

## 6. Level 1 — HAPPY HELPER

- Objective: Put all 3 toys on their matching shelves (0/3).
- Toys: red bear, blue ball, yellow duck. Label shelves with names/icons as well as colors.
- Approach a toy, read E — PICK UP [NAME], and press E. Carry only one toy.
- Show the carried toy in the left hand, clear of the center reticle. Carried toys are no longer pickup candidates.
- Approach its matching shelf and press E to place it. A wrong shelf shows WRONG SHELF and keeps the toy carried. No point penalties.
- Each unique correct delivery awards 100 points exactly once and updates progress.
- After the third delivery, freeze gameplay and begin the reveal exactly once. Score is 300.
- Countdown starts at 120 seconds. Reaching zero before completion loses.
- Optional subtle mascot expression change after delivery two; never hide instructions.

Use faded cream, muted toy colors, warm practical lamp pools, and cool window light. Keep toy colors, shelf labels, and objects readable in the torch beam. There are no interior blocking obstacles or maze puzzles.

## 7. Between-level reveal

On the third delivery, immediately turn the sky blood red and corrupt the room. A single 0.10-second blackout and sound impact precede YOU ARE THE LAST TOY / INVENTORY CORRECTION REQUIRED. The entire control lock lasts 1.35 seconds; no slow dissolve or repeated flashing. Resume Level 2 automatically with score 300.

Create fresh Level 2 objectives but preserve player position, yaw, pitch, and torch setting. Do not teleport the player, leave Level 1 toys interactive, or reset points. Outside sky and lighting switch on the first transition frame, before the new world is created.

## 8. Level 2 — INVENTORY CORRECTION

- Objective: Disable the 3 control switches, then reach the EXIT.
- Three distinct switches are spread around the same recognizable room. E activates a nearby unused switch.
- Each switch awards 150 points exactly once. Show 0/3 through 3/3.
- The exit is visible from the beginning, marked LOCKED until all three switches are disabled.
- After the third switch, show EXIT UNLOCKED. Winning requires walking to the exit and pressing E; switches alone do not win.
- Successful escape awards 300 points once and shows YOU ESCAPED with total score.
- Level timer starts fresh at 120 seconds. Timeout or mascot contact loses and shows the reason.
- Activate the mascot three seconds after the first switch, with a visible warning. Spawn away from the helper; if too close, choose the farthest room corner.
- Pursuit follows the helper directly across the open floor. No pathfinding. Keep mascot slower than the player at every stage.

Use near-dark worn surfaces, red light from the window, dim emergency accents, and glowing mascot eyes. F toggles a real flashlight beam held by visible textured hands. Keep the room, objects, and prompts visible; darkness must not make play impossible. No rapid full-screen flashing.

## 9. 3D world, camera, and movement

- World units are meters for planning purposes. Floor: about 16 units wide (X) by 12 deep (Z). Y is vertical; floor surface is Y=0.
- Player moves only on X/Z. Starting values: speed 4 units/second, collision radius 0.35, interaction distance 1.3 units.
- Normalize diagonal movement so it is no faster. Clamp the player center within room limits with its radius accounted for.
- Start mascot speed at 2 units/second, increasing by 0.2 per additional switch, capped at 2.4. Capture uses X/Z distance and the sum of actor radii. Tune through actual play.
- Use a perspective first-person camera at eye height 1.6, FOV about 70 degrees. Mouse look controls yaw/pitch; WASD is relative to yaw. Pitch is clamped; no roll.
- Resize the perspective aspect ratio without changing world distances. Readable hands, torch, prompts and HUD at 1366x768 and 1920x1080 are required; the whole room need not be visible at once.
- Use four full walls, a ceiling around Y=3.6, and a real window opening in the left wall with outside sky/treeline. Keep decoration mostly at the perimeter; floor movement uses room bounds rather than complex furniture physics.
- Interactions and capture use logical X/Z distance, not mesh overlap, screen pixels, or raycasting. Rendered mesh positions mirror logical positions.
- A 1280×720 presentation reference is a UI target only, not the simulation coordinate system.

## 10. Points, HUD, and input safeguards

| Action | Points | Maximum awards |
|---|---:|---:|
| Correct toy delivery | 100 | 3 |
| Unique switch disabled | 150 | 3 |
| Escape | 300 | 1 |
| Full-run total | 1,050 | |

No time bonuses or penalties in the minimum build. Score persists between levels, resets on a new run, and never lives solely in HUD text.

HUD: level and objective at top-left, MM:SS countdown near top-center, score top-right, carried toy bottom-left, contextual E prompt bottom-center. Highlight the selected nearby target. Use readable HTML text with safe margins and system fonts.

One physical E press triggers one interaction. Ignore key-repeat; consume the press even if the player is not near anything. While carrying, consider shelves only; otherwise consider undelivered toys. In Level 2 consider unused switches and the exit, including its locked prompt. Choose nearest eligible target in range and in the horizontal facing cone (dot >= 0.25; ignore facing only at near-zero distance); resolve exact ties consistently by object ID. The displayed target must be the target used by E.

Pause game time and clear held keys when the tab loses focus. On return, do not accumulate hidden time or apply a large movement jump. If mouse lock was lost or Esc was pressed, show an explicit Continue button; keyboard-only focus loss can resume safely on focus. Clamp frame delta as an extra safeguard. Prevent arrow keys from scrolling during play.

## 11. Implemented files and ownership

| File | Responsibility |
|---|---|
| index.html | Page, 3D render canvas host, HTML menus/HUD |
| styles.css | Responsive layout, readable UI, overlays |
| vendor/three.module.js | Pinned local Three.js dependency; keep any required companion files local too |
| src/main.js | Startup, animation loop, system connections, resize |
| src/game.js | Sole authoritative run state, phase changes, points, timer, reset |
| src/levels.js | Level data, object statuses, interactions, pursuit and capture rules |
| src/input.js | Held movement, one-shot actions, focus handling |
| src/scene.js | Three.js scene, camera, lights, primitive meshes; sync visuals to state |
| src/cinematics.js | Intro/reveal timing, camera poses and overlay messages |
| src/ui.js | Display state and send button intentions |
| src/audio.js | Mandatory soundscape, spatial cues, mute, volume, lifecycle |
| README.md | Exact launch steps, controls, dependency version, limitations |

Keep one renderer, one animation loop, and one set of input listeners. Reuse or dispose removed meshes/materials on restart; do not accumulate scenes, lights, listeners, or animation loops. Rendering must never award points or decide victory. Cinematic camera motion must restore the gameplay camera before enabling movement.

Each frame: read inputs → coordinator updates active rules/timeline → apply unique outcomes and phase changes → synchronize 3D visuals → update HUD → render. Re-check the phase after a terminal event so the same frame cannot both win and lose. On an otherwise simultaneous capture/timeout/escape frame, failure takes priority; no escape bonus is granted after failure.

## 12. Four-hour build order after authorization

| Time budget | Deliverable | Acceptance gate |
|---|---|---|
| 0–25 min | Local Three.js setup, room, camera, player movement, TITLE | Clean launch; actual 3D room visible; movement and bounds work |
| 25–75 | Complete Level 1, HUD, timer, failure, reset | Three deliveries give 300; wrong shelf and held E cannot cheat |
| 75–130 | Level 2 switches, exit, scoring, then pursuit | Locked exit works; normal win totals 1,050; capture and timeout lose |
| 130–160 | Opening cinematic and inventory reveal | No control during sequences; camera restores; score persists |
| 160–180 | Visual clarity, mandatory sound design, launch instructions | Both levels readable and distinct; local dependency complete |
| 180–220 | Full-run verification and critical fixes | Win, loss, restart, focus, resize, offline launch tested |
| 220–240 | Final backup and short demo rehearsal | Stable runnable folder and honest test report |

These are targets, not guaranteed durations. Preserve a working snapshot after each accepted milestone. If behind schedule, cut excess decoration and extra effects first. First person, torch, sound design, the enclosed room, and the instant red-sky reveal are mandatory for this revision. Protect both levels, real 3D, the intro, scoring, win/lose, and reliable restart. No unrelated refactoring.

## 13. Verification and definition of done

- Run through the actual browser using keyboard, mouse, and buttons; code inspection alone is insufficient.
- Inspect the closed room, textured hands, seated/waking/chasing mascot, torch on/off, and instant red window. Check audio unlock, bounded scheduling, pause/mute/volume, and state whether actual listening was possible.
- TITLE starts the complete intro before gameplay. Timer and movement remain frozen during both cinematics.
- All three toys are reachable, carry one at a time, match shelves, and score once.
- Three unique switches score once each; exit remains locked until all are disabled and E is still required.
- A normal full run reaches 1,050 points. Pursuit is beatable; capture and both level timeouts show explicit failure.
- Restart from WIN and LOSE clears score, timer, carry state, switches, enemy, cinematic timing, and held inputs.
- Test tab switching, diagonal movement, repeated/held E, and resize at 1366×768 and 1920×1080.
- Verify browser console has no uncaught errors and all runtime resources load locally without Internet.
- If WebGL is unavailable, show a readable unsupported-browser message instead of a blank screen.
- An unfamiliar player should understand objectives without spoken coaching. Record whether an independent playtest was actually available.
- README includes actual launch commands, controls, dependency version, and known limitations. Final backup includes all required local files.
- Do not claim any test passed unless performed. The poster requirements below come from the supplied original plan and have not been independently verified against its poster.

Reported competition checklist: two playable levels; cinematic/video intro before control; points; clear objectives; win/lose conditions; interactive mechanics; original presentation. Confirm only unresolved organizer interpretation, such as whether a timed in-engine cinematic is sufficient.

Implementation is authorized by the user. Keep the current plans synchronized and update the continuation file before handoff.
