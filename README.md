# PLAY NICE

Every toy has its place. So do you.

A local first-person horror game about cleaning your child's room during a storm. Finish six room-care jobs, uncover the archive behind a bookcase, then shut down the controls and escape the mascot.

## Start the game

On this Windows PC, double-click **START_GAME.cmd**. It starts or reuses the project's local Node.js server and opens the game in your browser. Use Chrome or Edge with WebGL 2 and graphics acceleration enabled. No npm installation or Internet connection is needed during play.

For a server you can stop with Ctrl+C, open a terminal in this folder:

```powershell
node tools/server.mjs
```

Open [PLAY NICE locally](http://127.0.0.1:8000/). If port 8000 is busy, use `node tools/server.mjs 8002` and open port 8002. The Windows launcher automatically checks ports 8000–8009. Opening `index.html` directly is unsupported because the game uses JavaScript modules.

Choose **ENTER THE NURSERY** or press Enter. The opening lasts 15 seconds and settles into your first-person view before controls begin.

## Controls

| Control | Action |
| --- | --- |
| WASD | Move relative to your view |
| Mouse | Look; click inside the room to capture the pointer |
| Shift, held | Sneak quietly at reduced speed |
| E | Complete a nearby facing job, read/pull a book, use a control/exit, or enter/leave hiding |
| Space, held while hidden | Peek out |
| F | Toggle the directional torch; it is suppressed while hidden |
| M | Toggle sound |
| Esc | Pause and release the pointer; close an open journal |
| Enter | Start, resume, close the journal, or restart from results |
| R | Restart from a result screen |

Mouse fallback: hold the left button and drag inside the room. Keyboard fallback: ↑/↓ move forward/back, ←/→ turn, Q/Z look up/down. **CONTINUE** resumes a paused shift. Mute and volume controls are available on menus and the pause screen.

## Jobs, journal and escape

**Room Care:** wipe two spills, collect rubbish, straighten the chair, shelve books and store toys in their basket. Each unique job scores 50 points: six jobs give **300**. Holding E cannot repeat an award. The old color-matched toy shelves are no longer objectives.

Read the storybook on the table. Its note names a randomized **MOON, STAR or SUN** lever book and gives the exact shutdown order. Reading freezes the game timer and look. Close the page with E, Enter or Esc. Shelve the books before pulling the indicated spine; the bookcase and wall slide aside to expose the archive. Wrong books do not open it. The archive is required because **Control 03 is inside**. Discovery adds no points.

The sixth room job triggers an immediate red transformation and a **1.35-second reveal**. Your position, view, torch setting and score carry into **Inventory Correction**. Disable the three wall controls in the journal's order for 150 points each. A wrong control does not advance progress. All three unlock the exit; walk to it and press E for 300 more points. A complete escape totals **1,050**.

Each level has a **120-second countdown**. Timers stop during cinematics, journal reading and pause. Timeout takes priority over capture or escape on the same frame.

## Hiding and the mascot

The mascot wakes three seconds after the first control. It patrols, hears footsteps, pursues when it detects you, and searches your last known position before resuming patrol. Walking is louder than sneaking. Your normal walk remains faster than its chase; sneaking is slower.

Two boxes and a closet provide hiding spots. Approach their prompt and press E; press E again to leave. Hold Space to peek with a restricted view. Hiding does not pause the mascot. It can catch you if it saw you enter or reaches an exposed nearby peek. Use furniture and walls to break sight before hiding. Major furniture and room boundaries are solid; small toys, rugs and spills remain passable.

Capture lasts **6.2 seconds**: the torch drops and rattles on the floor while the mascot grabs, drops, drags and lifts the player, ending in an upside-down grin and lens fracture. The sequence freezes logical positions, score and countdown; it grants no escape points. Esc or focus loss pauses it. **RETURN TO THE ROOM** on the result screen resets jobs, secret puzzle, controls, hiding, mascot and cinematic state.

## Local assets and sound

The game uses vanilla JavaScript, HTML/CSS and local **Three.js 0.170.0**. Primitive original geometry supplies the room, props, hands and mascot. Ten genuine surface images were selectively decoded from the supplied Resident Evil Village package: nine 1024×1024 images and one 2048×2048 skin atlas. Sources, conversion details and hashes are in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) and the two manifests under `assets/extracted/`.

Rain, window patter, delayed thunder, room creaks, directional footsteps, joint cracks, hiding breath and layered capture cues are original Web Audio synthesis. Volume/mute remain available; missing or blocked audio never stops gameplay. [AUDIO_DESIGN.md](AUDIO_DESIGN.md) describes the sound lifecycle and evidence.

Keep `src/`, `vendor/`, `assets/`, `index.html`, `styles.css` and launcher/server files together. The large original game packages are not needed to play. There is no backend, login, mobile control scheme, combat, jumping or checkpoint save. The art remains primitive geometry with extracted surface materials; collision uses simple solid rectangles rather than a physics engine.

## Verification and continuation

Run the maintained checks with:

```powershell
npm test
```

No test dependencies need installing. Automated state, collision, timing, camera-math and simulated audio checks are distinct from a browser playtest. Current pass counts, unresolved checks and actual browser/listening evidence belong in [QA_REPORT.md](QA_REPORT.md). Visual quality, lighting, performance and speaker/headphone balance must not be inferred from module tests.

[CONTINUE_HERE.md](CONTINUE_HERE.md) records current work, assignments, launch commands, latest archive and a copy-paste handoff for another account. [STEALTH_CAPTURE.md](STEALTH_CAPTURE.md) defines this revision. Open the same project folder and read the handoff first; changing accounts does not transfer chat memory or running agents automatically.

Earlier releases remain in `backups/`. `PLAY_NICE_SEQUENCE-20261115-162459.zip` is the preceding control-order build, and **does not include this stealth/dropped-torch revision**. Use the handoff to identify the newest packaged build. Extract a portable archive into a writable folder before running its launcher; original source-game packages are excluded.
