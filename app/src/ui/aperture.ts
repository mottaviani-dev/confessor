// THE STUDIO APERTURE — Somnia's connective mark, rendered in the app (bible §5: "a black aperture — a
// perfect vertical sliver of void inside a thin double-line frame ... every future Somnia game must
// contain one black opening you never pass through. Splash screen: ... the model-load progress bar is the
// sliver slowly widening"). This is the studio identity's flagship in-app moment and the least-moved axis
// in the game's history — until now the first-launch download rendered a generic green ActivityIndicator,
// i.e. exactly the floating game-chrome §5 forbids. Here the PROGRESS *is* the door coming ajar: the mind
// is being REMEMBERED onto the device (Principle 6 — the thing lives in your phone, nothing leaves), and
// the void widens as it arrives. Never a full opening — it stays a sliver you never pass through (§5).
//
// Pure spec here (the geometry); StudioAperture.tsx composes it into layered Views. The app bundles
// neither SVG nor gradient (see roomBackdrop.ts), so the mark is built from Views alone and renders
// identically on the web export the visual-truth harness shoots AND on device. Kept split exactly like
// roomBackdrop (the layer math) vs SceneBackdrop (the renderer), so the geometry is unit-testable with no
// renderer in the loop.

/** Studio palette (§2/§5: "bone, tar, sodium-lamp amber ... amber only for the sliver"). */
export const APERTURE_TAR = '#08080b'; // the ground the frame sits on — the studio base
export const APERTURE_BONE = '#c9c3b0'; // the thin double-line frame (a mimeograph-stamp bone)
export const APERTURE_DOOR = '#17171d'; // the door leaves — plaster in shadow, a hair off the void
export const APERTURE_VOID = '#000000'; // pure black behind the door (§2: "a sliver of pure black")
export const APERTURE_AMBER = '#d9932f'; // the sodium light leaking from the sliver — the ONLY colour (§2)

/** The sliver at rest (indeterminate phases: waking / verifying) — a door barely ajar, no number to show. */
export const SLIVER_REST = 0.06;
/** The sliver at full progress — the widest the void ever reads. Deliberately still a SLIVER, never the
 *  whole opening: §5 "one black opening you never pass through." */
export const SLIVER_MAX = 0.34;

/** One vertical rule of the double-line frame. */
export interface ApertureFrame {
  readonly color: string;
  readonly widthPx: number;
  /** The gap between the outer and inner rule (the mimeograph double-line). */
  readonly gapPx: number;
}

/** The amber light leaking at each vertical edge of the sliver — the only colour on the mark (§2). Null
 *  when the load has FAILED: the light behind the door is out. */
export interface ApertureLeak {
  readonly color: string;
  readonly widthPx: number;
  readonly opacity: number;
}

export interface ApertureSpec {
  readonly base: string;
  readonly door: string;
  readonly frame: ApertureFrame;
  /** The void sliver as a FRACTION of the aperture's inner width (the component multiplies by its box). */
  readonly sliver: { readonly widthFactor: number; readonly color: string };
  readonly leak: ApertureLeak | null;
}

/**
 * Build the aperture for a load progress in [0,1], or `null` for an indeterminate phase (rests barely
 * ajar). A failed load passes `lit = false` → no amber (the light behind the door is out). Pure +
 * deterministic: the sliver widens MONOTONICALLY with progress from SLIVER_REST to SLIVER_MAX, clamped,
 * and the amber leak brightens as the door opens.
 */
export function apertureSpec(progress: number | null, lit = true): ApertureSpec {
  const p = progress === null ? null : Math.max(0, Math.min(1, progress));
  const widthFactor = p === null ? SLIVER_REST : SLIVER_REST + p * (SLIVER_MAX - SLIVER_REST);
  return {
    base: APERTURE_TAR,
    door: APERTURE_DOOR,
    frame: { color: APERTURE_BONE, widthPx: 1, gapPx: 3 },
    sliver: { widthFactor, color: APERTURE_VOID },
    leak: lit ? { color: APERTURE_AMBER, widthPx: 2, opacity: p === null ? 0.5 : 0.35 + p * 0.4 } : null,
  };
}
