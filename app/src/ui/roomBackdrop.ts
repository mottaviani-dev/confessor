// PROCEDURAL ROOM BACKDROP — the fifth door, painted-in-interim (director mandate #3; bible §2 art
// direction). The four elder minds each own a hand-etched master (assets/scenes/<id>/bg.jpg); the Prior
// Occupant (occupant.ts) shipped with only her ash-violet accent and fell back to the PICKER backdrop — so
// alone among the five her room looked like the roster, not a duel chamber. A finished painted room is a
// Matteo/asset gate; this is the honest procedural stand-in so the fifth scenario ships at PARITY now: a
// code-composed chiaroscuro keyed to the scenario accent — one hanging bulb over a tar floor, the accent
// used sparingly per §2 (one accent per room), the light falling from the top and the room going dark
// below. No image asset, no gradient/SVG dependency (this app bundles neither) — layered Views only, so it
// renders identically on the web export the visual-truth harness shoots AND on device.
//
// This module is the PURE half (the layer math), unit-testable with no renderer; RoomBackdrop.tsx composes
// the spec into Views. Kept separate exactly like personaCoherence vs the components that read it.

/** The near-black tar floor every room sits on — the studio base (§2 "bone, tar, sodium-lamp amber"). Held
 *  here (not imported from App's styles) so the spec is self-contained and testable. */
export const TAR = '#08080b';

/** The occupant's mass — DARKER than the tar floor so the seated figure reads as a solid silhouette
 *  occluding the bulb's glow, not a shape lit against it (§2 "a half-lit silhouette whose face is never
 *  resolved"). A hair of warmth over pure black so a faint glow still bleeds the near edge. */
export const SILHOUETTE = '#020204';

/** One concentric halo of the hanging bulb's glow — a soft disc, sized as a MULTIPLE of the viewport width
 *  (the component multiplies by the live width) so the bulb scales to any screen. Outer halos are wide +
 *  faint, inner ones tight + bright: the falloff of a single light with no gradient primitive. */
export interface BackdropHalo {
  /** Diameter as a fraction/multiple of the viewport width (e.g. 2.4 = 2.4× wide, 0.42 = under half). */
  readonly sizeFactor: number;
  readonly color: string;
  readonly opacity: number;
}

/** One layered piece of the seated occupant — a rounded View, centred, anchored to the container BOTTOM
 *  (the figure rises out of the dark floor). All sizes are fractions of the viewport WIDTH so the whole
 *  figure scales with the screen keeping its proportion; the component multiplies by the live width. */
export interface FigurePart {
  /** Width as a fraction of the viewport width. */
  readonly widthFactor: number;
  /** Height as a fraction of the viewport WIDTH (not height — keeps the figure's proportion device-agnostic). */
  readonly heightFactor: number;
  /** The part's BOTTOM edge, as a fraction of the viewport width offset up from the container bottom. */
  readonly bottomFactor: number;
  /** borderRadius as a fraction of the part's own width (0.5 = a full dome/disc). */
  readonly radiusFactor: number;
  readonly color: string;
  readonly opacity: number;
}

/** The full procedural room: a tar floor, a faint full-frame accent VEIL (so the WHOLE room reads in the
 *  mind's hue, not just the bulb), the concentric bulb halos above it, and the seated occupant below. */
export interface RoomBackdropSpec {
  readonly base: string;
  /** A dim full-frame wash in the room accent — the veil that colours the whole chamber (kept sparing, §2). */
  readonly veil: { readonly color: string; readonly opacity: number };
  /** The hanging bulb, as concentric halos ordered OUTER→INNER (wide+faint first, tight+bright last). */
  readonly halos: readonly BackdropHalo[];
  /** The seated occupant — a half-lit silhouette below the bulb (§2). Ordered BACK→FRONT: the accent rim
   *  aura first, then the dark head + shoulders drawn over it, so a thin lit edge survives at the crown and
   *  near shoulders (the overhead bulb catching the near edge) while the face stays lost to the down-shadow. */
  readonly figure: readonly FigurePart[];
}

