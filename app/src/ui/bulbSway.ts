// THE BULB SWAYS — the room's ONE motion (bible §2 art direction: "Motion: almost none; the bulb sways
// ~2px when Composure breaks"). This is the sensory TWIN of the audio detune (director.ts): the room's
// break is already HEARD (the bed + instrument sag as composure falls) and READ (the Grip corruption
// text), but never SEEN — the single hanging bulb, the whole chiaroscuro, has hung dead still. When a
// mind's composure snaps the bulb (and the halos + lit-plaster pool it casts) drifts, so the light itself
// moves — the room physically flinching WITH the mind (Principle 4: the descent felt through systems).
//
// This module is the PURE half (the composure→deflection mapping), unit-testable with no renderer;
// SceneBackdrop.tsx composes it into an Animated translate. Kept separate exactly like roomBackdrop vs its
// component, and personaCoherence vs the components that read it.
//
// SINGLE SOURCE OF TRUTH (mandate done-to-bar): the sway is driven off the SAME composure signal the
// AudioDirector detune reads — `composureBreak` below is that signal, and App wires BOTH the audio
// (setComposure) and the bulb off this one function, so there is no parallel state. The bulb reacts to
// composure ONLY — never Grip, never UI chrome (that would make it a HUD, §5): it is the ROOM reacting.

import type { GameState, Scenario } from '../engine/types';

/** The peak sway at a full composure break — the bible's "~2px". A hard ceiling on the amplitude: the
 *  deflection escalates toward this in felt steps and never past it, so the motion stays "almost none"
 *  (§3 restraint) — a slow pendulum drift, never a jitter or a jump-scare (§1). */
export const MAX_SWAY_PX = 2;

/** clamp to [0,1], treating a non-finite input as 0 (calm). */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/** THE COMPOSURE-BREAK SIGNAL — 0 (calm) → 1 (the séance fully unravelled). The room comes apart whether
 *  THEIR composure cracks (trust climbing toward the win) OR YOUR grip slips (suspicion climbing toward the
 *  lock-out), whichever is further gone — the exact reading App.tsx feeds `AudioDirector.setComposure`, so
 *  the bulb sways in lock-step with the bed detune off ONE source of truth (no parallel track). Pure read
 *  of the engine's own meters against the scenario thresholds; clamped so a win turn (trust ≥ winTrust)
 *  cannot push it past 1. */
export function composureBreak(scenario: Scenario, state: GameState): number {
  const their = scenario.winTrust > 0 ? state.trust / scenario.winTrust : 0;
  const yours = scenario.loseSuspicion > 0 ? state.suspicion / scenario.loseSuspicion : 0;
  return clamp01(Math.max(their, yours));
}

/** THE COMPOSURE → SWAY-AMPLITUDE mapping (pure, deterministic — NO Math.random). Returns the peak
 *  horizontal deflection in px for a composure level. STEPPED into felt bands rather than a smooth ramp,
 *  so the descent escalates in discrete STEPS the player can feel (the bible's "when Composure breaks",
 *  not a continuous creep): the room hangs still while a duel is composed, then the pendulum widens in
 *  three stages toward the ~2px break. Monotonic non-decreasing and bounded by MAX_SWAY_PX by
 *  construction. The animation's PHASE runs on a clock (a slow pendulum), but its AMPLITUDE/onset is this
 *  composure-driven, reproducible value — so a given composure always deflects the same. */
export function swayAmplitude(composure: number): number {
  const c = clamp01(composure);
  if (c < 0.34) return 0; // composed — the bulb hangs dead still (a calm duel has no tell)
  if (c < 0.6) return 0.7; // the first felt drift, well under the ceiling
  if (c < 0.85) return 1.3; // the pendulum widens as the mind gives
  return MAX_SWAY_PX; // the break — the room flinches its full ~2px
}
