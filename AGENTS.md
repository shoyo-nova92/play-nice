# PLAY NICE — agent collaboration

## Start here

Implementation is authorized by the user, including parallel specialist work, selective extraction, and the first-person horror revision. Follow latest user instructions, plan.md, then HORROR_UPGRADE.md for active interfaces. Preserve previous working backups.

Before implementation or review, read [plan.md](plan.md) for authoritative gameplay, technology, timing, and acceptance criteria. Read [spec.md](spec.md) for beginner explanations and the tech stack. The archived 2D plan is historical only. Resolve discrepancies against the latest user instruction, then plan.md; update affected documents rather than silently inventing rules.

## Team size and roles

Roles describe responsibilities, not permanently running agents. Use at most four active agents including the coordinator, or the environment's lower limit. Activate specialists only when their task is ready; one agent can perform several roles sequentially. Keep authors and final reviewers separate for each milestone when another agent is available.

| Role | Owns / may edit | Main responsibility | Completion evidence |
|---|---|---|---|
| Coordinator and integration agent | src/main.js, src/game.js; planning documents; agreed shared contracts | Break milestones into bounded tasks, assign file ownership, own authoritative state/transitions/scoring/timer/reset, integrate accepted work | Integrated milestone runs; contracts agree; completed and unresolved checks reported |
| Gameplay agent | src/levels.js, src/input.js | Movement, one-shot E, toy/shelf rules, switches, exit, enemy pursuit, focus handling | Required interactions, failure paths, and duplicate-input cases verified; exact outcomes documented |
| 3D rendering agent | src/scene.js, vendor/ and its dependency record | Pin and store Three.js locally; build primitive room/actors, camera, lights, resizing; synchronize visuals and manage resource lifecycle | Real 3D view works, first-person room presentation verified, visuals match state, restart does not accumulate resources |
| UI and cinematic agent | index.html, styles.css, src/ui.js, src/cinematics.js; src/audio.js through assigned sound specialist | HUD, menus, prompts, intro/reveal timeline, cinematic camera requests, mandatory sound design | Readable screens and timed sequences; buttons work; camera returns correctly; prompts match interactions |
| QA and compatibility agent | Review findings and test evidence; README.md when assigned | Independently test complete runs, browser behavior, offline resources, input, timing, resize, restart, and run instructions | Reproducible pass/fail/unverified report, browser console/resource findings, launch instructions checked |

QA has read access across the project. It reports defects to the owning author; it edits another owner's code only after the coordinator transfers ownership. The coordinator also reviews cross-module contracts; QA does not independently redefine game rules.

## Execution order after coding is authorized

1. **Agree interfaces.** Coordinator inspects available tools and records a short contract in project documentation: exported functions, state fields, event shapes, units, and file assignments. Rendering, gameplay, and UI agents confirm the parts they consume. Finish when all assigned work can name its inputs/outputs without guessing.
2. **Prove the 3D shell.** Coordinator and rendering agent establish a local launch, one loop, room, camera, and moving helper. Gameplay agent supplies input as needed. Finish with the first plan.md acceptance gate; then preserve a working snapshot.
3. **Build vertical slices.** Gameplay adds Level 1, then Level 2. Rendering and UI work in parallel on their owned files using the agreed contract. Integrate each level before optional polish. Finish each slice only after its actual completion and failure paths work.
4. **Connect cinematics.** UI/cinematic author implements timelines; rendering author implements camera application. Coordinator gates controls and timers by phase. Finish when intro → Level 1 → reveal → Level 2 works without losing score or leaving the camera in the wrong position.
5. **Independent verification.** Free a specialist slot for QA. Coordinator handles integration fixes; authors fix assigned defects. Finish with full-run, failure, restart, compatibility, and local-resource checks from plan.md, plus a final backup and honest remaining limitations.

Follow the four-hour allocation in plan.md. Reserve the final hour for verification and fixes. If behind, remove optional polish before reducing mandatory gameplay. Use short, bounded assignments rather than spawning an agent for every object, sound, or level.

## Shared contracts

### Texture ownership and review

For this revision, the extraction specialist owns assets/extracted/, tools/assets/, and ASSET_PROVENANCE.md; the renderer reads and integrates these assets. The user explicitly requires selective reuse from their supplied Resident Evil packages. Record provenance without claiming an unverified open license. The following external-source preference applies only to additional assets sourced online: During authorized implementation, source existing openly licensed textures, preferring verified CC0 assets; record source URL, filename, creator when available, license, and required credit. Store files locally and retain supplied licenses. Use the small texture budget in plan.md; use colored materials where sufficient. Do not paint, AI-generate, or procedurally create textures. QA independently checks source/license records, local-only runtime loading, missing-file fallback, and visual compatibility with both room palettes. Texture sourcing must not block the gameplay milestone.

