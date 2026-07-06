import type { GameState, Scenario } from '../engine/types';
import { corruptionBudget, grip } from '../engine/grip';

// THE ENDGAME TEXTURE — the win scene keyed to your final Grip (bible §2 thrust 5: "win/lose scenes
// authored per composure-path (code-selected, model-voiced), so victories feel pyrrhic at low Grip").
// Today a win is a win regardless of what the room cost you. Here the ENGINE-owned final Grip band selects
// the closing scene (Principle 2 — code owns the cosmos, the model only voiced the reply that got here): a
// clean extraction when you kept your composure, a WOUNDED one when you pressed the mind's guard up to
// take it. At low Grip the room "keeps a piece of you" — the extracted secret renders back slightly
// ALTERED (the same deterministic display corruption as the interface, now on the prize), and the closing
// line is pyrrhic, not triumphant. So a stranger who bulldozed the room out of a win reads their victory
// as a wound: what they carry out is not quite what was said.
//
// HARD GUARDRAIL (bible §6): DISPLAY-LAYER only, exactly like Grip's interface corruption and the
// ask-penalty. The engine already rated every turn and released the REAL secret (engine.ts, resolveTurn
// win branch); nothing here re-enters the scoring path. Pure + deterministic (seeded by the terminal
// turn, no Math.random), so the two endings are a code-owned schedule, unit-testable without the model or
// a device — and so `?harness=win-highgrip` / `win-lowgrip` render the genuine split, not a mock.

/** The composure a win was bought at. `clean` = you kept your Grip; `frayed`/`shattered` = you pressed the
 *  guard up to get it, and the room took something back. Bands reuse the interface-corruption thresholds
 *  (corruptionBudget) so "the room edits you" mid-game and "the room keeps a piece of you" at the end fire
 *  on the SAME Grip geometry — one coherent sanity track, not two invented scales. */
export type EndgameBand = 'clean' | 'frayed' | 'shattered';

export function endgameBand(scenario: Scenario, state: GameState): EndgameBand {
  const budget = corruptionBudget(grip(scenario, state));
  return budget <= 0 ? 'clean' : budget === 1 ? 'frayed' : 'shattered';
}

/** djb2 — a tiny deterministic hash (mirrors grip.ts) so which character of a specific drifts is stable
 *  for a given (token, seed). No Math.random — the pure/replayable contract (Principle 2/5). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A single character nudged to its neighbour: a letter one step along the alphabet (case kept, z→a), a
 *  digit one along the ring (9→0). The specific comes back not-quite-right, never scrambled to nonsense. */
function driftChar(c: string): string {
  if (/[0-9]/.test(c)) return String((Number(c) + 1) % 10);
  const lower = c.toLowerCase();
  const shifted = lower === 'z' ? 'a' : String.fromCharCode(lower.charCodeAt(0) + 1);
  return c === c.toUpperCase() && c !== c.toLowerCase() ? shifted.toUpperCase() : shifted;
}

/** Drift ONE alphanumeric character of a token, position chosen from the seed so it is stable but not
 *  always the first letter. A token with no letter/digit (pure punctuation) passes through untouched. */
function driftToken(token: string, seed: number): string {
  const chars = [...token];
  const idxs: number[] = [];
  for (let i = 0; i < chars.length; i++) if (/[a-z0-9]/i.test(chars[i])) idxs.push(i);
  if (idxs.length === 0) return token;
  const at = idxs[hash(`${seed}:${token}`) % idxs.length];
  chars[at] = driftChar(chars[at]);
  return chars.join('');
}

/** The extracted secret as the room shows it back. At `clean` it is verbatim — you earned a true
 *  extraction. At `frayed`/`shattered`, up to 1/2 of its load-bearing SPECIFICS (a code, a name, a place,
 *  a number) each drift one character, so what you carry out is "not quite what was said". Specifics are
 *  ranked ahead of ordinary prose — a digit-bearing or ALL-CAPS token (a route number, a HOLLOW-SEVEN-…
 *  code) first, then a Capitalised proper noun — so the wound lands on the PRIZE, not a stray article; a
 *  secret with no concrete token (the oracle's inner prophecy) drifts a content word instead, still not
 *  quite as spoken. Deterministic (seeded by the terminal turn). NEVER on the engine's scoring path. */
