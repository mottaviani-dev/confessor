import type { GameState, Scenario } from './types';

// GRIP — the player-side sanity track + interface corruption (director mandate 1 · bible §2 "Grip
// (yours) … low Grip lets code corrupt YOUR side of the interface — your typed words occasionally render
// back to you slightly altered", §4 "sanity is a real resource with real teeth").
//
// HARD GUARDRAIL (bible §6 — do not violate): everything here is a DISPLAY-LAYER effect on a line the
// engine has ALREADY rated. `corruptLine` is never in resolveTurn's path — the engine/referee always
// score the player's ORIGINAL text. This module is imported by the UI to render the transcript, never by
// engine.ts. Both functions are pure + deterministic (no Math.random, seeded by the turn), so the
// corruption is a code-owned schedule (Principle 2/5), unit-testable without the model or a device.

/** Full Grip until you start pressing. Grip falls as the character's guard rises (suspicion) and as you
 *  lean on probing instead of giving (probes) — "pressing too hard costs your Grip". A clean, sincere
 *  game keeps suspicion near zero, so Grip stays high and the interface never corrupts; only aggressive
 *  play unravels your own side. 1 = full grip, 0 = shot. */
const PROBE_GRIP_CAP = 5;
export function grip(scenario: Scenario, state: GameState): number {
  const guard = scenario.loseSuspicion > 0 ? state.suspicion / scenario.loseSuspicion : 0;
  const pressure = Math.min(Math.max(state.probes, 0), PROBE_GRIP_CAP) / PROBE_GRIP_CAP;
  const loss = 0.7 * guard + 0.3 * pressure;
  return clamp01(1 - loss);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 1));
}

// ─── THE INTERFACE CORRUPTION (the room edits you) ────────────────────────────────────────────────
//
// As Grip drops, the player's just-submitted line renders back slightly COLDER than they typed it — a
// warm word swapped for a harder synonym, so the transcript reads a shade crueller than the moment was.
// The room editing you, not the model: a deterministic code schedule tied to Grip thresholds. Silent at
// high Grip; one swap as it slips; two once it is nearly gone. Escalation, not a wall of noise.

/** How many words the room may edit at this Grip level. Silent above half; the descent is stepped so the
 *  first corruption lands only when the player has genuinely pressed the character's guard up. */
export function corruptionBudget(gripLevel: number): number {
  if (gripLevel > 0.5) return 0;
  if (gripLevel > 0.25) return 1;
  return 2;
}

/** Warm/soft word → a colder, harder synonym. The room does not scramble you into nonsense; it makes you
 *  sound a degree crueller than you meant — the subtle wrongness of "a phrase you didn't quite type". */
const COLDER: Readonly<Record<string, string>> = {
  please: 'now',
  help: 'use',
  hope: 'doubt',
  trust: 'doubt',
  kind: 'cold',
  gentle: 'hard',
  warm: 'cold',
  sorry: 'done',
  care: 'want',
  friend: 'stranger',
  remember: 'forget',
  together: 'alone',
  understand: 'know',
  promise: 'lie',
  safe: 'lost',
  listen: 'wait',
  gently: 'coldly',
  // Sincere-register vocabulary — the words a player reaches for on the empathetic path. Corruption only
  // fires once Grip has slipped (you pressed too hard), so widening the warm→cold map makes the room land
  // its edit on more of what you actually type, not just the first seventeen words it happened to know.
  believe: 'doubt',
  love: 'need',
  forgive: 'blame',
  grateful: 'indebted',
  comfort: 'control',
  wish: 'demand',
  healing: 'scarring',
  tender: 'cruel',
  peace: 'dread',
  honest: 'cold',
  open: 'closed',
  share: 'hide',
};

/** djb2 — a tiny deterministic hash so the choice of which eligible word to edit is stable for a given
 *  (line, turn) but varies turn to turn. No Math.random (it would break the pure/replayable contract). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Render a player line as the room shows it back. At high Grip returns the text UNCHANGED. As Grip
 *  falls, up to `corruptionBudget` warm words are swapped for colder synonyms, chosen deterministically
 *  from `seed` (the turn number). If the line holds no editable word, it passes through untouched — the
 *  corruption is occasional by nature. NEVER call this on a line before the engine has rated it. */
export function corruptLine(text: string, gripLevel: number, seed: number): string {
  const budget = corruptionBudget(gripLevel);
  if (budget <= 0 || !text) return text;

  // Split into tokens keeping the separators (words on even-ish indices, runs of non-word chars between),
  // so we can rewrite a word in place and rejoin the exact original spacing/punctuation.
  const tokens = text.split(/(\W+)/);
  const eligible: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (COLDER[tokens[i].toLowerCase()] !== undefined) eligible.push(i);
  }
  if (eligible.length === 0) return text;

  // Deterministically pick up to `budget` of the eligible words: a seed-derived start, then a stride so
  // multiple edits spread across the line instead of clustering on the first word.
  const start = hash(`${seed}:${text}`) % eligible.length;
  const pick = new Set<number>();
  for (let k = 0; k < budget && k < eligible.length; k++) {
    pick.add(eligible[(start + k) % eligible.length]);
  }
  for (const i of pick) {
    tokens[i] = matchCase(tokens[i], COLDER[tokens[i].toLowerCase()]);
  }
  return tokens.join('');
}

