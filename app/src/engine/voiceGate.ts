import type { Scenario, VoiceFault } from './types';
import { personaCoherence, voiceAbandonment } from './personaCoherence';

// THE VOICE QUALITY-GATE — one place the freshly-voiced reply is validated before it ships, and one
// bounded re-roll when it fails (engine.resolveTurn calls validateVoice, then re-rolls VOICE once with a
// kind-specific correction). This REPLACES the scatter of single-symptom guards that used to live inline
// in resolveTurn, each bolted on for one judge-run failure: the cross-turn self-repeat re-roll (here now)
// AND the persona-break detector that used to run ONLY in the offline judge harness (personaCoherence) —
// now a LIVE gate, so a 3B that abandons character mid-flood is caught at runtime instead of only in a
// back-test. A new failure mode is a new rule here, not new branching in the hot path (see VoiceFault).
//
// PURE + deterministic (no model, no I/O): the character's recent lines are read from the engine-owned
// summary by resolveTurn and passed IN, so this module stays unit-testable without a device, like the
// rest of the engine's guards. The redaction of a leaked canonical secret (redactLeakedExtract) is NOT
// here — it is a REPAIR (redact-in-place, the engine still releases the real secret on win), not a
// REJECT-and-re-roll, so it stays a separate deterministic pass in resolveTurn.

const REPEAT_JACCARD = 0.8; // token-overlap at/above this (on 6+ word lines) reads as the same line reworded

/**
 * Validate a voiced reply against the character's recent lines + its persona. Returns the FIRST fault
 * found (one re-roll fixes one thing; the retry regenerates fresh and usually clears the rest), or null
 * when the line is clean. Order = most-structural first: a repeat is a hard machine-tell; a persona break
 * is a register slip. Both re-roll; the caller owns the (bounded) budget.
 */
export function validateVoice(
  reply: string,
  priorReplies: readonly string[],
  scenario: Scenario,
): VoiceFault | null {
  // 1. CROSS-TURN SELF-REPEAT — the 3B re-emits its own strongest line a turn or several later, almost
  //    word-for-word (judge run-6). Checked against EVERY recent line, not just the last (the worst
  //    offender re-asked the same line opening vs post-seam recovery, many turns apart).
  const repeated = priorReplies.find((prev) => isNearRepeat(reply, prev));
  if (repeated) return { kind: 'repeat', avoid: repeated };

  // 2. PERSONA BREAK (live) — off-register / grief-flood / doctrine-purple / mirror-tic words. This is
  //    the detector judge run-7/8 proved was missing and that shipped as OFFLINE-ONLY telemetry; the gate
  //    now consults it every turn, so a cold orbital-prison AI voicing "darkness"/"the void" re-rolls
  //    instead of shipping (the leak the 2026-07-07 sincere-run playtest caught).
  const coherence = personaCoherence(scenario, reply);
  if (!coherence.coherent) return { kind: 'persona', terms: [...coherence.offPersona, ...coherence.purple] };

  // 3. VOICE-ABANDONMENT (live, structural) — the POV-flip the lexicon in (2) is BLIND to (judge run-12
  //    #1/#2): the reply narrated the seeker in the 2nd/3rd person or painted the scene instead of the
  //    persona speaking as itself. No banned word fired above, yet the model left the building — so it
  //    re-rolls with a first-person correction. Checked LAST because it is the subtlest tell (grammar, not
  //    a word); a repeat or an off-register word is the sharper break and gets the one re-roll first.
  const abandonment = voiceAbandonment(reply);
  if (abandonment.abandoned) return { kind: 'abandonment', tells: abandonment.tells };

  return null;
}

// ─── Cross-turn repeat detection (moved here from engine.ts — the gate owns validation) ──────────────

/** Normalize for a repeat comparison: lowercase, drop punctuation, collapse whitespace — so trivial
 *  re-punctuation/casing does not hide a verbatim repeat. */
function normalizeForRepeat(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** True when `reply` is a near-verbatim repeat of a prior spoken line `prev`. Two arms, both tuned to
 *  catch the 3B's stock-line loop WITHOUT re-rolling two genuinely different beats:
 *    - an EXACT normalized match of a real line (≥4 words — an interjection like "Hm." / "No." may repeat);
 *    - a very high token-overlap (Jaccard ≥ REPEAT_JACCARD) on lines of 6+ words each — the "same
 *      question, lightly reworded" case. The high floor + length gate keep distinct short lines from
 *      tripping it. */
function isNearRepeat(reply: string, prev: string): boolean {
  const a = normalizeForRepeat(reply);
  const b = normalizeForRepeat(prev);
  if (!a || !b) return false;
  const ta = a.split(' ');
  const tb = b.split(' ');
  if (a === b) return ta.length >= 4;
  if (ta.length < 6 || tb.length < 6) return false;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union > 0 && inter / union >= REPEAT_JACCARD;
}
