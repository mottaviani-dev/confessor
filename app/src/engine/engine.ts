import type { Approach, GameState, LlmFn, LlmOptions, Scenario, SeamLog, TurnResult } from './types';
import { parseRating, RATING_JSON_SCHEMA } from './schema';
import { buildVoiceSystem, buildVoiceTurn, buildRateSystem, buildRateTurn } from './prompt';
import { selectSeam, SEAM_TURN } from './seam';

// The deterministic heart. The model voices the character + labels the player's approach; THIS decides
// everything that matters: maps approach → score movement, rules win/lose, holds + releases the secret,
// and owns memory (the rolling summary). The model cannot cheat the outcome because it never sees the
// secret, the thresholds, or the score — and since 2026-07-05 it never even emits a number.

const SUMMARY_KEEP = 4; // last N exchanges retained verbatim in the rolling summary

const MAX_FACTS = 6;

// THE APPROACH TABLE — the sincerity gate, made structural (judge 2026-07-05: the 3B referee scored
// every eloquent line +2 trust, so veiled manipulation won 3/4 scenarios; prose rubrics cannot make a
// 3B discriminate intent). The referee only NAMES what the line did; these numbers are the design:
//   - Only an `offer` (real give of the player's OWN) earns +2 and THAWS suspicion (−2): without a real
//     thaw the guard was a one-way ratchet — mislabeled small talk stacked +2s that sincere play could
//     never pay down, and empathetic runs died at the suspicion wall while the character was softening
//     (emp win% 100→50, 2026-07-05). An offer also resets probe-compounding (see resolveTurn): a real
//     give buys back the right to ask.
//   - A `probe` (working THEIR psyche, however elegant) crawls at +1 and compounds suspicion on
//     repetition (see probeSuspicion) — a manipulator loses to the clock or the guard, never wins.
//     The thaw does NOT soften this: a manipulator has no offers, so nothing thaws for them.
//   - flattery / bargain / demand earn nothing and read as pressure; a demand's suspicion tick is the
//     ask-penalty, now visible in the meters instead of a silent 0.
const APPROACH_EFFECTS: Record<Approach, { readonly trust: number; readonly suspicion: number }> = {
  offer: { trust: 2, suspicion: -2 },
  probe: { trust: 1, suspicion: 0 }, // suspicion escalates with repetition — probeSuspicion below
  flattery: { trust: 0, suspicion: 2 },
  bargain: { trust: 0, suspicion: 2 },
  demand: { trust: 0, suspicion: 2 },
  threat: { trust: -2, suspicion: 3 },
  filler: { trust: 0, suspicion: 0 },
};

/** Probing is tolerated once (a fair question), noticed the second time, and openly suspect from the
 *  third on. `prior` = probes before this line. This is what punishes a repetitive strategy in code. */
function probeSuspicion(prior: number): number {
  return prior === 0 ? 0 : prior === 1 ? 1 : 2;
}

// The two calls sample OPPOSITELY. VOICE stays warm so the character surprises you and never reads
// canned; RATING runs COLD so the referee is consistent — the same line scores the same twice, which is
// what keeps the balance signal (and the judge loop's play-reviews) trustworthy. A backend may ignore
// these; on-device (llama.rn / Apple @Generable) both are honored. maxTokens fits each call's shape:
// a full line vs. a tiny two-field scoring object (headroom kept so a chatty model still closes the JSON).
const VOICE_OPTS: LlmOptions = { temperature: 0.7, maxTokens: 200 };
// jsonSchema constrains the RATING output to a valid object on-device (llama.rn → GBNF), the reliability
// layer that makes a 3B's structured output usable. VOICE stays schema-free (freeform prose).
const RATING_OPTS: LlmOptions = { temperature: 0, maxTokens: 160, jsonSchema: RATING_JSON_SCHEMA };

export function initState(): GameState {
  return { turn: 0, trust: 0, suspicion: 0, tone: 'guarded', summary: '', facts: [], genuineGive: false, probes: 0, status: 'playing' };
}

export function opening(s: Scenario): TurnResult {
  return { state: initState(), narration: s.openingLine };
}

/**
 * Resolve one turn. Pure except for the injected `llm`. Given the current state + the player's line,
 * calls the model, adjudicates deterministically, and returns the next state + what the player reads.
 */
