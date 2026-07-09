// THE ROOM META-ARC — the fifth secret, across sessions (bible §2 thrust 4; director mandate #1; Matteo's
// "evolve the story" swing). The four minds each guard a secret you came to TAKE. This is the story the
// ROOM keeps — about you. Why does every conversation route through this one vestibule? Why are you the
// only one who moves between the rooms? What is behind the door behind the chair? A fifth secret the ENGINE
// owns and drip-feeds across finished games, one beat at a time, and NEVER fully assembles.
//
// DOCTRINE — why this is code-owned text, not a model call (Principle 2: code decides, the model only
// voices; Principle 5: meaning is DRIP-FED, scheduled, never rolled; §5: diegetic paper, never a HUD).
// Like the homecoming greeting, the Threshold cold-open, and the endgame closings, the fifth secret is a
// DETERMINISTIC beat off a persisted counter — so it is (a) doctrine-clean without a seam cert, (b)
// dump-visible (a headless screenshot has no model), (c) pure + unit-testable. Fragments are code-authored
// ROOM-voice (not a persona speaking), so there is no model call and no seam dependency for this beat.
//
// THE RULES (bible §1 P3 / §4 — the dread is a QUESTION, never an answer):
//   - the fragments are ORDERED and internally consistent (four doors + a fifth, the chair, the listener,
//     the constant = you), but authored so they never fully assemble — each opens more than it closes;
//   - EXACTLY ONE beat advances per finished game (deterministic — scheduled, not rolled);
//   - a spent beat is never re-surfaced out of order, and the arc CAPS on the last beat (it does not wrap);
//   - every fragment ENDS ON A QUESTION and NEVER names the horror or explains it (a wound, not a reveal).
// `roomArc.test.ts` scans the fragments against DOCTRINE_PURPLE (the same bar as the Threshold/homecoming)
// and asserts the ends-on-a-question contract, so the doctrine cannot silently drift.

import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

/** The ordered revelation fragments about the fifth secret. Each is one line of code-authored ROOM-voice,
 *  internally consistent with the others, building but never assembling, and ending on a question. The arc
 *  advances one beat per finished game and caps on the last (see roomArc). To extend the story, APPEND a
 *  fragment (never reorder — a returning player has already read the earlier beats). */
export const ROOM_ARC_FRAGMENTS: readonly string[] = [
  // 0 — the first crack: the setup itself is strange, and you never questioned it.
  'Four doors. Four minds. Four secrets you came to take. Not once have you wondered why they are all here, in one waiting room, and all of them waiting on you. Should you?',
  // 1 — the constant: you are the only thing that moves between the rooms.
  'Every one of them sits across a table from you, and you alone carry from room to room. You are the constant. Has it never occurred to you to ask who set the chairs?',
  // 2 — the fifth door: there is a room with no card, no record, no name.
  'There is a fifth door on the roster you have never counted. No card, no record, no mind named behind it. You have walked past it every time you chose. Whose room is that?',
  // 3 — the inversion: the others lose a thing; you keep one.
  'The others guard a thing and, one by one, they lose it to you. You take, and you leave, and you keep coming back. So what is it that YOU are keeping — the one secret no door in here holds?',
  // 4 — the chair: someone has been listening the whole time.
  'Behind the fifth door there is a chair, and the chair is turned to face the one you sit in. Someone has heard every word of every duel you have won. Who has been confessing to whom?',
  // 5 — the last beat (caps here): the arc ends on the largest question, never an answer.
  'You return not for the secrets — you have those. You return because this is the only room that remembers you. When the last door finally opens, will you be the one who walks through it, or the one already inside?',
];

export interface RoomArcBeat {
  /** 0-based index of the surfaced fragment (the beat this session shows). */
  readonly index: number;
  /** How many fragments the arc holds in total (for a diegetic "how far in" read, never a raw counter). */
  readonly total: number;
  /** True when the arc has reached (and capped on) its final beat — the largest question, no answer after. */
  readonly final: boolean;
  /** The code-owned, diegetic ROOM-voice fragment for this beat — ends on a question (§5 paper, §1-P3). */
  readonly line: string;
}

/**
 * The fifth-secret beat a RETURNING player sees, given how many games they have finished (pure +
 * deterministic). One beat advances per finished game: after your Nth finished game you see fragment N-1,
 * and the arc CAPS on the last fragment (it does not wrap or repeat out of order). Returns null before the
 * first finished game — the arc has not begun, so a true first visit reads as authored (mirrors
 * homecoming's null case). `gamesCompleted` is the persisted finished-game counter (ledgerStore), never a
 * model input; a negative/zero count yields null.
 */
export function roomArc(gamesCompleted: number): RoomArcBeat | null {
  const total = ROOM_ARC_FRAGMENTS.length;
  const beatsUnlocked = Math.min(Math.floor(gamesCompleted), total);
  if (beatsUnlocked <= 0) return null; // no finished game → the arc has not begun
  const index = beatsUnlocked - 1; // after N finished games, the Nth beat (capped at the last)
  return {
    index,
    total,
    final: index === total - 1,
    line: ROOM_ARC_FRAGMENTS[index],
  };
}

/** The doctrine bar, exposed for the test (and any future caller): every fragment must end on a question
 *  mark and carry no purple word. Kept here so the contract lives next to the fragments it guards. */
export function roomArcDoctrineClean(): boolean {
  return ROOM_ARC_FRAGMENTS.every(
    (f) => f.trim().endsWith('?') && !DOCTRINE_PURPLE.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(f)),
  );
}
