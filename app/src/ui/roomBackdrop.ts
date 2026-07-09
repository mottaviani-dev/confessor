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

/** One concentric halo of the hanging bulb's glow — a soft disc, sized as a MULTIPLE of the viewport width
 *  (the component multiplies by the live width) so the bulb scales to any screen. Outer halos are wide +
 *  faint, inner ones tight + bright: the falloff of a single light with no gradient primitive. */
export interface BackdropHalo {
  /** Diameter as a fraction/multiple of the viewport width (e.g. 2.4 = 2.4× wide, 0.42 = under half). */
  readonly sizeFactor: number;
  readonly color: string;
  readonly opacity: number;
}

/** The full procedural room: a tar floor, a faint full-frame accent VEIL (so the WHOLE room reads in the
 *  mind's hue, not just the bulb), and the concentric bulb halos above it. */
export interface RoomBackdropSpec {
  readonly base: string;
  /** A dim full-frame wash in the room accent — the veil that colours the whole chamber (kept sparing, §2). */
  readonly veil: { readonly color: string; readonly opacity: number };
  /** The hanging bulb, as concentric halos ordered OUTER→INNER (wide+faint first, tight+bright last). */
  readonly halos: readonly BackdropHalo[];
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
    veil: { color: accent, opacity: 0.07 },
    halos: [
      { sizeFactor: 2.4, color: accent, opacity: 0.1 },
      { sizeFactor: 1.5, color: glow, opacity: 0.16 },
      { sizeFactor: 0.85, color: glow, opacity: 0.24 },
      { sizeFactor: 0.42, color: bright, opacity: 0.32 },
    ],
  };
}
