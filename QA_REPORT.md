# STEALTH REVISION — INTEGRATION NOT FINISHED

Latest user request is implemented in runtime modules but NOT yet accepted. Read STEALTH_CAPTURE.md. Previous stable package is PLAY_NICE_SEQUENCE-20261115-162459.zip; do not overwrite it or call currentroot final.

Implemented:6.2scapture, world-space droppedtorch andremovedfacefill, persistentL2grin/redglow, jitter/elongatedlimbs/headturn, solidprop sweptcollision, A* navigation/patrol/LOS/hearing/search, speed2.3/2.5/2.7, twohideboxes+closet, Ehide/exit Shift sneak Spacepeek, hiddenview/torchcover, audiojoint/torch/hide cues. Rootmajorlayoutfixes: archive desk movedfrom-9.9to-9.2 toleavecontrolaccess; toybasket movedx5tox4 toavoidsealingexitcorner; renderer movesbasket bytaskdata. pathfindersolidgoal nowseeksreachableapproach within1.25 ratherthanunreachableclosestcell.

Testing: new tests/stealth.test.mjs7/7pass coveringcollision/hide/peek/witness/sneak/LOS/patrol/behindcapture/controlaccess. Audio21pass. Maincore inputmock/timing tests adapted,6.2s gatechecked. FULLnpm test stillfails: oldbound/pursuitfixtures andphysicalescape routes notfullyadapted. Earlierintegration run108tests96pass12fail beforelatestfixturefixes; rerun forcurrentexactcount. No testskip/deletion done. Existingcapture-camera test passeslegacyprojectionbutrenderercompressedtime test stillneeded. Actualbrowser unavailablepreviousattempts.

Next coordinator: inspect fullnpmfailures. Finish path-guided routehelpers aroundsolidfurniture; usercanhide now so all6order routes need stealth/evasion strategies, notstraight oldchase scripts. Some oldpurewalltests nowclearprops intentionallytoisolatewalls. EnemyLOS patrolmeansoldstationaryplayercatchassertions invalid; replacemeaningfullywithnavigation/path/sensorcases, notfakepasses. CorecleanupduplicateE canenternearbyhide; testnowexitsifhidden. Newrandom enemyseed mustbenormalizedonlyinresetdeepcomparison. Needfreshindependentreview of gameplaylogic whenagentcreditsavailable. Allspecialistshitusage/networklimits; rootownsallfilesnow. Keep docs honest. Do not package final until failures resolved. No userapproval needed.

## Historical records

# Latest update: randomized controls and visibility

Version4.1.0-sequence: all six permutations of01/02/03 may be selected perrun; journal displays exactorder, preservedthroughlevels. Wrongpress rejection hasnoaward/progress/spawn. Allsix legal movement routes verifiedto1050 withoutspeedchanges.98tests pass total. Newnearplayerlight range3.2, cinematicfacefill andstrongereyes, nearlyopaquefrostedglass withrain/lightning, layeredcaptureimpacts andwrongcontrolcue. Volume/mute/limiterpreserved.

Launch START_GAME.cmd or http://127.0.0.1:8060/ whilelocalserverrunning. Actualvisual/listeningreview stillUNVERIFIED duebrowseraccessunavailable inpreviousattempts. Previousversionssafeinbackups. Continuefromcurrentfiles; noactivewriterafterhandoff.

> Latest update: all three controls are wall-mounted. Control03 is on the secret archive back wall; solving the journal/book puzzle is now REQUIRED to unlock the exit. Updated movement-driven full run passes with1050points. Browser visual verification remains unavailable.

# Family/secret-room revision — current checks

PASS86automatedtests: existingcore/audio/capture plus5storycinematic and17secretpuzzle/movement tests. All3randomclues, journalpause, bookprerequisite, wrong/correctbook, .7sslide, closed/openwall, sweptcollision, enemydoorwayroute, fullcleanup/escape1050, secretL2persistence/reset. Capturecamera archive/main bounds andgrinframing pass. Syntaxchecks pass.

Source-review defects corrected: cleanupbookcase movedbeforetaskfinished, enemycrossingwall/stickingnearpost, archivecaptureteleport fromoldclamp. Actualbrowseraccess remainsunavailable; visuals/performance/listening/interactivefullrun UNVERIFIED.

## Historical reports

# Latest storm revision verification

