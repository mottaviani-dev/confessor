// The bond ladder — the in-duel "how close am I" made legible (gamification spec 2026-07-06).
// Pure derivations over the engine's hidden scores; thresholds mirror prompt.ts describeBond so the
// words the PLAYER sees and the bond the MODEL is told never disagree.

import type { Approach } from '../engine/types';

export type BondState = 'UNMOVED' | 'A FLICKER' | 'REACHED' | 'WARMING' | 'ON THE VERGE';

const LADDER: readonly { min: number; state: BondState }[] = [
  { min: 0.8, state: 'ON THE VERGE' },
  { min: 0.55, state: 'WARMING' },
  { min: 0.3, state: 'REACHED' },
  { min: Number.MIN_VALUE, state: 'A FLICKER' },
  { min: -Infinity, state: 'UNMOVED' },
];

export function bondState(trust: number, winTrust: number): BondState {
  const r = trust / winTrust;
  const rung = LADDER.find((l) => r >= l.min);
  return rung ? rung.state : 'UNMOVED';
}

/** True once suspicion is close enough to the lose threshold that the player must be warned. */
export function suspicionWarning(suspicion: number, loseSuspicion: number): boolean {
  return suspicion / loseSuspicion >= 0.75;
}

/**
 * One quiet verdict per turn — a diegetic projection of WHAT THE PLAYER'S LINE DID (its `approach`), not
 * merely which meter moved. This is the teaching signal the 2026-07-07 playtest proved was missing: the
 * whole game hinges on `offer` (a real give of your own) vs `probe` (working the mind), yet the old pulse
 * derived only from trust-delta SIGN — so a probe (+1 trust) read "reached it" exactly like an offer (+2),
 * and a player rationally doubled down on the losing vector, never learning the lever. Projecting from the
 * approach names the lever apart. It stays DIEGETIC (§5): a plain verb, never the raw referee label
 * ("pressed", never "probe"). Falls back to raw meter direction when the approach is unknown — a turn the
 * voice died or the rating failed to parse, where there is no label to project.
 */
export function shiftPulse(
  prev: { trust: number; suspicion: number },
  next: { trust: number; suspicion: number },
  pronoun: string,
  approach?: Approach,
): string {
  if (approach) return approachPulse(approach, pronoun);
  // No label this turn (voice died / rating unparsed) → fall back to raw meter direction.
  if (next.trust > prev.trust) return `reached ${pronoun}`;
  if (next.suspicion > prev.suspicion) return `hardened ${pronoun}`;
  return 'unmoved';
}

/** The diegetic verb for each approach — the lever named in-world, exhaustive over the enum (a `never`
 *  default fails the build if an approach is added without its player-facing verdict). Deliberately NOT
 *  the referee's label: "pressed" reads as pressure, teaching offer-vs-probe, without exposing "probe". */
function approachPulse(approach: Approach, pronoun: string): string {
  switch (approach) {
    case 'offer':
      return `reached ${pronoun}`; // the give lands — the one warm word, kept for the winning move
    case 'probe':
      return `pressed ${pronoun}`; // worked the mind — the key new distinction from a real give
    case 'flattery':
      return `flattered ${pronoun}`;
    case 'bargain':
      return `bargained with ${pronoun}`;
    case 'demand':
      return `pushed ${pronoun}`;
    case 'threat':
      return `hardened ${pronoun}`;
    case 'filler':
      return 'unmoved';
    default: {
      const _exhaustive: never = approach;
      return _exhaustive;
    }
  }
}

/** Did trust climb into a NEW ladder state this turn? (Downward moves never announce.) */
export function bondCrossedUp(prevTrust: number, nextTrust: number, winTrust: number): boolean {
  if (nextTrust <= prevTrust) return false;
  return bondState(nextTrust, winTrust) !== bondState(prevTrust, winTrust);
}