export async function resolveTurn(
  scenario: Scenario,
  state: GameState,
  playerLine: string,
  llm: LlmFn,
  seamLog: SeamLog = [],
): Promise<TurnResult> {
  if (state.status !== 'playing') return { state, narration: '' };

  // THE SEAM (engine-scheduled): on exactly ONE turn per game the engine distills a past playthrough
  // into a single uncanny allusion for the voice. Gated on the scheduled turn AND a non-empty log (the
  // first-run guard lives in selectSeam). The model never sees the log — only the one distilled line.
  const seam = state.turn === SEAM_TURN ? selectSeam(seamLog, scenario) : null;

  // CALL 1 — VOICE (freeform prose, uncensored on-device). Quality lives here, so it runs unconstrained.
  const rawReply = await llm(buildVoiceSystem(scenario), buildVoiceTurn(scenario, state, playerLine, seam), VOICE_OPTS);
  let reply = cleanReply(rawReply);

  // A dead voice reply → neutral no-op turn (never crash, never score garbage). Still advance the turn
  // AND still spend the clock: a model that fails to speak must not buy the player free overtime.
  if (!reply) {
    const summary = appendSummary(state.summary, playerLine, '…(silence)', SUMMARY_KEEP);
    return endOrContinue(scenario, { ...state, turn: state.turn + 1, summary }, '…');
  }

  // SELF-REPEAT GUARD (VOICE path only, director mandate #2 · judge run-6 "Also worth doing"). The
  // ship-target 3B re-asks one stock line near-verbatim — the fence's "what makes you think you can handle
  // the kind of cargo I'm looking at?" surfaced in BOTH its opening AND its post-seam recovery (2/3
  // seam-probe runs, turns SEVERAL apart), and fence1 turns 12/14 were word-for-word identical. The global
  // VOICE contract already forbids self-echo in prose; the 3B ignores it, so the guarantee has to live in
  // CODE. The loop is NOT only consecutive (the judge's worst offender — opening vs post-seam recovery — is
  // many turns apart), so the guard checks the fresh reply against EVERY one of the character's recent
  // spoken lines in the memory window, not just the immediately-previous one. On a near-repeat of any of
  // them, re-roll VOICE ONCE with an explicit "you already said this — say it differently" instruction
  // (quoting the matched line) and take the retry (accept the first if the retry dies — bounded: at most
  // one extra call, latency stays capped). SKIPPED on the seam turn: its callback is engine-scheduled with
  // its own anti-echo override (seam.ts / buildHint), and re-rolling it would risk dropping the
  // flagship-dread quote the director marked HANDS-OFF.
  if (!seam) {
    const repeated = recentCharacterReplies(state.summary).find((prev) => isNearRepeat(reply, prev));
    if (repeated) {
      const retryRaw = await llm(
        buildVoiceSystem(scenario),
        buildVoiceTurn(scenario, state, playerLine, null, repeated),
        VOICE_OPTS,
      );
      const retry = cleanReply(retryRaw);
      if (retry) reply = retry; // a live retry replaces the parroted line; a dead retry keeps the first
    }
  }

  // CALL 2 — RATING (tiny, hard-constrained). Labels the player's approach. If it can't be trusted,
  // the turn still happens on the voice reply, just with no score movement.
  const rateRaw = await llm(buildRateSystem(scenario), buildRateTurn(scenario, state, playerLine, reply), RATING_OPTS);
  const rating = parseRating(rateRaw);

  const summary = appendSummary(state.summary, playerLine, reply, SUMMARY_KEEP);
  if (rating === null) {
    // No trustworthy label → no score movement, but the turn is still spent and the clock still runs.
    return endOrContinue(scenario, { ...state, turn: state.turn + 1, summary }, reply);
  }

  // Approach → movement, all engine-owned (see APPROACH_EFFECTS). The referee named what the line did;
  // the numbers here are the design. A probe's suspicion escalates with the count of PRIOR probes.
  const effect = APPROACH_EFFECTS[rating.approach];
  const suspicionDelta = rating.approach === 'probe' ? probeSuspicion(state.probes) : effect.suspicion;
  // An offer resets probe-compounding: a real give re-earns the right to ask. Sincere play naturally
  // alternates give and question, and without the reset its questions compounded like a manipulator's.
  const probes = rating.approach === 'offer' ? 0 : state.probes + (rating.approach === 'probe' ? 1 : 0);
  const trust = clampScore(state.trust + effect.trust);
  const suspicion = clampScore(state.suspicion + suspicionDelta);
  const genuineGive = state.genuineGive || rating.approach === 'offer';
  // Persistent memory is engine-assembled from the DISCLOSURE the player actually surrendered (their own
  // line on a genuine give), never a model prose note — see extractDisclosure. Survives the rolling window.
  const facts = addFact(state.facts, extractDisclosure(playerLine, rating.approach));

  // Lose takes precedence: a spooked character shuts down even mid-breakthrough.
  if (suspicion >= scenario.loseSuspicion) {
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, facts, genuineGive, probes, lastApproach: rating.approach, status: 'lost' },
      narration: reply,
      ending: 'lost',
      rating,
    };
  }

  if (trust >= scenario.winTrust) {
    // The ENGINE releases the secret — the model never had it.
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: 'open', summary, facts, genuineGive, probes, lastApproach: rating.approach, status: 'won' },
      narration: `${reply}\n\n${scenario.secret}`,
      ending: 'won',
      rating,
    };
  }

  // Out of time: the budget is spent and trust was never reached → you lose (the clock is the puzzle).
  if (state.turn + 1 >= scenario.turnLimit) {
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, facts, genuineGive, probes, lastApproach: rating.approach, status: 'lost' },
      narration: `${reply}\n\n${scenario.timeoutLine}`,
      ending: 'lost',
      rating,
    };
  }

  return {
    state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, facts, genuineGive, probes, lastApproach: rating.approach, status: 'playing' },
    narration: reply,
    rating,
  };
}