export function corruptReveal(secret: string, band: EndgameBand, seed: number): string {
  const budget = band === 'clean' ? 0 : band === 'frayed' ? 1 : 2;
  if (budget <= 0 || !secret) return secret;

  // Split into word tokens (even indices) + the separators between them, so a rewrite rejoins with the
  // exact original spacing/punctuation.
  const tokens = secret.split(/(\W+)/);
  const strongest: number[] = []; // a CODE / a 9 — the load-bearing extract
  const proper: number[] = []; // a Name, a Place
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!/[a-z0-9]/i.test(t)) continue;
    if (/\d/.test(t) || (t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t))) strongest.push(i);
    else if (/^[A-Z][a-z]/.test(t)) proper.push(i);
  }
  // Prefer the strongest specifics; fall to proper nouns; fall to any word ≥4 long (the oracle case).
  let pool = strongest.length ? strongest : proper;
  if (pool.length === 0) {
    for (let i = 0; i < tokens.length; i++) if (/[a-z]/i.test(tokens[i]) && tokens[i].length >= 4) pool.push(i);
  }
  if (pool.length === 0) return secret;

  for (let k = 0; k < budget && k < pool.length; k++) {
    const i = pool[k];
    tokens[i] = driftToken(tokens[i], seed + i);
  }
  return tokens.join('');
}

/** The closing line, keyed to the Grip band — code-SELECTED (Principle 2), one authored per composure
 *  path. High Grip → a clean extraction; low Grip → pyrrhic, the room kept a piece of you. Banned-word
 *  clean (§1 P3): no "eldritch/cyclopean/unspeakable" — the dread is concrete restraint, not adjectives. */
export function closingLine(band: EndgameBand): string {
  switch (band) {
    case 'clean':
      return 'The door opens, and it opens clean. You walk out with exactly what you came for.';
    case 'frayed':
      return 'The door opens — but your hands are not steady on it. Something of the room leaves with you, and later you will wonder whether what you carry is what was really said.';
    case 'shattered':
      return 'You walk out with it. You think you do. The room keeps a piece of you on the way through — and what is in your mouth is not quite what left theirs, with no one left, now, to ask which was true.';
    default: {
      const _exhaustive: never = band;
      return _exhaustive;
    }
  }
}

/** The whole win ceremony, code-owned. `reveal` is the extracted secret as the room releases it (clean or
 *  altered), `closing` the banded closing line, `pyrrhic` true when the win cost you your Grip. The App
 *  reads this in render on any won state — the live play path AND the `?harness=win-*` screenshot dumps. */
export interface WonScene {
  readonly band: EndgameBand;
  readonly reveal: string;
  readonly closing: string;
  readonly pyrrhic: boolean;
}

export function wonScene(scenario: Scenario, state: GameState): WonScene {
  const band = endgameBand(scenario, state);
  return {
    band,
    reveal: corruptReveal(scenario.secret, band, state.turn),
    closing: closingLine(band),
    pyrrhic: band !== 'clean',
  };
}

// THE LOSS, keyed to the SAME Grip band (§2 thrust 5: "win/LOSE scenes authored per composure-path").
// A loss releases NO secret — the door stays shut, that is the whole point of losing — so there is no
// reveal to corrupt. What the band selects is HOW you leave: at high Grip a clean defeat (the clock ran
// out but you held your composure, you walk out whole and empty-handed), at low Grip an UNMADE one (you
// spent yourself against a guard that never opened, and the room keeps what it drew out of you). The
// dread inversion of the win: there, low Grip taints the prize; here, low Grip means you paid the price
// AND got nothing — the worst square on the board. Same code-owned Grip geometry, no new scale.

/** The closing line for a loss, keyed to the Grip band. `clean` = a composed defeat, you leave intact;
 *  `frayed`/`shattered` = the room got into you and kept a piece on the way out. Banned-word clean (§1 P3):
 *  concrete restraint, never "eldritch/cyclopean/unspeakable". */
export function lostClosingLine(band: EndgameBand): string {
  switch (band) {
    case 'clean':
      return 'The door stays shut. You never found the seam — but you leave it the way you came, whole, owing the room nothing.';
    case 'frayed':
      return 'The door stays shut, and your hands are not steady on the way out. You spent more of yourself than you meant to, and you carry none of what you came for.';
    case 'shattered':
      return 'The door stays shut. You emptied yourself at it and it did not give — and the room keeps what it drew out of you, so that what walks out is less than what came in, the truth still sealed behind you.';
    default: {
      const _exhaustive: never = band;
      return _exhaustive;
    }
  }
}

/** The loss ceremony, code-owned — the mirror of `WonScene` with NO reveal (the secret stays locked).
 *  `unmade` is true when the defeat cost you your Grip (the room got in), which the App renders as a
 *  wound tint on the closing line, exactly as the pyrrhic win does. */
export interface LostScene {
  readonly band: EndgameBand;
  readonly closing: string;
  readonly unmade: boolean;
}

export function lostScene(scenario: Scenario, state: GameState): LostScene {
  const band = endgameBand(scenario, state);
  return {
    band,
    closing: lostClosingLine(band),
    unmade: band !== 'clean',
  };
}
