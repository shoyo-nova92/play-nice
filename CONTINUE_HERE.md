# PLAY NICE — continuation checkpoint

## Current build

The working folder is the source of truth. This is a first-person, local 3D horror game built with vanilla JavaScript and Three.js 0.170.0. Latest implementation: **5.0.0-stealth**. The most recent requested stealth revision is integrated: collision against furniture and walls; faster roaming mascot with patrol/search/chase and movement-based hearing; sneaking; two hide boxes and a closet with peeking; persistent glowing red eyes and grin; elongated/jittering mascot; dropped torch with a narrow face-light beam; and a faster 6.2-second grab/fall/drag/lift/lens-break capture. Rear contact catches even if LOS is blocked. The randomized ordered control puzzle, secret archive, six room-care jobs, storm/window, and synthesized sound are retained.

Original Resident Evil source packages are not needed to run. Ten locally extracted surface textures are used; provenance, conversion and hashes are in `ASSET_PROVENANCE.md`. Do not claim permission to redistribute the original game art; the user supplied it for this local project.

## Run

On Windows, double-click `START_GAME.cmd`. Or in PowerShell at this folder:

```powershell
node tools/server.mjs
```

Open `http://127.0.0.1:8000/`. For tests, run `npm test` (Node.js 24+, no install needed). Latest result: **114 passed, 0 failed, 0 skipped**. The Windows launcher checks ports 8000–8009 and opens the browser.

Controls: WASD move, mouse look, Shift sneak, E interact/hide, hold Space to peek while hidden, F flashlight, M mute, Esc pause, Enter start/continue/restart.

## Verification limits

Node automated tests cover movement/collision, all six randomized switch routes, archive, hiding, patrol/hearing/LOS, capture timing/state and simulated audio. The local server health endpoint at `http://127.0.0.1:8070/health` reports build `5.0.0-stealth`; the server already running on that port is this source folder. **Visual browser playthrough, performance and human listening remain unverified in this chat because local browser access was unavailable.** Do not report them as passed. Run a real Edge or Chrome session when available, inspect console/network at 1366×768 and 1920×1080, play both levels, and listen with sound on.

## Account/session handoff

All needed project files, local runtime, test scripts, extracted assets, and source provenance live in this folder. Copy the folder (or the newest `PLAY_NICE_STEALTH` archive) to continue; no account credentials or chat memory are needed. Agents and running servers do not transfer between chats. Keep prior versioned archives in `backups/`.

Copy/paste prompt for a new coding session:

> Continue the existing PLAY NICE project in this folder. Read AGENTS.md, plan.md, spec.md, CONTRACTS.md, STEALTH_CAPTURE.md, ASSET_PROVENANCE.md, this checkpoint and the newest QA_REPORT.md entry. Do not start over. Latest source build is 5.0.0-stealth and automated suite is 114/114; latest archive name and SHA are in this checkpoint. First verify the current files and rerun `npm test`. Finish real browser visual, performance, complete-playthrough and audio checks when browser access is available; report pass/fail/unverified honestly. Fix only reproduced defects, preserve older backups, then update QA_REPORT.md and CONTINUE_HERE.md and produce a new versioned archive. No generic permission check is needed; implementation and packaging are authorized. Respect AGENTS.md file ownership and collaboration limits.


## Latest packaged stealth build

Folder: `release/PLAY_NICE_STEALTH-20261115-170003`
Archive: `backups/PLAY_NICE_STEALTH-20261115-170003.zip`
SHA256: `31E1277E8E15543F572C164373EE7536EFE4EF2C32ED961A5AE8C0D352B51E90`
The ZIP has 93 entries; every nonempty archive entry has a matching staged file and size. Source verification: 114 tests pass, zero fail/skip. Local source server health and 25 static file responses passed.