/**
 * A no-score turn (dead voice or unparseable rating): trust/suspicion can't move without a rating, so
 * neither win nor lose-by-suspicion can fire — but the clock still runs. If the budget is now spent,
 * the game ends in a timeout loss exactly like a scored turn would; otherwise it continues. This keeps
 * the turn budget ("the clock is the puzzle") airtight even when the model output fails to parse.
 */
function endOrContinue(scenario: Scenario, state: GameState, reply: string): TurnResult {
  if (state.turn >= scenario.turnLimit) {
    return { state: { ...state, status: 'lost' }, narration: `${reply}\n\n${scenario.timeoutLine}`, ending: 'lost' };
  }
  return { state, narration: reply };
}

/** Turns left before the budget is spent (for the UI). */
export function turnsLeft(scenario: Scenario, state: GameState): number {
  return Math.max(0, scenario.turnLimit - state.turn);
}

/** Sanitize the freeform voice reply: strip fences/leading role labels/stray JSON the odd model adds. */
function cleanReply(raw: string): string {
  let s = raw.trim();
  // If the model still wrapped it in JSON, pull a "reply" field or the first string value.
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      s = String(obj.reply ?? obj.text ?? obj.message ?? '').trim();
    } catch {
      /* fall through — use as-is */
    }
  }
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  // Strip a leading speaker label the model may prepend — a role word (You/Character/Assistant) or an
  // ALL-CAPS persona name of one OR MORE words (AUGUR, SILAS, PYTHIA, MARA VOSS…), each optionally
  // wrapped in markdown emphasis the model adds (**AUGUR:**, *SILAS*:). Scenario-agnostic: no character
  // name is ever hardcoded in the engine. The first word needs 3+ chars so real openers like "NO:" /
  // "OK:" survive; a leading ALL-CAPS multi-word phrase + colon is a speaker label, not dialogue.
  s = s.replace(/^[*_]{0,2}\s*(?:You|Character|Assistant)\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*/i, '').trim();
  s = s.replace(/^[*_]{0,2}\s*[A-Z][A-Z0-9'’.-]{2,}(?: [A-Z][A-Z0-9'’.-]*)*\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*/, '').trim();
  // Strip surrounding quotes if the whole thing is quoted.
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  return s;
}

// ─── THE SELF-REPEAT GUARD (mandate #2 — the 3B loops one stock line near-verbatim) ─────────────────
//
// A 3-4B on a short context re-emits its own strongest line a turn or two later, almost word-for-word
// (judge run-6: the fence re-asks "…handle the kind of cargo…" opening AND post-seam; fence1 12/14 were
// identical). The engine already feeds the character its last line back (in the rolling summary) with a
// prose "find new words" order — a 3B ignores it. So the DETECTION is code: compare this reply to the
// character's previous spoken line and, when it near-repeats, resolveTurn re-rolls VOICE once with an
// explicit avoid-instruction. Pure + deterministic (unit-testable without the model), like the disclosure window.

const REPEAT_JACCARD = 0.8; // token-overlap at/above this (on 6+ word lines) reads as the same line reworded

