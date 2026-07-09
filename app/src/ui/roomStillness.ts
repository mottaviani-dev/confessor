// THE ROOM'S REFUSAL ESCALATES — the curdling half of the positive-beat requirement (mandate; deepens the
// just-shipped `roomStill` beat so the room's silence is ALIVE, not one canned sentence fired verbatim every
// filler turn). The engine raises `roomStill` when a turn produced NEITHER a give NOR pressure and carries a
// `fillerStreak` counter (consecutive filler turns, reset the instant the room moves). This is the display
// half: it maps that streak DEPTH to a room-voice line that CURDLES — patience thinning, the air hardening,
// the refusal gaining teeth — the way a real interrogator's silence forces a suspect to fill it, never the
// same sentence twice running.
//
// DOCTRINE — code-owned ROOM-voice, NO model call (mirrors roomInterjection.ts): a pure, deterministic
// read of an engine counter, so it is (a) doctrine-clean without a seam cert, (b) dump-visible headless,
// (c) unit-testable. §5: diegetic paper, the room's own register — never a HUD, never a taunt or a jump
// (§1/§3 restraint): the room WITHDRAWS from a seeker who spends nothing, it does not mock or lunge. The
// register hardens by band and NEVER repeats verbatim across consecutive filler turns (the canned-wrapper
// tedium that once killed the seam scaffolds — SHIPPED "canned wrapper killed").
//
// BALANCE-SAFE / DISPLAY-ONLY: read straight off the engine's `fillerStreak`, which is 0/0 by
// APPROACH_EFFECTS (filler moves no score) — this only chooses WHICH refusal line the room shows, it never
// touches trust/suspicion, the manip wall, or the offer/probe win paths.

/** The escalation ladder, three registers deep. Ordered from the room merely holding still to the room
 *  actively withdrawing from a seeker who spends nothing. Room-voice, curdling, restraint-holding — no
 *  taunt, no exclamation, no purple. To deepen a band, edit its line(s); the `cold` tier is a small SET
 *  cycled by depth so a sustained flood reads distinct turn after turn (no consecutive verbatim repeat). */
export const ROOM_STILL_LADDER = {
  /** Streak 1 — the room simply does not move (the base beat, continuous with the shipped one-liner). */
  opening:
    'The room does not move. It waits for you to spend something — a real question, or a piece of yourself.',
  /** Streak 2 — patience thinning, the air going close: the refusal starting to harden. */
  thinning:
    'Still the room gives you nothing back. Its patience is thinning now, the air gone close and hard around the chair.',
  /** Streak 3+ — cold and final, the room withdrawing from a seeker who keeps spending nothing. Cycled by
   *  depth (streak - 3) so consecutive deep-filler turns never repeat the same sentence. */
  cold: [
    'The room has stopped waiting for you. It only counts the hour you are letting fall through your hands.',
    'The room draws further back. A seeker who offers nothing is met with nothing, and the quiet closes in.',
    'The room has gone cold to you. It will not spend what you will not — and the silence hardens another degree.',
  ],
} as const;

/**
 * The room-voice refusal line for a given filler streak (1-based; the engine's `fillerStreak` on a filler
 * turn is ≥ 1). Pure + deterministic: streak 1 → the room holds still; streak 2 → its patience thins;
 * streak 3+ → the cold, withdrawing register, CYCLED through `cold` by depth so no two consecutive filler
 * turns render the same sentence. A non-positive/NaN streak is treated as the opening beat (defensive; the
 * UI only calls this when `roomStill` is set, i.e. streak ≥ 1).
 */
export function roomStillLine(streak: number): string {
  const s = Number.isFinite(streak) ? Math.floor(streak) : 1;
  if (s <= 1) return ROOM_STILL_LADDER.opening;
  if (s === 2) return ROOM_STILL_LADDER.thinning;
  const cold = ROOM_STILL_LADDER.cold;
  return cold[(s - 3) % cold.length];
}

/** The doctrine bar for the whole ladder, exposed for the test (and any future caller): every line holds
 *  restraint (no exclamation, no purple/Mythos word) — the room curdles, it never taunts or lunges. Kept
 *  here so the contract lives next to the lines it guards (mirrors roomInterjectionDoctrineClean). */
export function roomStillDoctrineClean(): boolean {
  const all = [ROOM_STILL_LADDER.opening, ROOM_STILL_LADDER.thinning, ...ROOM_STILL_LADDER.cold];
  return all.every((line) => !line.includes('!') && !PURPLE.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(line)));
}

// Local mirror of the doctrine purple set (kept tiny + inline to avoid an engine import cycle from the UI
// layer; the authoritative list is engine/personaCoherence.DOCTRINE_PURPLE — the test cross-checks it).
const PURPLE: readonly string[] = ['eldritch', 'cyclopean', 'unspeakable', 'indescribable', 'unfathomable', 'ineffable'];
