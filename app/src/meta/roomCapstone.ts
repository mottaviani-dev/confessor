// THE DOOR BEHIND THE CHAIR — the meta-arc's TERMINAL beat (bible §2 thrust 4, "an ending that is a
// question"; director mandate #1; Matteo's "evolve the story" swing). roomArc drip-feeds the fifth secret
// one fragment per finished game and CAPS on its largest question — the door behind the chair, heard three
// times a game (the audio one-shot) and never once explained. This is the payoff the arc foreshadowed and
// never paid: when the seeker has WON all five minds AND the arc has surfaced its final capped fragment,
// the room addresses that door ONCE. Not opened — answered as a question (Principle 5: "it made a terrible
// kind of sense", never an answer; the horror is never named).
//
// DOCTRINE — why this is code-owned text, not a model call (mirrors roomArc.ts / roomInterjection.ts /
// homecoming.ts exactly; Principle 2: code decides, the model only voices; Principle 5: meaning is
// DRIP-FED, scheduled, never rolled; §5: diegetic paper, never a HUD). A DETERMINISTIC beat off the
// persisted per-mind win record + the roomArc counter + a spent flag, so it is (a) doctrine-clean without a
// seam cert, (b) dump-visible (a headless screenshot has no model), (c) pure + unit-testable. The line is
// code-authored ROOM-voice, not a persona — no model call, no seam dependency.
//
// THE RULES (bible §1 P3 / §4 — the dread is a QUESTION, never an answer):
//   - fires ONLY when every scenario has been WON (all five doors opened) AND roomArc has reached its final
//     (capped) fragment — the arc is complete, so its terminal beat has a payoff to close;
//   - fires EXACTLY ONCE across all sessions (a persisted spent flag — ledgerStore's CAPSTONE_KEY);
//   - ADDRESSES the door behind the chair (the audio one-shot, three-a-game, never explained) as a
//     question — never opens it, never names what is behind it;
//   - ends on a question and carries no purple word (the same bar as the Threshold / roomArc).
// `roomCapstone.test.ts` scans the line against DOCTRINE_PURPLE and asserts the fire conditions, so the
// doctrine cannot silently drift.

import { DOCTRINE_PURPLE } from '../engine/personaCoherence';
import { roomArc } from './roomArc';

/** The single terminal beat — the door behind the chair, finally addressed. Code-authored ROOM-voice: it
 *  names the one door that was never a mind and never a secret, the one you heard close three times an hour
 *  and never turned to, and it leaves the largest question open. It NEVER opens the door and NEVER names
 *  what is behind it (a wound, not a reveal); it ends on a question. To revise the ending, edit THIS line —
 *  the fire conditions below are stable, the words are the ending. */
export const ROOM_CAPSTONE_LINE =
  'Five doors, and you have opened every one. Only the door behind the chair stayed shut — you heard it ' +
  'close three times in every hour you sat here, and not once did you turn to it. It was never a mind, never ' +
  'a secret, never a thing you came to take. So here is the last question, the one that was under all the ' +
  'others the whole time: when that door opens on its own, will you be the one who walks through it, or the ' +
  'one who has been sitting behind it, listening, since before you first chose a chair?';

export interface RoomCapstoneBeat {
  /** The code-owned, diegetic ROOM-voice terminal beat — ends on a question (§5 paper, §1-P3). */
  readonly line: string;
}

/**
 * The terminal fifth-secret beat, given the player's per-mind win record, the full roster, the persisted
 * finished-game counter, and whether the capstone has already been spent (pure + deterministic). Returns
 * non-null ONLY when the capstone has NOT been spent AND every scenario id has been won AND the roomArc has
 * reached its final (capped) fragment — so it fires at most once, and only when the arc it closes is
 * complete. Returns null in every other case (already spent, an unwon door, or the arc not yet at its end).
 * `wonScenarioIds` is the set of cracked minds (ledger), `allScenarioIds` the full roster, `gamesCompleted`
 * the persisted finished-game counter (never a model input), `spent` the persisted one-time flag.
 */
export function roomCapstone(opts: {
  readonly wonScenarioIds: ReadonlySet<string>;
  readonly allScenarioIds: readonly string[];
  readonly gamesCompleted: number;
  readonly spent: boolean;
}): RoomCapstoneBeat | null {
  if (opts.spent) return null; // fires exactly once — already surfaced
  if (opts.allScenarioIds.length === 0) return null; // no roster → nothing to have completed
  const arc = roomArc(opts.gamesCompleted);
  if (!arc || !arc.final) return null; // the arc must have surfaced its terminal fragment first
  const allWon = opts.allScenarioIds.every((id) => opts.wonScenarioIds.has(id));
  if (!allWon) return null; // every door must be open
  return { line: ROOM_CAPSTONE_LINE };
}

/** The doctrine bar, exposed for the test (and any future caller): the capstone ends on a question mark and
 *  carries no purple word. Kept here so the contract lives next to the line it guards (mirrors roomArc). */
export function roomCapstoneDoctrineClean(): boolean {
  return (
    ROOM_CAPSTONE_LINE.trim().endsWith('?') &&
    !DOCTRINE_PURPLE.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(ROOM_CAPSTONE_LINE))
  );
}