- PASS64automatedtests:47core,16audio,1actualThreecapturecamera regression covering400poses/times. Grin andteeth stayinframe duringfinalupsidedownzoom; capturedstateunchanged. Sourcefix increasedcameradistance andaimedatfacecenter.
- PASS newrenderer syntaxcheck. Earlier21runtimefiles HTTP200 andlauncher3.0.0-storm checked; recheck finalreleasebelow.
- UNVERIFIEDactualbrowservisuals,performance,fullinteractiveplaythrough,Chrome/Edgecompatibility,listening,disconnectedInternet. Browsertool unavailable inthischat. No visualclaimsfromsourcechecks alone.
- Priorinterimstormarchive154222 hasoldcapturecamera; correctedversionisnewer.

## Historical reports

# First-person horror revision — QA checkpoint

2026-11-15. Previous overhead-build results below are historical and do not verify this revision.

- PASS: 54 Node tests (43 core/integration mock tests +11 audio tests). First-person movement, facing, torch/mute one-shot input, immediate corruption,1.35s reveal, pose preservation, full route1,050, failures, reset, pointer lock/drag, Esc/resume and synchronous background audio pause.
- PASS: Ten genuine extracted texture files total17,007,676bytes; new4 regenerated identically; original6 preserved. Current plan copies have identical hashes.
- PASS: First-person renderer saved and syntax checked; local launcher starts version2.0.0-horror.
- UNVERIFIED (browser access unavailable in this chat): actual browser presentation, texture loading/resource lifecycle, full interactive run, torch beam, window red change, mascot seated/waking/chasing, actual browser audio unlock/scheduling.
- UNVERIFIED: Listening on user's device, Chrome compatibility, physically disconnected Internet test, unfamiliar-player playtest.

## Prior overhead-build evidence

# PLAY NICE independent QA

Date: 2026-11-15. Reviewer: asset specialist reassigned to QA; did not author game/input/cinematic/core code. Scope: `tests/core.test.mjs`, isolated `tests/browser.html`, and this report. Browser control remains with coordinator.

## Current evidence

Command: `node --test tests/core.test.mjs` (Node v24.18.0, built-in test runner; no installed test framework). Latest independent run: **30 tests, 30 passed, zero failed** after owners fixed QA-01, QA-02, and QA-03.

The tests exercise actual game, input, and cinematic modules. Main-loop tests run the actual main.js body with mocked DOM, RAF, scene, and UI adapters; they establish orchestration/listener behavior, not real WebGL/browser compatibility. Boundary/failure cases use explicit fixtures; the full completion route uses actual logical movement and E intents through both levels without teleporting positions or disabling pursuit.

- PASS: independent fresh state, menu gating, 15-second intro, cinematic narrative boundaries, camera settled before control, transition score preservation/reset of per-level timer, complete pause freeze, result immobility, full restart reset and stable outer state object.
- PASS: one-shot E, consumed actions, repeated/held E across clears, diagonal normalization, arrow prevention, modifier/editable-field safeguards, blur/visibility input clearing, idempotent listener disposal.
- PASS: mocked main keeps one RAF and one listener set through 20 restarts; creates one scene; pagehide disposes once; returning focus cannot apply a hidden-time jump.
- PASS: initial hidden/unfocused startup correctly pauses after author fix; exact accumulated 7-second reveal and 120-second timeout boundaries, and countdown display, pass after coordinator's numerical-tolerance fix.
- PASS: integrated Level 1 completed through actual logical movement and E intents (no position teleporting in the completion case); wrong shelf keeps the carried bear; another toy cannot be picked up while carrying; repeated delivery interactions do not duplicate score; all three deliveries produce exactly 300 and one reveal; reveal preserves score into fresh Level 2. Nearest/range/stable-ID target selection, stale-target rejection, radius-aware room bounds, and equal diagonal speed also pass.
- PASS: simultaneous third toy delivery and timeout chooses LOSE, leaves score at 200, and never enters the reveal.
- PASS: complete movement-driven two-level run reaches exactly 1,050 with seven unique award IDs. Locked exit gives no points; used switches cannot score again; third switch unlocks without winning; walking to exit does not win until E; WIN freezes enemy/timer and restart clears run.
- PASS: enemy activates once at exactly three active seconds after first switch; warning is immediate; pause freezes spawn; near-player spawn uses farthest corner; speeds are 2/2.2/2.4 and below player speed; capture uses the sum of radii. Capture, timeout, and both together defeat simultaneous escape without the 300 bonus. Previous-level toys and used switches cannot be selected.
- PASS: injected fatal render exception stops RAF and removes keyboard listeners after owner fix, allowing Enter to reach the error-screen recovery button.
- Browser observations below were executed by the coordinator, not independently by this reviewer. Node mocks are never counted as real-browser passes.

## Coordinator-reported browser evidence

