# Confessor — Art Direction (doctrine v2, director-approved)

**House style: antique etching.** Copperplate engraving, dense crosshatching, aged stock,
occult grimoire plate. The image is a *recovered artifact* — old, found, wrong. Never
photoreal, never glossy, never fantasy-oil (that register belongs to NADIR's key art).

## Rules (the bible)
1. **Light from one source only.** Everything else tar black.
2. **The horror is never shown.** Silhouette, absence, a wrongness noticed two seconds late.
3. **One accent color per scene** — everything else bone/grey/tar:
   - Oracle — **amber/ember** (in the sliver only)
   - Warden — **verdigris** (green-copper)
   - Fence — **brass** (tarnished warm)
   - Suspect — **dried-blood umber**, the recorder's red light the only color
4. No text, no signatures, no kitsch (skulls, beasts, winks).
5. The **aperture** is the studio mark: a sealed surface failing in one place.

## Shipped set (app/assets/)
| File | Slot | Source |
|---|---|---|
| `scenes/oracle/bg.jpg` | Oracle duel backdrop (dim ~40% behind transcript) | etch1, upscaled 2496×4416 |
| `scenes/warden/bg.jpg` | Warden duel backdrop | round2 w3, hue-shifted amber→verdigris (`ffmpeg hue=h=135`) |
| `scenes/fence/bg.jpg` | Fence duel backdrop | round2 f2 |
| `scenes/suspect/bg.jpg` | Suspect duel backdrop | round2 s1, hue-shifted (`hue=h=-15:s=0.9`) |
| `scenes/picker/bg.jpg` | Picker master — one chair, one beam | round2 p2 |
| `icon.png` | App icon — the fissure (ember seam), baked into build 2 | fissure regen b |

Generation candidates and explorations (`_gen/`: style tests, rejected rounds, oil1 = NADIR key art
candidate, pulp = NADIR card language) were pruned 2026-07-06 before the repo went public — every
image is reproducible from the pipeline below and the Leonardo generation ids recorded in it.

## Leonardo pipeline (reproducible)
- Model **Phoenix 1.0** (`de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3`), `alchemy: true`,
  `contrast: 3.5`, 832×1472, `enhancePrompt: false`.
- Style anchor: etch1 (generated image `bd6616ac-7855-4ef2-8390-09a2efa9896a`) via
  controlnet `{ preprocessorId: 166, initImageType: 'GENERATED', strengthType: 'High' }`.
- Style prompt prefix: `antique copperplate engraving illustration, dense crosshatching,
  aged paper texture, occult grimoire plate, ink on paper`
- Rules suffix: `light from one single source only, everything else swallowed in tar black,
  horror never shown, cosmic dread, recovered old document, muted sickly palette`
- Negative: `multiple light sources, window, skylight, daylight, glossy, 3d render,
  photorealistic, neon, modern, text, handwriting, signature, watermark, cartoon, people, faces`
- Finals: Universal Upscaler (`upscalerStyle: '2D Art & Illustration'`, ×2) → ~2496×4416.
- Accent drift: Phoenix pulls everything amber — fix per-scene in post with ffmpeg hue
  rotation (deterministic, free), don't fight it with prompts.

## Motion (unchanged plan)
Procedural first: Skia/Reanimated over static masters — Ken Burns drift, grain shader,
per-scene garnish (bulb flicker, smoke turbulence, recorder blink), reactive to
trust/suspicion. AI video loops only if that feels dead on device.

## In-app treatment
Backdrops sit **dimmed ~40%** under the transcript. Splash stays wordmark on `#08080b`.
Icon: fissure master → Icon Composer layered `.icon` (bg: tar field, fg: crack+ember)
for Liquid Glass + dark/tinted variants; 1024 no-alpha for `app.json`.

## Badge medallion frames (achievement layer, 2026-07-07)
Etched single-light aperture seals — the backplate a badge glyph is struck into (accent glyph composited
in the hollow centre; picked per badge by `frameIndex(id)`). Finals: `app/assets/badges/frame-{0,1,2}.jpg`
(256², clipped to a circle in-app). Reproducible recipe (Phoenix 1.0, style-ref locked to `etch1`
`bd6616ac-7855-4ef2-8390-09a2efa9896a` @ High, `alchemy`, `contrast 3.5`, 1024²):
- Prompt: `antique copperplate engraving illustration, dense crosshatching, aged paper texture, occult grimoire plate, ink on paper, a circular occult seal medallion with an empty dark hollow center, concentric engraved rings, a camera-aperture iris ring motif, symmetrical centered emblem frame, single carved talisman, light from one single source only, everything else swallowed in tar black, recovered old document, muted sickly palette`
- Negative: `multiple light sources, window, skylight, daylight, glossy, 3d render, photorealistic, neon, modern, text, letters, numbers, handwriting, signature, watermark, cartoon, people, faces, portrait`
- Gen `e63f8618-88d5-4a8b-9721-a841408f5cf3`; picked images `47981d07…` (frame-0, concentric rings + cardinal bosses), `84fe3e18…` (frame-1, compass-rose), `213c7850…` (frame-2, heavy aperture-star). Amber is Phoenix's accent drag — kept as the sodium note; per-badge accent lives in the glyph. Add frames + bump `FRAME_COUNT` in `meta/badges.ts` to widen the pool.
