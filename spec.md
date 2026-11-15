> Latest authorized revision: STEALTH_CAPTURE.md supersedes simple openfloor movement and directpursuit. Solidprops, hiding/peek, patrol/hearing/search, slightlyfasterenemy, persistentredgrin and droppedtorch capture6.2s are being implemented.

> Latest revision: a fresh randomized permutation of controls01/02/03 is selected once per run, retained through both levels and shown in the table journal. Wrong-order control use gives feedback without changing score, progress or enemy activation. New run selects again (repeats are possible). Local player fill light, stronger capture face/eye lighting, heavily frosted window, and layered capture sound are implemented;98 automated tests pass. Browser visual and listening checks remain unverified.

> Latest update: all three controls are wall-mounted. Control03 is on the secret archive back wall; solving the journal/book puzzle is now REQUIRED to unlock the exit. Updated movement-driven full run passes with1050points. Browser visual verification remains unavailable.

> Latest authoritative amendment: FAMILY_SECRET_ROOM.md adds parent/child story, correct bookcase/toybasket, changing bunny expression and an optional clue-book sliding-wall secret room.

> ACTIVE AMENDMENT: Latest request replaces toy sorting with six cleaning/arranging jobs (50 each), adds storm/rain/thunder and tracking-eye teddies, and8s CAPTURE before caughtLOSE. STORM_CLEANUP_CAPTURE.md supersedes conflicting sections below.

# PLAY NICE — beginner-friendly 3D build specification

IMPLEMENTATION AUTHORIZED. Read plan.md for complete rules and HORROR_UPGRADE.md for current interfaces. This explains the latest first-person horror revision in simpler language.

## What are we making?

A short 3D game in a browser. You control HELPER_01 from first person in a worn, enclosed nursery at night. First you put away three toys. Then the room decides YOU are another toy to put away. You must turn off three switches and escape a slow monster.

Use the same enclosed room twice, seen through the helper's eyes. Look with the mouse and move with WASD. The first phase has dim warm lamps and faded toy colors; the second starts with an instant blood-red sky outside the window and a single short blackout. Models use simple original shapes with genuine extracted surface textures. The user accepted additional asset-extraction work beyond the original four-hour estimate.

## Tech stack: what we will actually use

A tech stack is the set of tools used to build and run a project. This is the implemented local stack; no build installation is needed to play.

| Technology | Simple explanation | Its job in PLAY NICE |
|---|---|---|
| HTML | The structure of a web page | Holds the game's drawing area, Start button, menus, and HUD elements |
| CSS | The appearance and layout of the page | Styles buttons, objectives, score, cinematic text, and screen overlays; keeps them readable on laptop screens |
| JavaScript | The programming language that makes the game work | Handles movement, toy pickup, switches, points, countdowns, monster pursuit, and screen changes |
| JavaScript ES modules | A way to split JavaScript into connected files | Keeps input, game rules, 3D visuals, and UI in separate files using imports and exports |
| Three.js | A JavaScript library for drawing 3D scenes | Creates the room, helper, toys, shelves, lights, camera, and monster from simple shapes |
| WebGL through Three.js | The browser's graphics system, which uses the computer's graphics hardware | Draws the actual 3D scene; we use Three.js rather than writing low-level WebGL code ourselves |
| Browser keyboard and animation APIs | Built-in browser features | Read WASD/arrows/E and schedule the update-and-draw loop with requestAnimationFrame |
| Web Audio API — required | The browser's built-in sound tools | Creates the room soundscape, toybox melody, abrupt horror impact, footsteps, spatial threat, mute and volume |
| Local static HTTP server | A small program that serves project files to the browser | Opens the game at a localhost address so module imports and local resources load through HTTP |

### How these pieces work together

The local server delivers our files to Chrome or Edge. HTML provides the page, and CSS styles its menus and HUD. JavaScript starts Three.js, creates the 3D scene, and runs the game rules. Three.js draws into a canvas element on the page; ordinary HTML elements sit above it to show instructions and scores.

When you press E near a toy, browser keyboard events reach input.js. The game rules check whether pickup is allowed and change the game state. The 3D scene then shows the toy being carried, and the HUD displays its name. Web Audio plays an appropriate cue and responds to the threat nearby. JavaScript decides what happened; Three.js displays the result.

### What Three.js does, and what we build ourselves

Three.js supplies 3D rendering tools: shapes, materials, lights, cameras, and scene objects. We still write the game rules ourselves. It does not automatically provide toy sorting, scoring, enemy behavior, win conditions, or a restart system.

We use a perspective camera at the helper's eye height. Objects look smaller with distance; mouse movement turns the view. Visible textured hands hold a torch that F switches on and off. The opening moves the camera inside the room, then returns to the helper's exact view.

Movement and collisions will use simple calculations rather than a physics engine. The helper stays on the floor, room boundaries limit movement, and distance checks decide whether an object is close enough to interact with or the monster has caught the player.

### Dependencies and running the game

- Three.js 0.170.0 is the only external runtime library; its files and license are in vendor/.
- HTML, CSS, JavaScript, WebGL, and Web Audio run in the browser; players do not install them separately.
- Double-click START_GAME.cmd or run node tools/server.mjs. Node.js is already installed on this computer. No npm installation is needed.
- No backend, database, login, cloud service, AI API, or Internet connection is needed during play once the local files and server are available.
- No React, Phaser, Godot, Unity, physics library, or build framework is planned. Our small room and simple rules let us keep setup focused within four hours.
- Offline play here means playing through the local server without Internet. Directly double-clicking index.html is not the supported launch method.

## Textures: use the existing source packages

