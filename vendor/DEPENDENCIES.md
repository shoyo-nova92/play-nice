# Local runtime dependency

- Three.js **0.170.0**, upstream release/tag **r170**.
- Module source: https://raw.githubusercontent.com/mrdoob/three.js/r170/build/three.module.js
- Version verified against: https://raw.githubusercontent.com/mrdoob/three.js/r170/package.json
- License source: https://raw.githubusercontent.com/mrdoob/three.js/r170/LICENSE
- Downloaded 2026-11-15. The ES module is self-contained; no companion module imports or runtime CDN requests.
- Local `three.module.js` SHA-256: `CE1FA418DE16A19495A9F72495580E3015D7745C296D3CE0485897F902DDEDFB`.
- Local `LICENSE.three.txt` SHA-256: `4C40A1EF62450B857C3B2AAF294936304CD552D965FBCD9D32D4C5BCF4BA4454`.

MIT license is included in full in `LICENSE.three.txt`. Browser renderer uses WebGL2; startup surfaces a readable error if it is unavailable. Original game material provenance lives separately in `ASSET_PROVENANCE.md`.
