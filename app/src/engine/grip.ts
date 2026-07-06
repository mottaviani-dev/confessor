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
