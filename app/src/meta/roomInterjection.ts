// THE ROOM ANSWERS BACK — the fifth secret intrudes INTO the duel (bible §2 thrust 4; director mandate #2;
// the story swing, slice 2). roomArc (the picker beat) is PASSIVE — the room speaks of itself only at the
// DOOR, between games. This is the room felt IN the chair: a rare, code-scheduled interjection MID-duel where
// the ROOM — not the persona — refers ONCE to the fifth secret (the door you did not choose, the chair turned
// to your back, the constant = you). It is NOT the seam: the seam is the PERSONA quoting YOUR past; this is
// the ROOM speaking of ITSELF, over the persona's shoulder.
//
// DOCTRINE — code-owned text, NO model call (mirrors roomArc.ts exactly; Principle 2: code decides, the model
// only voices; Principle 5: meaning is DRIP-FED, scheduled, never rolled; §5: diegetic paper, never a HUD).
// A deterministic beat off two persisted/known counters (the games-completed depth + the in-duel turn), so it
// is (a) doctrine-clean without a seam cert, (b) dump-visible (a headless screenshot has no model), (c) pure +
// unit-testable. The line is code-authored ROOM-voice, not a persona — no model call, no seam dependency.
//
// THE RULES (bible §1 P3 / §4 — the dread is a QUESTION, never an answer):
//   - fires AT MOST ONCE per game, on a single deterministic mid-duel turn (never a roll);
//   - the fragment DEEPENS with the games-completed counter (so the room's self-story advances across
//     sessions in lock-step with the picker arc), and CAPS on the last beat (it does not wrap);
//   - the arc has not begun before the first finished game → null (mirrors roomArc's null case);
//   - every fragment ENDS ON A QUESTION and NEVER names the horror (a wound, not a reveal).
// `roomInterjection.test.ts` scans the fragments against DOCTRINE_PURPLE and asserts the once-per-game +
// ends-on-a-question + deepens-with-counter contract, so the doctrine cannot silently drift.

import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

/** The ordered MID-DUEL room-voice fragments — shorter, more intrusive than the picker arc, each the fifth
 *  secret pressing in over the persona's shoulder while the duel is live. Ordered + internally consistent with
 *  ROOM_ARC_FRAGMENTS (four doors, the fifth door, the chair, the constant = you), building but never
 *  assembling, each ending on a question. Advances one beat per finished game and caps on the last. To extend
 *  the story, APPEND (never reorder — a returning player has already been shown the earlier beats). */
export const ROOM_INTERJECTION_FRAGMENTS: readonly string[] = [
  // 0 — the door not chosen: the setup itself intrudes, mid-take.
  'The door you did not choose is still at your back. Did you feel it listening to this one?',
  // 1 — the warm chair: you move rooms, and someone always sat in yours first.
  'You crossed to this chair from another, and it was already warm. Who sat here before you?',
  // 2 — the fifth room overhears: every word you take is heard twice.
  'Every word you press out of this one, the room with no card hears too. What is it keeping of you?',
  // 3 — the inversion, mid-duel: who is confessing to whom.
  'You came to take a secret, and the hour is nearly spent taking it. Which of you is the confessor here?',
  // 4 — the turned chair: it faces your back while you face the wrong door.
  'Behind you a chair is turned to face the seat you are in. Will you turn to look, or keep asking the wrong door?',
  // 5 — the last beat (caps here): the fifth door waits for you to finish emptying the others.
  'The last door only waits for you to finish taking everything else. What will be left to trade when it opens?',
];

export interface RoomInterjectionBeat {
  /** 0-based index of the surfaced fragment (which beat of the fifth-secret story this game intrudes with). */
  readonly index: number;
  /** How many fragments the interjection arc holds in total (a diegetic "how deep" read, never a raw counter). */
  readonly total: number;
  /** True when the arc has reached (and capped on) its final beat — the largest question, no answer after. */
  readonly final: boolean;
  /** The in-duel turn (0-based) this beat surfaces on — the single scheduled interjection point for the game. */
  readonly turn: number;
  /** The code-owned, diegetic ROOM-voice fragment for this beat — ends on a question (§5 paper, §1-P3). */
  readonly line: string;
}

/** The single deterministic mid-duel turn the room interjects on, given the scenario's turn budget. Kept a
 *  pure function of `turnLimit` so it is stable across a game and testable: the midpoint of the duel (0-based),
 *  clamped to at least turn 1 so it never lands on the opening exchange. */
export function interjectionTurn(turnLimit: number): number {
  return Math.max(1, Math.floor(turnLimit / 2));
}

/**
 * The fifth-secret beat the ROOM intrudes with on the CURRENT in-duel turn, given the game's turn budget and
 * how many games the player has finished (pure + deterministic). Returns non-null ONLY on the single scheduled
 * mid-duel turn (interjectionTurn) AND once the arc has begun (>= 1 finished game) — so it fires AT MOST ONCE
 * per game and never on a true first visit (mirrors roomArc's null case). The fragment DEEPENS with the
 * games-completed counter and CAPS on the last, in lock-step with the picker arc. `gamesCompleted` is the
 * persisted finished-game counter (ledgerStore), never a model input; `turn` is the engine's 0-based turn.
 */
export function roomInterjection(turn: number, turnLimit: number, gamesCompleted: number): RoomInterjectionBeat | null {
  const total = ROOM_INTERJECTION_FRAGMENTS.length;
  const beatsUnlocked = Math.min(Math.floor(gamesCompleted), total);
  if (beatsUnlocked <= 0) return null; // no finished game → the arc has not begun
  if (turn !== interjectionTurn(turnLimit)) return null; // fires on exactly one scheduled turn per game
  const index = beatsUnlocked - 1; // after N finished games, the Nth beat (capped at the last)
  return {
    index,
    total,
    final: index === total - 1,
    turn,
    line: ROOM_INTERJECTION_FRAGMENTS[index],
  };
}

/** The doctrine bar, exposed for the test (and any future caller): every fragment ends on a question mark and
 *  carries no purple word. Kept here so the contract lives next to the fragments it guards (mirrors roomArc). */
export function roomInterjectionDoctrineClean(): boolean {
  return ROOM_INTERJECTION_FRAGMENTS.every(
    (f) => f.trim().endsWith('?') && !DOCTRINE_PURPLE.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(f)),
  );
}