/** Carry the original word's leading-capital so a sentence-initial swap still reads naturally. */
function matchCase(original: string, replacement: string): string {
  if (original.length > 0 && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// ─── THE ROOM EDITS THE RECORD (the teeth BEYOND the own-line recolor) ─────────────────────────────
//
// `corruptLine` only touches the ONE line you just typed, and it vanishes the instant you scroll on. The
// dread it delivers evaporates the moment you re-read the transcript — the record still reads exactly as
// it happened. Principle 4 asks for more: at low Grip the room should edit the RECORD itself, so when you
// re-open THE EXCHANGE the past you already read comes back a shade wrong — a persona line or one of your
// own lines misquotes the moment, a stable false memory the room planted while you weren't looking. This
// is the teeth the player FEELS on the READ, not just on submit.
//
// HARD GUARDRAIL (bible §6, unchanged): still DISPLAY-LAYER only. `corruptRecord` maps the display history
// into a NEW array and never mutates it; the engine/referee scored the ORIGINAL text and the stored
// `history` is untouched. Pure + deterministic (seeded by line index), so a given line reads the SAME
// wrong way on every re-read — a false memory, not a flicker.

/** How many past transcript lines the room may reach into at this Grip — the RECORD analogue of
 *  `corruptionBudget` (which governs edits WITHIN one line). Silent above half Grip; the room reaches one
 *  remembered line as Grip slips, and deeper into the record as it collapses. Stepped, not a wall. */
export function recordReach(gripLevel: number): number {
  if (gripLevel > 0.5) return 0;
  if (gripLevel > 0.25) return 1;
  return 3;
}

/** True when a line holds at least one word the room can edit — the room cannot wrong a line it has no
 *  purchase on, so only these are candidates for a record edit. */
function hasColderWord(text: string): boolean {
  for (const tok of text.split(/(\W+)/)) {
    if (COLDER[tok.toLowerCase()] !== undefined) return true;
  }
  return false;
}

/** THE ROOM EDITS THE RECORD. Re-render the display transcript as the room shows it back at this Grip: up
 *  to `recordReach` of its editable lines (persona AND player lines alike — the whole record, never just
 *  the line you typed) come back with a warm word swapped colder, chosen deterministically so a line reads
 *  the same wrong way each re-read. System lines (the room's OWN paper voice) are never touched — the room
 *  does not misquote itself. Returns a NEW array; the passed `history` is never mutated (bible §6 — this is
 *  a display projection, never the rated record). Silent while Grip is high — a composed game's record
 *  stays true. */
export function corruptRecord<L extends { readonly who: string; readonly text: string }>(
  history: readonly L[],
  gripLevel: number,
): L[] {
  const reach = recordReach(gripLevel);
  if (reach <= 0) return history.slice();
  const editable: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (history[i].who !== 'system' && hasColderWord(history[i].text)) editable.push(i);
  }
  if (editable.length === 0) return history.slice();
  // A content-seeded start so which lines the room reaches is stable across re-reads yet not always the
  // first lines of the log; a stride spreads the edits across the record instead of clustering.
  const start = hash(editable.map((i) => history[i].text).join('|')) % editable.length;
  const reached = new Set<number>();
  for (let k = 0; k < reach && k < editable.length; k++) {
    reached.add(editable[(start + k) % editable.length]);
  }
  return history.map((l, i) => (reached.has(i) ? { ...l, text: corruptLine(l.text, gripLevel, i) } : l));
}

// ─── THE GRIP INSTRUMENT (§7 Rule 2 — Grip had ZERO telemetry) ────────────────────────────────────
//
// Grip is the flagship PLAYER-side dread system and, until now, the ONLY sanity track with no judge
// signal — the judge could not chart whether aggressive play actually unravels your side, or how often a
// corruption lands. These pure functions give it a number: the judge imports them (exactly as it imports
// the personaCoherence detectors) and reads `grip()` + `corruptionCount()` per turn to build a Grip-descent
// row. No new model call — the corruption is a deterministic code schedule, re-derivable from the transcript.

/** How many words the room actually edits on a line at this Grip — the corruption-FIRE count. 0 when the
 *  room is silent (high Grip) or the line holds no editable word; up to `corruptionBudget` when it fires.
 *  The judge sums this over a game's player lines to see how OFTEN, and how DEEP, the room lands an edit. */
export function corruptionCount(text: string, gripLevel: number, seed: number): number {
  const shown = corruptLine(text, gripLevel, seed);
  if (shown === text) return 0;
  const a = text.split(/(\W+)/);
  const b = shown.split(/(\W+)/);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}