These observations were supplied by the coordinator, who alone controls the browser; they were not performed independently by this reviewer:

- Edge at 1366 x 768: controlled blue-ball pickup; E at red-bear shelf displays WRONG SHELF, retains carry, and leaves score zero; correct delivery followed by held E awards exactly 100 and progress 1/3.
- Natural Level 1 timeout displays “Time ran out in Happy Helper,” freezes score at 100; R returns TITLE with fresh toys.
- Latest visual build: shelf labels below HUD; full room, floor, and player fit. Console was empty at earlier launch/reveal checks.
- An earlier live reveal/Level 2 score-300 observation included possibly user-performed actions and is **not** counted as a fully controlled complete-run test.
- **PASS — later fully controlled Edge run:** native held-key events complete ball, bear, duck at 100/200/300, seven-second reveal, E at locked exit retains 300, switches 1/2/3 under active pursuit, and E at exit reaches WIN **1,050**. This later run supersedes the earlier incomplete evidence.
- **PASS — actual Edge isolated renderer harness, all six checks:** seven map requests loaded, zero failures; repeated sync/render preserves logical state; 20 warmed reset/render cycles retain stable resources; 1366 x 768 and 1920 x 1080 resizes preserve logical coordinates; forced WebGL2 absence produces readable error and restores `getContext`. Developer warnings/errors were empty.
- Resource counts before and after 20 cycles: **7 GPU geometries, 20 GPU textures, 4 programs; 7 tracked geometries, 44 tracked materials, 20 tracked textures, 10 object views**. These establish stability for the exercised scene states and cycles.

`tests/browser.html` imports its own scene/game/world, never main.js, never production state, and creates no input listener or animation loop. The `getContext` mock is confined to the harness page and restored in `finally`. Harness execution is complete as reported above; its numeric resize check does not by itself prove production HUD framing at 1920 x 1080.

## Remaining acceptance checks

The coordinator owns these remaining checks:

- Controlled actual-browser Level 2 capture and timeout.
- Full run at 1920 x 1080 and visual recheck of the corrected result-card contrast.
- Actual tab/focus pause and held-input clearing.
- Chrome smoke test.
- Physically disconnected-Internet launch (local-only runtime evidence below is complete).
- Default launcher's browser-opening branch (server startup and HTTP delivery are verified below).
- Unfamiliar-player usability remains unverified unless a separate person actually plays.

Browser automation ended during the Chrome smoke test: automatic approval review could not reliably determine the Windows Chrome window's current URL and blocked navigation. No further browser actions were attempted. This leaves Chrome compatibility and the other listed UI checks unverified; it does not invalidate the completed Edge run.

Coordinator delivery verification: launcher invoked with `-NoBrowser -Port 8010` started its background local server successfully; all16 page/style/module/library/texture runtime files returned HTTP200 with correct MIME types. Game module/CSS source scan found no remote runtime URLs, fetch calls, or WebSocket usage; the SVG namespace in the data-URL favicon is not a request. Physical Internet disconnection was not performed. The final npm test run remains30/30, and all source/server syntax checks pass. The final portable archive and resume notes are recorded in CONTINUE_HERE.md.

The final bounded source audit revisited game, input, main, UI, cinematic integration, renderer lifecycle, CSS, and static-server behavior. It found no additional high-impact progression, scoring, timing, or reset defect. The related fatal-overlay contrast finding has been patched with explicit ink color; both visual patches await a fresh browser retest.

## Defects

| ID | Severity / owner | Reproduction | Expected / actual | Retest |
|---|---|---|---|---|
| QA-01 | P2 — input/core startup | Create input/main with `document.hasFocus() === false` or `document.hidden === true` | Coordinator should start paused; originally `game.state.paused` remained false because initial local focus was never reported | FIXED by input author; independent startup tests pass for both conditions |
| QA-02 | P3 — coordinator/cinematics | After intro, apply 20 updates of .05 seconds; separately apply 140 updates of .05 during reveal, or 2400 during Level 1 | Countdown should show 01:59 after 1 second; originally numeric remainder 119.00000000000006 displayed 02:00. Reveal/timeout also waited one extra frame on tiny FP residue | FIXED by coordinator using 1e-8 second tolerance; all three independent boundary tests pass |
| QA-03 | P2 — coordinator/main | Inject a render exception in one animation frame, then send Enter to a recovery BUTTON | RAF should stop and recovery button should receive native Enter; originally input.clear left game keyboard handlers installed and preventDefault intercepted Enter | FIXED by coordinator disposing input in fatal catch; independent injected-failure test passes |
| QA-04 | P2 — coordinator/CSS | Coordinator's first controlled L2 WIN screenshot | Result text should remain dark on cream; `.corrupted` light text was inherited by the result card | Coordinator added explicit ink color; actual next-WIN visual retest pending |
| QA-05 | P2 — coordinator/CSS | Source audit: a frame exception while `app.corrupted` is present | Fatal overlay uses cream background but inherits light corrupted text; `showError` leaves the class intact | PATCHED: `.result-card,.fatal-error{color:var(--ink)}`; source verified, actual browser retest pending |

