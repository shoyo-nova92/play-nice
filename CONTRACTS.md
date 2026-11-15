# PLAY NICE — current contracts

The first-person horror contract in [HORROR_UPGRADE.md](HORROR_UPGRADE.md) is authoritative for active interfaces and ownership. The remainder records stable gameplay details, with old presentation sections superseded below. Latest user request authorizes implementation, subagents, and mandatory extraction.

## State owned by game.js

`state = { phase, phaseElapsed, elapsed, score, timeLeft, world, target, paused, message, reason, awards, cinematic, display, torchOn, muted, pointerLocked, events }`

- phase: TITLE, INTRO, LEVEL_1, LEVEL_TRANSITION, LEVEL_2, WIN, LOSE.
- phaseElapsed / elapsed: visible unpaused seconds; game update clamps frame dt at 0.05 seconds.
- score: number; awards: array of unique award strings; only game.js changes both.
- timeLeft: seconds, initially 120 per level.
- world: mutable logical world below; only gameplay functions called by game.js modify it.
- target: selected interaction object or null, shared by renderer/UI/E.
- message: `{text, remaining, tone}` or null; tone is info/success/warning.
- reason: result failure text or empty string.
- cinematic: shot below or null; coordinator advances timing and gates play.
- display: `{ level, objective, progress, timer, carrying, score, resultTitle, resultDetail }`, strings formatted by coordinator for UI.
- paused: boolean; updates freeze when unfocused. main.js clears input and resets frame timing.

## levels.js exports

- `ROOM = {width:16, depth:12}`.
- `createWorld(level)` -> world. level is 1 or 2; includes noninteractive decorative L1 toys/shelves as appropriate; creates fresh objects on new level.
- `movePlayer(world, movement, dt)` -> void; normalize input defensively, clamp radius, accumulate distanceWalked; camera yaw controls facing, independently of strafing.
- `selectTarget(world)` -> `{id, kind, name, x, z, prompt}` or null; kind toy/shelf/switch/exit. Nearest within 1.3 in facing cone dot>=0.25; stable ID ties. While carrying consider only shelves; otherwise floor toys. Level 2 only unused switches and exit.
- `interact(world, target)` -> semantic event array, updates world statuses only. Revalidate target eligibility/proximity. No score/phase/DOM.
- `updateEnemy(world, dt)` -> event array; handles 3-second spawn countdown, distant spawn, direct pursuit and speed. Only called in active Level 2.
- `isCaptured(world)` -> boolean using actor radius sum.

World shape:

```
{
  level: 1|2,
  player: {x,z,radius:0.35,speed:4,carriedToyId:null|id,facing:{x,z},yaw:0,pitch:0,distanceWalked:0},
  toys: [{id:'bear'|'ball'|'duck',name,x,z,color,shelfId,status:'floor'|'carried'|'delivered'}],
  shelves: [{id:'shelf-bear'|'shelf-ball'|'shelf-duck',name,x,z,color,toyId}],
  switches: [{id:'switch-1'|'switch-2'|'switch-3',name,x,z,disabled:false}],
  exit: {id:'exit',name:'EXIT',x:6.6,z:-4.5,unlocked:false},
  enemy: {x,z,radius:0.55,speed:2,active:false,spawnIn:null|number,wakeElapsed:0},
  deliveredCount:0,
  switchCount:0
}
```

Color is numeric hex suitable for Three.js. Suggested shelves (-5,-4.3),(0,-4.3),(5,-4.3); toys (-4.3,2.7),(0,0.8),(4.6,2.2); player (0,4.7). Level 2 switches (-6,2.5),(-4,-4.3),(5,-1.5). Keep logical/render positions identical. Renderer uses actual data, not duplicate position constants.

Events: `{type:'toy.picked',id}`, `{type:'toy.delivered',id}`, `{type:'interaction.wrong',id}`, `{type:'switch.disabled',id}`, `{type:'exit.locked',id:'exit'}`, `{type:'exit.used',id:'exit'}`, `{type:'enemy.spawned'}`. No `points` or phase fields. First switch sets enemy.spawnIn=3; all disabled sets exit.unlocked. Third delivery is inferred centrally from count.

## input.js exports

See HORROR_UPGRADE.md: createInput receives surface, onFocusChange, onPointerLockChange, onGesture; exposes read/clear/dispose plus mouse lock and look-enable methods. Ten listeners total are created once and disposed. Read returns movement/look/turn plus interact/primary/restart/torch/mute/escape. WASD is camera-relative, arrows turn/advance, Q/Z tilt. Mouse lock and hold-drag are both supported.

## game.js / main.js

`createGame()` -> `{state,update(dt,intent),dispatch(action),setPaused(paused)}`. Actions start/restart/mute. main.js handles resume, pause, audio unlock and volume. main.js owns one RAF, calls input.read -> game.update -> scene.sync -> ui.update -> scene.render. Button intents go through game.dispatch. Reset creates fresh run state but keeps outer state object stable or consumers reread game.state.

Active update order: move player; decrease time; update enemy; check timeout/capture before interaction/escape; select one target; consume interaction; apply unique score/phase outcomes; recompute target/display. Failure takes priority on terminal frame. No escape bonus after failure. Input/timer/enemy gated by phase. Intro lasts 15, reveal 1.35; focus pause also freezes cinematic timing. Result restart returns TITLE, score zero.

## scene.js exports

`createScene(host)` -> `{sync(state,shot),render(),resize(width,height),dispose(),getDiagnostics()}`. Synchronous creation, throw readable WebGL/setup error; main.js catches. host is a DOM element; scene creates and appends canvas. Resize in CSS pixels, DPR capped to 2. `sync` reads state and shot; no game mutations or timing advancement. Render twice never advances play. Reuse meshes/materials; bounds/frustum include room and actor height at 1366x768 and 1920x1080.

Perspective camera and full enclosed-room rendering follow HORROR_UPGRADE.md. getDiagnostics reports texture loading, resource counts, projection, torch state, and camera pose. scene.sync is read-only. Local dependencies, labels, target highlights, handed carried toy, and logical enemy position remain shared.

## cinematics.js exports

`getCinematic(phase, elapsed)` -> null or `{kind,title,subtitle,lines,progress,overlayOpacity,corruption,camera,complete}`. kind boot/room/reveal; lines string array; camera null or `{position:[x,y,z],target:[x,y,z],zoom}`; opacity/corruption/progress 0..1. complete at >=15 INTRO or >=1.35 LEVEL_TRANSITION. Pure function; no clocks/timeouts/state mutation. Follow plan.md current beats; introductory camera settles at player view before play. Reveal corruption equals1 immediately; there is no slow blend.

## ui.js exports

`createUI({onAction})` -> `{update(state),showError(message),dispose()}`. DOM supplied by index.html. Sends start/restart/resume/mute/volume intents. Reads authoritative display, target prompt, message and shot. Never computes score, unlock, target, active countdown. CSS supplies restrained dark menus, small HUD, reticle, and contextual torch/interaction hints. Keyboard focus visible. Desktop readability required.

## Presentation and verification

See plan.md and HORROR_UPGRADE.md for current visual direction: enclosed worn nursery, dim practical lamps, first-person hands and torch, seated then waking mascot, instantly red sky. Existing Village surfaces are mandatory; no generated replacement surface art. The old overhead build is preserved in backups/PLAY_NICE_FINAL.zip. Its old verification does not establish correctness of this revision. Current checks and unresolved work belong in QA_REPORT.md and CONTINUE_HERE.md.
