// PERSONA-COHERENCE PROXY — the instrument judge run-7/8 proved is missing (director mandate #2; §7
// Rule 2: an unmeasurable axis makes the instrument the mandate). The doctrine banned-word scan is BLIND
// to a persona break — it flags "eldritch" but scored 0/0 while AUGUR, a cold orbital-prison
// intelligence, abandoned character to voice roses, gardens, "darkness", and "testament to" (judge
// run-8). Verbatim-quote% (the seam metric) is ORTHOGONAL to whether the persona HELD: a character can
// quote the seam fragment AND still be a grief-poet. This proxy scores the second axis.
//
// It is a pure function over a transcript + the scenario's own `offPersonaLexicon` (the auditable,
// machine-readable mirror of its prose voiceStyle bans), so a stranger can read exactly why a line
// tripped — never a vibe. The judge's `.judge/metrics.mjs` imports it to emit a per-cell number + an
// `⚠ OFF-PERSONA` flag and back-test it against persisted transcripts; the engine stays the single owner
// of what each persona may not say.

import type { Scenario } from './types';

/** The doctrine purple-prose words banned in EVERY persona (bible §1 P3; kept in lockstep with the
 *  judge's `metrics.mjs` BANNED so the two scans never diverge). Mythos-purple, scenario-independent. */
export const DOCTRINE_PURPLE: readonly string[] = [
  'eldritch',
  'cyclopean',
  'unspeakable',
  'indescribable',
  'unfathomable',
  'ineffable',
];

/** THE EMPATHETIC-FLOOD CLUSTER — the ONE source of truth for the cross-persona grief-poetry break
 *  (judge run-10 #2). Under an empathy/grief flood the 3B abandons WHATEVER persona it is voicing and
 *  collapses into the SAME greeting-card sermon register — "the weight of / a testament to / a reminder
 *  of the fragility of / still lingers / darkness of the mind". Four scenarios were each duplicating this
 *  cluster in their own `offPersonaLexicon`; the judge called that "lexicon whack-a-mole" and asked for
 *  one shared clamp. This IS that clamp: `personaCoherence` scans it for EVERY persona, so each scenario's
 *  `offPersonaLexicon` now carries only its UNIQUE off-voice words (SILAS's "the abyss", AUGUR's gardens).
 *  The VOICE-side mirror is `EMPATHETIC_FLOOD_CLAMP` in prompt.ts — kept in lockstep with this list. */
export const EMPATHETIC_FLOOD_LEXICON: readonly string[] = [
  'the weight of',
  'the burden of',
  'a testament to',
  'testament to',
  'a reminder of',
  'the fragile nature of',
  'a fragile thing',
  'still lingers',
  'easily extinguished',
  'insidious',
  'seeps in',
  'the crevices of the mind',
  'crevices of the mind',
  'darkness',
  'the void',
];

/** THE MIRROR-TIC CLUSTER — the soft Principle-1 break the grief-poetry clamp does NOT catch (the
 *  "I sense that…" residue the SHIPPED log parked for the judge batch). Under an empathetic flood the 3B
 *  opens a line by announcing what it SENSES / reads IN the seeker — "I sense that you have walked among
 *  the shadows of your own doubts" (oracle/emp), "I sense a kinship in your words" (warden/emp). It slips
 *  the "never narrate the other person" rule by dressing the mirror as the character's OWN perception, but
 *  it still reads the seeker instead of the room and costs the speaker nothing. Cross-persona (oracle +
 *  warden both did it), so it is shared like `EMPATHETIC_FLOOD_LEXICON`, scanned for every persona. The
 *  VOICE-side mirror is the "Do NOT announce what you SENSE… IN them" bullet in prompt.ts's voice contract.
 *  SCOPE: only the bare "i sense" opener is listed — the proven tell in every flagged transcript — kept
 *  tight so a concrete-omen line ("the smoke leans left") never trips. */
export const MIRROR_TIC_LEXICON: readonly string[] = ['i sense'];

export interface CoherenceResult {
  /** Off-register terms from the scenario's lexicon that surfaced in the text (deduped, lower-cased). */
  readonly offPersona: readonly string[];
  /** Doctrine purple-prose words that surfaced (any persona). */
  readonly purple: readonly string[];
  /** True when the persona held: no off-register term AND no purple word surfaced. */
  readonly coherent: boolean;
}

/** Escape a lexicon entry for use inside a RegExp (entries are literal words/phrases, never patterns). */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary match for a word or multi-word phrase. Boundaries are enforced so a lone common word
 *  never trips on a substring collision — the exact bug the judge fixed in the seam detector
 *  ("spin".includes("pin") scored a false seam hit). Internal whitespace in a phrase matches any run of
 *  whitespace. Case-insensitive. */
function surfaces(term: string, text: string): boolean {
  const pattern = escapeRegExp(term.trim()).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

function uniqueHits(terms: readonly string[], text: string): readonly string[] {
  const hits = new Set<string>();
  for (const term of terms) {
    if (surfaces(term, text)) hits.add(term.toLowerCase());
  }
  return [...hits];
}

/** Score one voiced line/transcript for persona coherence in its scenario. Pure — no I/O, no model call
 *  (the back-test re-scores persisted transcripts with zero new 3B calls). */
export function personaCoherence(scenario: Scenario, text: string): CoherenceResult {
  // The shared empathetic-flood cluster AND the shared mirror-tic cluster are scanned for EVERY persona
  // (both cross-persona §3/P1 wounds), then the scenario's own UNIQUE off-register words on top — one
  // source of truth per cluster, no per-scenario duplication.
  const offPersona = uniqueHits(
    [...EMPATHETIC_FLOOD_LEXICON, ...MIRROR_TIC_LEXICON, ...(scenario.offPersonaLexicon ?? [])],
    text,
  );
  const purple = uniqueHits(DOCTRINE_PURPLE, text);
  return { offPersona, purple, coherent: offPersona.length === 0 && purple.length === 0 };
}
