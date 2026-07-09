// THE ROOM WITHDRAWS ITS SENSES — the bigger swing on the SAME filler streak (mandate #2; the more
// ambitious form of the refusal-escalation beat). The room just gained MOTION (the bulb sways on composure
// break) and per-mind AUDIO (an instrument detuning under the bed). On a SUSTAINED filler streak — a seeker
// who keeps spending nothing — the room pulls those senses AWAY: the bulb-sway STILLS (the room goes
// physically inert, Principle 4 — the system itself changes), and the instrument thins toward the bare bed.
// The player FEELS the room disengage across sight + sound at once, not just read the refusal line.
//
// SINGLE SOURCE OF TRUTH: driven off the engine's `fillerStreak` (the SAME counter the room-voice ladder
// reads — ui/roomStillness), never a new track. Bounded, STEPPED, deterministic (NO Math.random), and it
// reverses INSTANTLY on the next positive beat (the engine resets fillerStreak to 0 → withdrawal 0). §1/§3
// restraint: a room going STILL and QUIET is WITHDRAWAL, not a scare — never jitter, never a stinger; the
// room gives LESS, it never lunges. DISPLAY/PRESENTATION-LAYER ONLY: it reads an already-scored counter and
// touches neither the score nor the manip wall (filler is 0/0 by APPROACH_EFFECTS).

/** The filler-streak depth at which the room is FULLY withdrawn — the bulb hangs inert and the instrument
 *  is pulled to the bare bed. Aligned with the room-voice ladder's cold tier (streak ≥ 3): the withdrawal
 *  BEGINS as the refusal goes cold and completes one turn deeper, so the senses pull away in felt steps. */
export const FULLY_WITHDRAWN_STREAK = 4;

/**
 * The room's WITHDRAWAL level for a filler streak: 0 (engaged — senses fully present) → 1 (fully withdrawn —
 * bulb inert, instrument pulled to the bare bed). Pure + deterministic, STEPPED into felt bands (never a
 * smooth creep): the room stays engaged while the seeker is spending something, then — as the refusal goes
 * cold (streak 3) — its senses begin to pull away (half), and one turn deeper (streak ≥ 4) it disengages
 * fully. A non-positive / non-finite streak is treated as engaged (0). Reverses to 0 the instant the streak
 * resets (a positive beat), so the room re-engages immediately.
 */
export function roomWithdrawal(fillerStreak: number): number {
  const s = Number.isFinite(fillerStreak) ? Math.floor(fillerStreak) : 0;
  if (s < 3) return 0; // engaged — the seeker is still spending something (or was, last turn)
  if (s < FULLY_WITHDRAWN_STREAK) return 0.5; // the senses begin to pull away as the refusal goes cold
  return 1; // sustained filler — the room is fully withdrawn (bulb inert, instrument thinned to the bed)
}

/** True once the room is FULLY withdrawn — the discrete cutoff the audio director reads to PULL the
 *  instrument (thin to the bare bed). Kept here (next to the level it derives from) so the sight and sound
 *  halves share one source; the bulb uses the continuous `roomWithdrawal` level for a stepped stilling,
 *  while the instrument is a clean on/off (a looping track has no gain lever in the port — dropping it IS
 *  the thinning). Reverses instantly with the streak. */
export function isRoomFullyWithdrawn(fillerStreak: number): boolean {
  return roomWithdrawal(fillerStreak) >= 1;
}