/**
 * The seated occupant, built from the room accent (pure + deterministic). The chair below the bulb is not
 * empty: a half-lit silhouette rises from the dark floor, its crown + near shoulders grazed by the overhead
 * light (a faint accent rim), its face never resolved — no features are ever drawn, the head is a featureless
 * dark disc and everything below the brow is pure down-shadow (Principle 3 restraint; §2 "a half-lit
 * silhouette whose face is never resolved"). Three layers only: the accent rim aura (drawn first, behind),
 * then the dark shoulders + head over it (occluding the aura so only a thin lit edge survives).
 */
export function roomFigure(accent: string): readonly FigurePart[] {
  const rim = lighten(accent, 0.5); // the bulb light wrapping the near edge — the accent lifted, never white
  return [
    // The rim aura — a soft accent dome behind the whole upper body; the dark masses draw over it, leaving a
    // thin lit edge at the crown + shoulders (a rim-lit silhouette, the light coming from the bulb above). It
    // reaches ABOVE the raised head (heightFactor > head top) so the crown keeps its grazed accent edge.
    { widthFactor: 0.66, heightFactor: 0.6, bottomFactor: 0, radiusFactor: 0.5, color: rim, opacity: 0.15 },
    // The shoulders — a broad rounded-top dark mass rising from the floor, occluding the bulb's glow pool.
    { widthFactor: 0.6, heightFactor: 0.44, bottomFactor: 0, radiusFactor: 0.5, color: SILHOUETTE, opacity: 0.97 },
    // The head — a featureless dark disc PERCHED on the shoulders: its base overlaps the shoulder crown
    // (0.38 < shoulders' 0.44) so it reads as attached, and most of it rises clear (top 0.565 vs the 0.44
    // shoulder line) so the silhouette reads as head-on-shoulders, not a heap. No face, no eyes (§2 / P3).
    { widthFactor: 0.185, heightFactor: 0.185, bottomFactor: 0.38, radiusFactor: 0.5, color: SILHOUETTE, opacity: 0.97 },
  ];
}

/** Mix a #rrggbb toward white by `amt` in [0,1] — the lit plaster near the bulb is the room accent pushed
 *  toward bone, never a flat white (keeps the single accent reading, §2). Pure; returns a 6-digit hex. */
export function lighten(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const clampAmt = Math.max(0, Math.min(1, amt));
  const mix = (c: number) => Math.round(c + (255 - c) * clampAmt);
  const h = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Build the procedural room for a scenario accent (pure + deterministic). The accent itself carries the
 * light — the veil + the wide outer halos are the raw accent (sparing, dim), the tight inner halos are the
 * accent lifted toward bone (the plaster right under the bulb). Opacity RISES as the halo tightens, so the
 * bulb reads as one bright source falling off into the dark: chiaroscuro from code, matched to the four
 * painted siblings' grammar (one hanging bulb, tar ground, one accent per room).
 */
export function proceduralRoom(accent: string): RoomBackdropSpec {
  const glow = lighten(accent, 0.42); // the lit plaster ring
  const bright = lighten(accent, 0.72); // the filament's near-bone core
  return {
    base: TAR,
    // The veil carries the mind's HUE across the whole chamber. Kept sparing (§2) but strong enough to READ
    // over the near-black tar — at 0.07 the desaturated ash-violet vanished and the fifth room looked like a
    // generic grey box (visual-truth room-occupant); at 0.13 the accent tints the chamber without flooding it.
    veil: { color: accent, opacity: 0.13 },
    halos: [
      { sizeFactor: 2.4, color: accent, opacity: 0.14 },
      { sizeFactor: 1.5, color: glow, opacity: 0.16 },
      { sizeFactor: 0.85, color: glow, opacity: 0.24 },
      { sizeFactor: 0.42, color: bright, opacity: 0.32 },
    ],
    figure: roomFigure(accent),
  };
}