Agree concrete function signatures before parallel coding. Preserve these boundaries:

- **Game coordinator:** owns phase, total score, active timer, run reset, and the authoritative world state. Only it applies phase changes and score awards.
- **Input:** supplies normalized X/Z movement and a consumed single-press interaction intent. Clears held keys on focus loss. It does not choose targets.
- **Gameplay:** updates logical positions and per-object status through the coordinator's update path; reports semantic outcomes with stable object IDs. It chooses the interaction target used by both the prompt and E.
- **Renderer:** reads state and cinematic camera instructions, updates meshes, and draws. It never awards points or mutates gameplay. Rendering twice must not advance play.
- **Cinematics:** supplies elapsed-time shot information, messages, camera instructions, and completion. Coordinator decides when gameplay resumes.
- **UI:** reads the same state and interaction target; sends menu intents. It never computes its own score, countdown, or unlock state.
- **Audio:** consumes semantic cues; failure or mute leaves gameplay functional.
- **Units:** X/Z positions and distances are world units; Y is height; speeds are units/second; all simulation/timeline durations are seconds. Screen pixels are for presentation only.
- **Lifecycle:** one animation loop and one input-listener set. One explicit reset recreates run state; rendering cleans up/reuses its resources. Async startup failure shows a readable error.

Any agent proposing an interface change sends the coordinator: old contract, new contract, reason, and affected consumers. Coordinator approves the change within the authorized implementation scope, updates the contract, and assigns consumer edits before integration. Routine coordination does not require another user approval.

## Cross-review: who checks whom

| Change author | Reviewer | Required checks |
|---|---|---|
| Gameplay | Coordinator, then QA on integrated play | Unique awards, target selection, one-shot input, reachable objectives, enemy speed, completion/failure events |
| Rendering | UI author or coordinator, then QA | State-to-mesh correspondence, camera framing, resize, world units, resource cleanup, local dependencies |
| UI/cinematics | Rendering author for camera compatibility; coordinator for phase gating | Timeline completion once, HUD reads real state, input/timer lockout, camera restore, working menus |
| Coordinator/core | QA or an available non-author specialist | State ownership, transition order, score persistence, failure priority, focus pause, restart integrity |
| QA report / README | Coordinator | Evidence matches tested build, launch instructions actually work, unverified checks remain explicit |

Review changed interfaces and relevant behavior rather than rewriting another agent's style. A review is complete when each required check is marked pass, fail, or unverified with evidence. Independent review reduces risk; it does not guarantee a bug-free game.

## Shared workspace rules

- Coordinator assigns one writer per file at a time, including shared documentation. Different agents may read any file.
- Every assignment names its milestone, owned files, required exports/events, dependencies, acceptance checks, and excluded scope.
- Treat teammate edits as live work. Preserve unrelated changes and avoid broad replacements, destructive resets, dependency churn, or cleanup outside assigned files.
- When blocked by an unfinished module, agree a minimal interface with its owner. Keep temporary placeholders visibly tracked and remove them before milestone acceptance.
- Handoffs include changed files, exported interfaces, tests actually run, known defects, and the next integration dependency. Report failures promptly with expected/actual behavior and reproduction steps.
- Coordinator integrates compatible changes, runs relevant checks, and saves a snapshot at each working milestone. Keep the previous working build available while fixing regressions.

## QA priorities and acceptance

Use the full checklist in plan.md. Prioritize these integration risks:

1. A complete run plays both levels and reaches 1,050 points without duplicate awards.
2. Wrong shelf, held E, used switches, and locked exit cannot bypass rules.
3. Intro and reveal finish automatically; controls/timers are gated; score survives the level change.
4. Capture, both timeouts, and restart from WIN/LOSE work; simultaneous terminal conditions follow plan.md.
5. Tab changes clear input and pause time; diagonal speed is normalized; resize does not change world interactions.
6. HUD, target highlights, and meshes reflect the same data at 1366×768 and 1920×1080.
7. Local launch succeeds without Internet, with no uncaught console errors or missing runtime files. Verify Chrome and Edge when available; otherwise report the untested browser.
8. Repeated restarts retain one loop/listener set and a stable scene. Unsupported WebGL shows a readable message.

Use focused automated checks for state/input rules when useful and feasible; actual browser interaction remains required for 3D presentation and gameplay acceptance. Do not spend the deadline building a large test framework.

For each defect record severity, reproduction, expected/actual result, owner, and retest result. Fix crashes, broken progression, incorrect score, impossible escape, and broken reset before cosmetic defects. If testing access is unavailable, state that limitation rather than marking checks passed.

## Final delivery

Coordinator reports what was implemented, how to launch it, which checks passed, which remain unverified, and material limitations. Include all local runtime files, checked README instructions, and the final backup. Implementation and the current horror revision are authorized. Keep CONTINUE_HERE.md ready for an account/session handoff.
