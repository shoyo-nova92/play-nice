# PLAY NICE asset extraction record

Status: COMPLETE, 2026-11-15. The original six surfaces and four additional first-person horror surfaces were selectively extracted, converted, and visually checked. The user explicitly required extraction from supplied Resident Evil folders and authorized building the game alongside this work. Author: asset specialist; only `tools/assets/`, `assets/extracted/` new horror files, and this document are owned by that specialist. Original six PNGs and their manifest remain unchanged.

## Constraints and current evidence

- Supplied folders contain 196 files totaling 191.95 GB. No loose room textures or models were found. Most data lives in 53 KPKA `.pak` archives.
- Source packages are read-only inputs. No supplied EXE/DLL is executed, no source pack is modified, and no bulk unpack is performed. Extraction tools refuse encrypted entries; no DRM bypass is included.
- The older Village package has an ordinary version 4.0 table with no feature flags. Its 87,481-entry index was read and just six selected texture byte ranges were exported. Source package: `Resident Evil Village/re_chunk_000.pak`, 29,528,999,518 bytes.
- Free disk at audit: about 76.3 GiB. Keeping this pipeline small is mandatory.

## Research and pinned inputs

- PAK index layout, filename hashing, and Village filename list: [Ekey/REE.PAK.Tool](https://github.com/Ekey/REE.PAK.Tool), commit `d22c15314e84eecd31480acfe692092c48043ac0`. Downloaded reference source files and `RE8_STM_Release.list` are in `tools/assets/`. The repository presents no root license; no general asset redistribution rights are inferred.
- TEX layout reference: [NSACloud/RE-Mesh-Editor](https://github.com/NSACloud/RE-Mesh-Editor), commit `622daa75b41ec622c3444ecb44ef31a651692687`. Upstream source and GPL-3.0 license are preserved in `tools/assets/`. These reference files are not imported by the pipeline or game.
- Environment already provides Python 3.13.7 and Pillow 11.3.0.
- `tools/assets/research_sources.json` records exact upstream URLs, commits, local filenames, SHA-256 hashes, and license findings. Pillow's license is retained as `tools/assets/Pillow-LICENSE.txt`. No new Python package or executable installation was needed.

## Delivered images and material recommendations

All images are RGB PNGs, 1024 x 1024, encoded as the source's sRGB color data. Use Three.js `SRGBColorSpace`, ordinary repeat wrapping, and modest anisotropy. They are color maps only: no normal/roughness/metalness texture is implied. Shader material values below are recommendations.

| File in assets/extracted | Appearance | Suggested use |
|---|---|---|
| shelf-wood.png | Clean warm brown wood grain | Bright floor, shelves, trim; roughness 0.65-0.85 |
| wall-plaster.png | Subtle off-white plaster | Cream/mint walls with color tint; roughness 0.95 |
| switch-metal.png | Cool pale scratched metal | Switch/exit hardware; metalness 0.65, roughness 0.55 |
| wood-floor.png | Weathered gray-brown wood planks | Corrupted floor or low-contrast trim; roughness 0.82 |
| worn-metal.png | Dark oxidized mottling | Corrupted switch/exit housing; metalness 0.3, roughness 0.9 |
| worn-concrete.png | Cracked pale flaking surface | Corrupted lower walls/accents; roughness 0.95 |

Runtime PNGs total **7,987,546 bytes** (7.99 MB). Six raw TEX inputs total **7,690,448 bytes**. Research references plus raw inputs and extraction code were about 17.62 MB at completion. The large game installations are not runtime dependencies and must not be copied into the playable game's backup.

Exact internal source paths, package offsets, archive header/index fingerprints, compressed-data hashes, TEX hashes, PNG hashes, dimensions, and review outcomes are in `assets/extracted/manifest.json`. Selected entries all live under the source path `natives/stm/streaming/materiallibrary/original/surface/`. That path is the game's folder label; it does not establish ownership or grant a separate redistribution license. Source graphics retain their original rights; no new asset license is asserted here.

## Reproduction and continuation on another account

From the project folder in PowerShell:

```powershell
python tools/assets/extract_surfaces.py
```

Requires the existing source Village package and Pillow. The game itself needs only the generated PNGs and manifest; extraction tools and original packages are not needed to play. Keep `assets/extracted/`, `ASSET_PROVENANCE.md`, and the game code together in portable backups. Keep `tools/assets/` too if continued extraction/research is desired.

Pipeline steps:

1. Read the 16-byte KPKA header and 48-byte-per-entry table; require version 4.0 and zero feature flags.
2. Resolve six fixed internal filenames with lower/upper UTF-16LE MurmurHash3 keys. Only those matching archive entries are read. Reject encrypted entries and entries above 64 MB.
3. Preserve selected raw TEX bytes, decompressing DEFLATE only where the archive flags require it; require exact decompressed length.
4. Parse TEX version 30, choose the existing full-resolution top mip, wrap its BC7/BC1 data in an in-memory DDS header, and decode using Pillow. Material-packed alpha is discarded; RGB values are otherwise retained without resizing, recoloring, synthesis, or upscaling.
5. Save PNGs and hashes. Recorded visual approval is preserved only for identical PNG hashes; changed output requires fresh inspection.

The initial successful samples were non-streaming 256 x 256 variants. They were superseded by actual streaming 1024 x 1024 source textures using the same final filenames. This was higher-resolution source extraction, not image upscaling.

## Verification performed

- PASS: All six internal hashes resolve to entries in the supplied Village base pack.
- PASS: All six extracted byte counts match archive declarations; two selected entries use DEFLATE, four are stored uncompressed.
- PASS: Five BC7 sRGB textures and one BC1 sRGB texture decode as expected.
- PASS: All six exported full-resolution PNGs inspected with `view_image`; recognizable material surfaces, no obvious block corruption or broken channels.
- PASS: Reproduction and hash/dimension validation performed; see `tools/assets/verification.json`.
- Pending integration: final material tiling, brightness, and GPU appearance in the actual game are owned by rendering/QA. These texture checks alone do not establish browser gameplay acceptance.
- Not attempted: RE7/Requiem extraction, models, soundtracks, DRM/encrypted archives, bulk unpack, or a general-purpose archive editor. The six relevant surfaces satisfy this asset milestone.

## First-person horror revision — four additional surfaces

The latest authorized revision in `HORROR_UPGRADE.md` requests an enclosed worn playroom, first-person textured hands/torch, and a cloth mascot. A bounded shortlist of ten low-resolution local previews was examined; four relevant existing source textures were chosen. There are no generated, painted, recolored, cropped, or upscaled replacement images. All four final files are actual existing top mips decoded to RGB PNG, with packed material alpha discarded as in the initial pipeline.

| New file in assets/extracted | Source dimensions | PNG bytes | Appearance and use |
|---|---:|---:|---|
| hand-skin.png | 2048 x 2048 | 3,432,181 | Genuine clean right-hand UV atlas with fingers, palms, nails, and wrist cuff; use suitable mesh UVs or the palm sampling guidance below |
| wall-tiles.png | 1024 x 1024 | 1,788,530 | Dirty beige ceramic tiles with dark seams and staining; lower wall/utility corner |
| mascot-fabric.png | 1024 x 1024 | 2,130,292 | Brown rough woven cloth with visible fibers; seated/chasing mascot |
| peeling-wall.png | 1024 x 1024 | 1,669,127 | Cracked pale paint exposing gray plaster; upper walls and ceiling detail |

Total extra runtime images: **9,020,130 bytes (9.02 MB)**, below the approximately 15 MB target. The combined ten runtime PNGs total **17,007,676 bytes (17.01 MB)**. No additional archive, executable, Python package, or web dependency was downloaded for this revision.

The exact source paths, package offsets, archive index/header fingerprint, extracted TEX hashes, PNG hashes, dimensions, material recommendations, and visual reviews are in `assets/extracted/horror-manifest.json`. The source remains the existing unencrypted Village base package. Original six exported files and `manifest.json` are hash-checked before/after extraction and are not rewritten by this new pipeline.

### Hand atlas limitation and renderer guidance

`hand-skin.png` is an anatomical UV atlas, **not a seamless skin tile**. Mapping the whole image over each sphere/cylinder would scatter fingernails, cuff, and background across the hand. For original primitive geometry, a clean palm region is approximately source image X=0.46–0.64 and Y=0.34–0.50 measured from the top. With Three.js's ordinary image texture orientation, a material region using `offset=(0.46,0.50)` and `repeat=(0.18,0.16)` samples that palm area. This is UV selection of the unmodified texture, not newly painted surface art. Proper anatomical matching to all atlas islands would require a compatible UV-mapped hand mesh, which was not extracted. Skin appearance on the actual first-person geometry remains a renderer/visual-QA check.

Use sRGB for all four color maps. Suggested roughness: skin 0.82, tiles 0.87, cloth 0.96, peeling paint 0.95; metalness zero. These are scalar material recommendations, not extracted normal/roughness maps.

### Repeat or continue the new extraction

```powershell
python tools/assets/extract_horror_surfaces.py
```

The new script imports the proven parser/decoder from `extract_surfaces.py` but never calls its original six-image export. New raw inputs are in `tools/assets/horror-raw/`. Bounded shortlist previews are in `tools/assets/horror-review/` for research only, not runtime. Hash-keyed full-resolution review records are in `tools/assets/horror-visual-review.json`.

Verification completed: all four selected names resolve; lengths match archive entries; all four full-resolution PNGs decode and were visually inspected; regenerating produces byte-identical PNGs and manifest; all six original PNG hashes and original manifest hash remain unchanged. Machine-readable evidence: `tools/assets/horror-verification.json`. Rendering specialist has exact filenames and hand UV guidance. New first-person in-game placement/lighting remains pending renderer integration and actual browser inspection; asset extraction alone does not establish those visual checks.