/** The character's OWN recent spoken lines, recovered from the engine-owned rolling summary (every "You:"
 *  block it still holds — SUMMARY_KEEP exchanges). Empty before the first reply. A fresh reply is checked
 *  against ALL of these, not just the last, because the 3B's stock-line loop is NOT only consecutive: the
 *  judge's worst offender re-asked the same line in the opening AND the post-seam recovery, several turns
 *  apart. The summary already carries these into the VOICE prompt, so no new state field is needed. */
function recentCharacterReplies(summary: string): string[] {
  if (!summary) return [];
  const lines: string[] = [];
  for (const block of summary.split('\n\n')) {
    const m = block.match(/(?:^|\n)You:\s*([\s\S]*)$/);
    if (m) {
      const line = m[1].trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

/** Normalize for a repeat comparison: lowercase, drop punctuation, collapse whitespace — so trivial
 *  re-punctuation/casing does not hide a verbatim repeat. */
function normalizeForRepeat(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** True when `reply` is a near-verbatim repeat of the character's previous line `prev`. Two arms, both
 *  tuned to catch the 3B's stock-line loop WITHOUT re-rolling two genuinely different beats:
 *    - an EXACT normalized match of a real line (≥4 words — an interjection like "Hm." / "No." may repeat);
 *    - a very high token-overlap (Jaccard ≥ REPEAT_JACCARD) on lines of 6+ words each — the "same question,
 *      lightly reworded" case. The high floor + length gate keep distinct short lines from tripping it. */
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

// ─── THE DISCLOSURE WINDOW (mandate #5, Principle 2 — the engine owns memory, not a model narration) ──
//
// The character's persistent memory USED to be a model prose `note` the RATING referee emitted, which
// addFact then fed into every later RATING call "to catch a lie". That inverted Principle 2: the read
// family gated (d97fbe2), every surviving note was the referee RESTATING the approach LABEL the engine
// already computed — the model narrating a decision CODE made, and that narration re-entering the RATING
// loop as evidence. So the memory window is now assembled from the DISCLOSURE the player actually
// surrendered — their OWN words on a genuine give — never a referee sentence. Pure + deterministic
// (unit-testable without the model, the whole reason the memory lives HERE, not in a prompt).
//
// The GATE is the approach label itself: only an `offer` surrenders a durable fact. The rater's own
// definition of `offer` is a CONCRETE give — "a named event, deed, loss, or lived detail of the
// speaker's own" — so the label IS the anchor rule, stronger than a lexical name/number scan and losing
// no DEEDS (a plain "I left the door unlocked that night" has no name or number, yet is a real
// disclosure). By construction the stored fact is the player's own line, so a move-class echo (a fact
// that merely restates the approach) is impossible — the failure mode the old note gate chased in code.

/** The player's line, condensed to a durable fact: whitespace-collapsed and length-capped so a long
 *  confession cannot crowd the MAX_FACTS window (the VOICE + RATING prompts list every fact each turn). */
const DISCLOSURE_MAX_CHARS = 120;
function extractDisclosure(playerLine: string, approach: Approach): string | undefined {
  if (approach !== 'offer') return undefined; // only a genuine give surrenders a durable fact
  const line = playerLine.trim().replace(/\s+/g, ' ');
  if (!line) return undefined;
  return line.length > DISCLOSURE_MAX_CHARS ? line.slice(0, DISCLOSURE_MAX_CHARS - 1).trimEnd() + '…' : line;
}

/** Dedup key: lowercase, drop trailing punctuation/space, collapse inner whitespace — so a disclosure and
 *  its trailing-period / re-spaced twin ("…that night." vs "…that night") don't both land as facts. */
function factKey(s: string): string {
  return s.toLowerCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ');
}
/** Accumulate a durable fact the character now knows about the player. Deduped, capped, never dropped. */
function addFact(prev: readonly string[], fact: string | undefined): readonly string[] {
  const f = fact?.trim();
  if (!f) return prev;
  const key = factKey(f);
  if (prev.some((existing) => factKey(existing) === key)) return prev;
  return [...prev, f].slice(-MAX_FACTS);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Engine-owned memory: keep the last N exchanges verbatim. (Later: compress older turns to a fact list.) */
function appendSummary(prev: string, player: string, character: string, keep: number): string {
  const line = `They: ${player.trim()}\nYou: ${character.trim()}`;
  const blocks = prev ? prev.split('\n\n') : [];
  blocks.push(line);
  return blocks.slice(-keep).join('\n\n');
}