A texture is an image placed on a surface: wood on a shelf, skin on a hand, or worn cloth on the mascot. The user explicitly requested the local Resident Evil packages. Ten usable Village textures were selectively decoded and stored in assets/extracted/. The original game packages remain unchanged. ASSET_PROVENANCE.md records sources and reproduction commands; the package assets are not asserted to have a CC0/open license.

No painted, AI-generated, or procedurally generated replacement surface art. Most maps are 1024px; the skin atlas is 2048px and the renderer samples its clean skin region. Original simple geometry and text labels are separate from these surfaces. QA checks file loading, texture clarity, and whether hands/materials look correct in the actual scene. External assets added in future must have verified reuse terms and credits.

## Words you need to know

- Three.js: the small rendering library we use to display 3D objects in the browser.
- Scene: the collection of visible objects, like a stage.
- Mesh: a visible 3D object, such as a cube shelf or sphere ball.
- Camera: your eye-height viewpoint. Mouse or keyboard look turns it.
- State: the game's memory: position, score, collected toys, and current screen.
- Game loop: the repeated cycle that reads keys, updates the world, and draws it.
- Delta time: seconds since the previous update, used so movement speed does not depend on frame rate.
- HUD: score, time, objective, and instructions shown over the game.

## What the player does

1. Click ENTER THE NURSERY.
2. Watch the 15-second animated opening. Movement is disabled.
3. Move with WASD; use the mouse to look. Face a nearby toy and press E. F toggles the torch. Left/right arrows turn and Q/Z look up/down when mouse look is unavailable.
4. Carry it to the matching named shelf and press E. Repeat for all three toys.
5. The third delivery instantly changes the sky to red. A 1.35-second blackout/impact and inventory message reveal that YOU are the last toy.
6. In the corrupted room, press E near each of three switches while avoiding the mascot.
7. Walk to the unlocked exit and press E to win.
8. If caught or out of time, see why you lost. RESTART RUN returns to the title with a fresh run.

## Rules the AI must preserve

| Rule | Exact behavior |
|---|---|
| Points | 100 per toy, 150 per switch, 300 for escape; maximum 1,050 |
| Time | 120 seconds per level; only active gameplay counts |
| Carrying | One toy at a time; wrong shelf keeps the toy and gives no points |
| Repetition | Each toy/switch/escape scores once; holding E does not repeat |
| Exit | Locked until all three switches are used; E at exit is required |
| Monster | Sits in the room from the beginning; wakes three seconds after first switch, safely away from player; slower than player |
| Pause | Leaving the tab pauses time and clears held keys |
| Restart | Resets every run-dependent value and returns to TITLE |
| Cinematics | No movement, interaction, or countdown during either sequence |

## How the 3D room works

Think of the floor as graph paper: X means left/right, Z means forward/back, and Y means height. The helper moves on X/Z; they do not jump. Room size starts at 16 by 12 units. Player speed starts at 4 units/second; E works within 1.3 units.

You are inside four walls and a ceiling, with a window showing the night sky and trees. You must turn to see different parts of the room. Dim lamps and your directional torch reveal objectives. Perimeter props are visual; movement uses room bounds instead of complex furniture physics.

Draw the helper, toys, shelves, switches, and monster from simple boxes and spheres. Level 2 reuses the room but changes lighting, objects, objectives, and the mascot. Do not download 3D models or build separate large maps.

## How the code is organized

- main.js starts everything and runs one loop.
- game.js is the manager: it owns score, timer, current screen, and restarting.
- levels.js handles toy rules, switches, player positions, and monster movement.
- input.js remembers held movement keys and detects one E press.
- scene.js draws the 3D world. It reads game data; it never changes the score.
- cinematics.js schedules the opening and reveal, including camera movement.
- ui.js displays menus and HUD; audio.js supplies the mandatory original soundscape, cues, mute and volume.

Example: E is pressed near a correct shelf → levels.js marks that toy delivered → game.js adds 100 once → scene.js moves the toy onto its shelf → ui.js shows the new score. Drawing the scene again must not add another 100.

## Build and verify in this order

1. Show a real 3D room and a moving helper. Check camera, bounds, and local launch.
2. Finish toy sorting, score, timer, losing, and restarting. Prove 300 points is reachable.
3. Finish switches and escape before adding the monster. Prove a full win reaches 1,050.
4. Add and tune the monster so a beginner can still win.
5. Connect the opening cinematic and inventory reveal. Check controls stay disabled until they finish.
6. Verify first-person look, the closed room, hands, torch, instant red window, and mandatory sound design.
7. Reserve the final hour for complete playthroughs, bug fixes, backup, and demo practice.

Each step must actually run before proceeding. Follow the detailed time allocation and acceptance checks in plan.md. Do not rewrite working systems to add optional polish.

## How to avoid common AI mistakes

- Use one authoritative game state; do not store separate scores in the HUD and game logic.
- Keep movement and interactions separate from drawing.
- Use world distances for interactions, never display pixels.
- Use object IDs/status flags to prevent duplicate awards.
- Make the visible E prompt agree with the actual interaction target.
- Preserve score when changing levels; reset it only on a new run.
- Use seconds for movement and animation timing; normalize diagonal movement.
- Keep only one animation loop and one set of event listeners after restarting.
- Keep Three.js local and record its pinned version. Do not depend on Internet at demo time.
- If something fails, fix the smallest relevant part and recheck that behavior.
- Report what was actually tested, what failed, and what remains unverified.

## What counts as finished?

A new player can start, watch the intro, complete both 3D levels, win with 1,050 points, lose for understandable reasons, and restart without problems. First-person room presentation, hands, and HUD work on a normal laptop screen. The game launches locally without Internet and includes clear instructions.

Implementation and this revision are authorized. Save progress and reproducible launch steps in CONTINUE_HERE.md so a new account/session can continue.
