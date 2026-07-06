// The bond ladder — the in-duel "how close am I" made legible (gamification spec 2026-07-06).
// Pure derivations over the engine's hidden scores; thresholds mirror prompt.ts describeBond so the
// words the PLAYER sees and the bond the MODEL is told never disagree.

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

/** One quiet verdict per turn. Trust movement outranks suspicion movement. */
export function shiftPulse(
  prev: { trust: number; suspicion: number },
  next: { trust: number; suspicion: number },
  pronoun: string,
): string {
  if (next.trust > prev.trust) return `reached ${pronoun}`;
  if (next.suspicion > prev.suspicion) return `hardened ${pronoun}`;
  return 'unmoved';
}

/** Did trust climb into a NEW ladder state this turn? (Downward moves never announce.) */
export function bondCrossedUp(prevTrust: number, nextTrust: number, winTrust: number): boolean {
  if (nextTrust <= prevTrust) return false;
  return bondState(nextTrust, winTrust) !== bondState(prevTrust, winTrust);
}