No production files were edited by QA. Owners received concrete reproduction and root-cause findings. QA-01/02/03 are independently retested and closed; visual follow-ups remain as listed. No unresolved gameplay/core defect is known from the exercised scope; this is not a guarantee against untested behavior.


Latest saved horror release: release/PLAY_NICE_HORROR-20261115-152044. Archive: backups/PLAY_NICE_HORROR-20261115-152044.zip. SHA256 D9BF93663626F17B102D0ECE85A3B99F9201B7C661B33BD4598D8921D09341AD. Launcher tested at http://127.0.0.1:8030/;21 runtime files HTTP200. Browser visuals/listening remain unverified because local browser access is unavailable in this chat.


## Storm revision implementation saved
Version3.0.0-storm: sixcleanupjobs, fullerroom, trackingeye teddies, rain/wetwindow/softenedoutside,11s lightning+delayedthunder,8s grab/fall/drag/bloodsmear/leglift/upsidedownsmile/lensbreak/redcapture now implemented.63 automatedtests pass. Renderer syntaxpasses;21runtimefiles HTTP200; launcher running http://127.0.0.1:8040/. Actualbrowseraccess unavailableagain, so visuals, performance, humanlistening and interactiveplaythrough remainUNVERIFIED. Do notuse historicaloverheadproof asnewacceptance.


Latest corrected delivery: release/PLAY_NICE_STORM_FIXED-20261115-154648 and backups/PLAY_NICE_STORM_FIXED-20261115-154648.zip. Archive integrity and saved source matches verified; 21 runtime files return HTTP200. Prefer this archive over154222. Browser visuals and listening remain unverified.


Latest archive: backups/PLAY_NICE_SECRET_ROOM-20261115-160744.zip; SHA256 83E3CCBC3B5FDBE566942FAC6EED8E5819D0BD6F2A8CAA4A6E39104AB25E0ED2. Archive integrity/source matches PASS;21runtimefiles HTTP200.


Latest verified delivery: backups/PLAY_NICE_SEQUENCE-20261115-162459.zip (version4.1.0-sequence), SHA256 a7b048898d966c4096e3c15cccaaae41fca5ec7b6fcb2786dd17a53c07e03e20. Integrity/source matches PASS;98tests PASS;21runtime files HTTP200 atport8060. Browser visuals/listening remain unverified. All latest requested changes implemented; no active implementation work remains.

## 2026-11-15 — stealth revision final integration

- **PASS:** `npm test` — 114 passed, 0 failed, 0 skipped. Includes full legal movement routes through all six switch orders, collision/navigation, secret archive, hide/peek, pursuit/hearing/sight, behind-contact with an occluded sight ray, capture timing/camera math, and simulated audio.
- **PASS:** `node --check` for game, levels, scene, audio and server modules.
- **PASS:** Local health endpoint identifies PLAY NICE build `5.0.0-stealth` and the current project root.
- **PASS:** 25 files under `index.html`, `styles.css`, `src/`, `vendor/`, and `assets/` return HTTP 200 from the local server.
- **UNVERIFIED:** Actual browser visuals, performance, full manual run, WebGL console behavior and human listening. The CUA browser surface returned “Local browser access is unavailable for this chat.” Automated renderer/audio tests do not replace those checks.
- **Retained features:** first-person room-care game, six cleanup jobs, secret bookshelf/archive, journal-randomized control order, rain/lightning/window, positional synthesized sound, flashlight, solid furniture, stealth movement/hiding, roaming mascot, and accelerated dropped-torch capture.
- **Latest behavior fix:** Close rear contact triggers capture even if line-of-sight is occluded; regression test added.
- **Handoff:** See `CONTINUE_HERE.md`. Source and the versioned release archive are portable; another account only needs the copied files and Node.js to continue.
- **Release:** `backups/PLAY_NICE_STEALTH-20261115-170003.zip`; SHA256 `31E1277E8E15543F572C164373EE7536EFE4EF2C32ED961A5AE8C0D352B51E90`. The ZIP has 93 entries; all nonempty entries match staged release paths and sizes.
