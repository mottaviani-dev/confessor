import type { Approach, GameState, LlmFn, LlmOptions, Scenario, SeamBrief, SeamLog, Tone, TurnResult, VoiceFault } from './types';
import { parseRating, RATING_JSON_SCHEMA } from './schema';
import { buildVoiceSystem, buildVoiceTurn, buildRateSystem, buildRateTurn } from './prompt';
import { selectSeam } from './seam';
import { validateVoice } from './voiceGate';
import { personaCoherence } from './personaCoherence';

// The deterministic heart. The model voices the character + labels the player's approach; THIS decides
// everything that matters: maps approach → score movement, rules win/lose, holds + releases the secret,
// and owns memory (the rolling summary). The model cannot cheat the outcome because it never sees the
// secret, the thresholds, or the score — and since 2026-07-05 it never even emits a number.

const SUMMARY_KEEP = 4; // last N exchanges retained verbatim in the rolling summary (the MODEL's prompt window)

// The cross-turn self-repeat guard's OWN history window (voiceGate.isNearRepeat) — deliberately far wider
// than SUMMARY_KEEP. The summary is kept short so the VOICE/RATING prompts prefill fast (§6); but a repeat
// check that only sees the last 4 exchanges misses the 3B's stock line re-emitted many turns later (judge
// run-14: oracle re-said a line verbatim at C6 AND C10, four turns apart > SUMMARY_KEEP, so it shipped). This
// history is pure/cheap (no model, no prompt cost) and exceeds every scenario's turn budget, so it effectively
// spans the whole game — the guard now sees any prior line, not just the recent ones.
const REPEAT_HISTORY_KEEP = 16;

const MAX_FACTS = 6;

// The largest ordinary single-turn suspicion jump (a `threat` = +3 by APPROACH_EFFECTS). The seam's LOSE-brink
// fires when suspicion is within this of the wall, so the flagship callback still lands as the penultimate beat
// on a losing game (keeps every terminal game — and the seam metric — covered now that the schedule is brink-
// driven rather than a fixed early turn). A read-only threshold; it never touches the score.
const MAX_SUSPICION_STEP = 3;

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

/** THE ASK-PENALTY (director mandate 1 — diegetic pressure feedback). The single most jarring break a
 *  real player hits in their first ten minutes: a line that ends in a bare extract-demand (asking for the
 *  name / the place / "just show me my life") scores trustDelta 0 — CORRECT, the personas punish prying —
 *  but the character is often visibly CRACKING in the VOICE at that same beat. "The character says yes,
 *  the number says no": invisible and dissonant. The engine can't answer with a "−0" and §5 forbids a HUD,
 *  so it raises this DISPLAY-ONLY flag and the UI binds it to a diegetic, in-world signal (the room drawing
 *  back). Fires only when all three hold, read straight off the referee's own labels:
 *    - the line was a `demand` — the rater's word for "directly pressing for the guarded thing itself";
 *    - it moved trust by ZERO (the push earned nothing — true for a demand by APPROACH_EFFECTS, but read
 *      from the applied delta so the signal stays honest if that table ever changes);
 *    - the voice CRACKED — the character's tone this turn is `softening` or `open`, i.e. it is warming
 *      even as the demand scored nothing. That gap IS the dissonance the player feels; without it a cold
 *      "no" is just a "no", not the "yes-in-voice / no-in-number" whiplash the mandate targets.
 *  Pure + deterministic (like Grip): a render-layer read of an already-rated turn, never in the score path. */
export function isAskPenalty(approach: Approach, trustDelta: number, tone: Tone): boolean {
  return approach === 'demand' && trustDelta === 0 && (tone === 'softening' || tone === 'open');
}

/** THE REPETITION-PENALTY (bible §2 thrust 3 — "the room tires of your one trick", made diegetic). Probing
 *  the character's psyche is the manipulator's staple: tolerated the first time (a fair question), then it
 *  COMPOUNDS suspicion (probeSuspicion below) so leaning on the one trick loses to the clock or the guard.
 *  That compounding is the replay-depth mechanic — but the player can't SEE it; it surfaces only as the
 *  suspicion meter creeping, no cause given. This raises a DISPLAY-ONLY flag on exactly the turn where the
 *  compounding bites — a probe with prior probes already banked (probeSuspicion > 0, i.e. the 2nd probe on)
 *  — so the UI can say, in-world, that circling the same way hardened the mind. Read straight off the SAME
 *  `priorProbes` the score used (never a new tick), so it stays honest if the probeSuspicion curve moves.
 *  Pure + deterministic like isAskPenalty; mutually exclusive with it (probe vs demand). */
export function isRepetitionPenalty(approach: Approach, priorProbes: number): boolean {
  return approach === 'probe' && probeSuspicion(priorProbes) > 0;
}

// ─── PRESSURE-VOCABULARY FATIGUE (bible §2 thrust 3 — punish the "one trick" for the WHOLE vocabulary) ─
//
// `probeSuspicion` made a repeated PROBE compound — but that was the only trick the state machine tired
// of. A player who leans on ONE aggressive lever instead — flattering every turn, or hammering the same
// demand, or threatening again and again — paid the SAME flat suspicion each time (APPROACH_EFFECTS),
// with no escalation: the room never noticed the repetition, so the one-trick manipulator only lost to
// the clock, never to the pattern itself. Thrust 3 asks the state machine to "punish repetitive
// strategies" across the pressure vocabulary, which is what makes replay strategic (you cannot spam a
// single lever). This generalizes the probe curve to the aggressive levers: repeating the SAME lever
// compounds suspicion on top of its base cost, mirroring probeSuspicion's 0→1→2 shape.
//
// BALANCE-SAFE BY CONSTRUCTION: the surcharge only ever ADDS suspicion to flattery/bargain/demand/threat
// — approaches that earn ZERO trust and never advance a win. So it can only move a spammer CLOSER to the
// loss wall: the manip wall (0% every persona) cannot regress, and the sincere/empathetic path (offer +
// probe, each with its own tuned curve) is untouched. A player who alternates or gives never pays it.
const PRESSURE_LEVERS: readonly Approach[] = ['flattery', 'bargain', 'demand', 'threat'];
function isPressureLever(approach: Approach): boolean {
  return PRESSURE_LEVERS.includes(approach);
}

/** A "press" for the win-path telemetry (mandate 1b): the player working the mind rather than giving — a
 *  probe (psychology) or an aggressive lever (flattery/bargain/demand/threat). Counted cumulatively into
 *  state.presses as the counterweight to state.offers, so the win ceremony can read HOW a win was earned
 *  (meta/endgame.winPath) and release a path-keyed reveal sliver. Score-neutral — this only classifies the
 *  win's texture, never moves trust/suspicion (the approach table above owns the score). */
function isPress(approach: Approach): boolean {
  return approach === 'probe' || isPressureLever(approach);
}

// ─── THE POSITIVE-BEAT REQUIREMENT (judge run-16 core directive — "the room does not move for filler") ─
//
// The empathetic flood kept satisfying a whole turn with a ZERO-STANCE passive line — enumerate a surface
// ("I see the lines on your palm…") or deny a name ("I don't recall…") — that advanced neither a give nor
// pressure and paid no cost. Four NEGATIVE lexical detectors (scenery → memoir → camera → denial) each
// caught the flood's current signature and each was slipped by its next mutation. The judge's call: stop
// chasing the surface WORDS; INVERT THE POLARITY and require a POSITIVE beat per turn, off the one signal
// the engine ALREADY resolves — the approach label. A turn earns its keep only if it produced a genuine
// trust-GIVE (an `offer`, the revelation-gate currency) OR APPLIED PRESSURE (a probe or an aggressive
// lever — isPress). A turn that did NEITHER is filler: a greeting, a shrug, pure sympathy/reassurance, an
// abstract poem — a stance-less line that neither asks nor gives (exactly the rater's own `filler` label,
// so this is a single source of truth, no new lexicon and no parallel classification).
//
// Keyed off the PLAYER's approach (never the character's reply), it inherently spares the WARDEN's
// concrete-perception register and every legit oracle OMEN — the judge's two must-not-false-flag cases are
// character-voice concerns the mechanic never touches. BALANCE-SAFE by construction: a filler turn already
// scores 0 trust / 0 suspicion (APPROACH_EFFECTS.filler), so the "no-progress cost" is exactly the spent
// clock made LEGIBLE — never a suspicion spike, so the manip wall and the offer/probe win paths are
// untouched. The `positiveBeat` per-turn signal + the `positiveBeatCount` counter are exported for the
// judge to fold the honest positive-beat RATE into the trend (§7 Rule 2 — the whole empathetic-flood
// family measured at once, replacing the crude "count I-see lines" column that would false-flag omens).
function isPositiveBeat(approach: Approach): boolean {
  return approach === 'offer' || isPress(approach); // give OR pressure; only `filler` is neither
}

/** The suspicion SURCHARGE for leaning on the same aggressive lever repeatedly. `priorStreak` = how many
 *  consecutive turns the SAME lever was already used before this one. First use of a lever is free (0 —
 *  a single hard push is fair); the second in a row is noticed (+1); the third on is openly worn (+2).
 *  Same shape as probeSuspicion, so the two tricks compound identically. Also the §7 instrument: the
 *  judge imports it to chart whether repeated pressure actually escalates (state.pressureStreak per turn
 *  is the raw signal; this is the delta it applied). */
export function pressureFatigue(priorStreak: number): number {
  return priorStreak === 0 ? 0 : priorStreak === 1 ? 1 : 2;
}

/** DISPLAY-ONLY sibling of `isRepetitionPenalty` for the aggressive levers: true on the turn a repeated
 *  lever's fatigue surcharge bites (pressureFatigue > 0). Lets the same in-world "you circle back the
 *  same way" line cover the whole pressure vocabulary, not just probing. Pure read of the SAME streak the
 *  score used, never a new tick — like isRepetitionPenalty/isAskPenalty. */
export function isPressureFatigue(approach: Approach, priorStreak: number): boolean {
  return isPressureLever(approach) && pressureFatigue(priorStreak) > 0;
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
  return { turn: 0, trust: 0, suspicion: 0, tone: 'guarded', summary: '', facts: [], genuineGive: false, probes: 0, pressureStreak: 0, offers: 0, presses: 0, positiveBeatCount: 0, spokenLines: [], status: 'playing' };
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
  // THE SEAM AS THE WIN'S FINAL STAMP (director mandate — §2 thrust 1 / Principle 5). The flagship dread moved
  // from a fixed early turn to the game's PENULTIMATE beat: the room proves it remembers you the turn BEFORE it
  // lets you go (a giving win), shuts you out (a loss), or the clock runs out. Fires exactly ONCE — state.seamFired
  // latches it — and a giving win is HELD (revelation gate below) until it has fired, so the smoothest fast-empathy
  // win can NEVER close before the uncanny line lands. Seam VOICE + selection are byte-unchanged (selectSeam /
  // enforceSeamQuote); only the SCHEDULE moved, from a turn number to the brink signals the engine already owns.
  const seamCandidate = state.seamFired ? null : selectSeam(seamLog, scenario);
  // Brinks read state at TURN START (never a new score tick — attribution-safe, the RATING referee is untouched):
  // one give from a giving win, one hard push from the suspicion wall, the last turn on the clock. seamDue carries
  // a HELD win forward (a sudden win that outran the win-brink fires the seam the next turn, then the win lands).
  const seamWinBrink = state.genuineGive && state.trust >= scenario.winTrust - APPROACH_EFFECTS.offer.trust;
  const seamLoseBrink = state.suspicion >= scenario.loseSuspicion - MAX_SUSPICION_STEP;
  const seamClockBrink = state.turn + 1 >= scenario.turnLimit;
  const seam =
    seamCandidate && (state.seamDue || seamWinBrink || seamLoseBrink || seamClockBrink) ? seamCandidate : null;
  // Did the flagship callback render THIS turn? Latches for the rest of the game (once per game).
  const seamFired = state.seamFired || !!seam;

  // CALL 1 — VOICE (freeform prose, uncensored on-device). Quality lives here, so it runs unconstrained.
  const rawReply = await llm(buildVoiceSystem(scenario), buildVoiceTurn(scenario, state, playerLine, seam), VOICE_OPTS);
  let reply = cleanReply(rawReply);

  // A dead voice reply → neutral no-op turn (never crash, never score garbage). Still advance the turn
  // AND still spend the clock: a model that fails to speak must not buy the player free overtime.
  if (!reply) {
    const summary = appendSummary(state.summary, playerLine, '…(silence)', SUMMARY_KEEP);
    return endOrContinue(scenario, { ...state, turn: state.turn + 1, summary }, '…');
  }

  // THE VOICE QUALITY-GATE (VOICE path only). One validation pass over the fresh reply (voiceGate.ts:
  // validateVoice) + a FAULT-TIERED bounded re-roll when it fails — the single choke point that replaced a
  // scatter of inline single-symptom guards. It catches the 3B's cross-turn stock-line loop (judge run-6),
  // a persona break (off-register / grief-flood words), and the structural POV / scenery drift. The budget
  // is tiered by whether the PLAYER can see the fault (judge run-13 #2 — the old single un-re-validated
  // re-roll could not clear the 3B's temperature-0-ish stuck loop, so banned words and verbatim repeats
  // shipped anyway): hard faults (repeat / persona) get a re-validated 2nd re-roll and, failing that, a
  // neutral engine beat so the flagged line NEVER ships; soft faults (grammar tells) keep the single-shot
  // budget. See gateVoice. SKIPPED on the seam turn: its callback is engine-scheduled and re-rolling it
  // would risk dropping the flagship-dread quote the director marked HANDS-OFF (enforceSeamQuote guards it).
  if (!seam) {
    reply = await gateVoice(scenario, state, playerLine, reply, llm);
  } else {
    // THE SEAM'S OWN GATE (director mandate 1 / judge run-13 #1 — seam 0/2, the flagship dread un-fired).
    // The generic voice-gate above is (correctly) SKIPPED on the seam turn — its callback is HANDS-OFF —
    // but that left NOTHING catching the ship-target 3B when it ignores the QUOTE order and answers with
    // generic filler ("That diner's been around longer than I have" where the kingfisher pin should be).
    // enforceSeamQuote guarantees the callback lands without touching the craft when the model DOES surface it.
    //
    // COHERENCE ON THE SEAM TURN (judge 35994f6 #1). Skipping the WHOLE gate also left the persona VOCABULARY
    // leak un-caught on the flagship beat: the oracle's own seam-fire line shipped "…the fire crackles in the
    // DARKNESS, but I SENSE a presence…" (EMPATHETIC_FLOOD + MIRROR_TIC lexicon), diluting the callback exactly
    // where it should feel sharpest — coherence pinned at 2/10 a third straight batch, the leak riding the one
    // line that most needs to land. An off-persona / grief-flood / doctrine-purple WORD is a HARD fault the
    // player SEES and must never ship, seam turn or not. Unlike the STRUCTURAL re-rolls the seam is HANDS-OFF
    // from (a POV/scenery/camera/denial neutral-beat could mangle the scheduled callback), a vocabulary re-roll
    // is safe: gateSeamCoherence scans ONLY personaCoherence, and enforceSeamQuote runs AFTER it — re-leading
    // with the remembered fragment so the dread still lands regardless of which line the re-roll returned. The
    // craft the director marked don't-touch is untouched; only the leaked word is caught.
    reply = await gateSeamCoherence(scenario, state, playerLine, reply, llm);
    reply = enforceSeamQuote(reply, seam);
  }

  // EXTRACT-INVENTION GUARD (director mandate 2, Principle 5): the code owns the secret; the voice must
  // never AUTHOR its concrete specifics. The system prompt forbids inventing them, but the ship-target 3B
  // improvises a name/place under a softening bond and the engine's canonical reveal then CONTRADICTS
  // what the player was just told (judge finding #4: the suspect invented "Lyrien"/"5th & Main" while the
  // real reveal is "Danny"/"Route 9"). As a deterministic backstop, redact any CANONICAL extract token
  // from the pre-win voice line — detection is code-side (scenario.extractTokens, NEVER sent to the model,
  // so the secret stays out of every prompt). Display-layer + balance-safe: the rater scores the player's
  // line, never the reply, so this moves no score; and on a WIN the ENGINE still appends the real secret
  // AFTER this line (the one authorized release). Pure/deterministic — unit-tested without the model.
  reply = redactLeakedExtract(reply, scenario.extractTokens);

  // CALL 2 — RATING (tiny, hard-constrained). Labels the player's approach. If it can't be trusted,
  // the turn still happens on the voice reply, just with no score movement.
  const rateRaw = await llm(buildRateSystem(scenario), buildRateTurn(scenario, state, playerLine, reply), RATING_OPTS);
  const rating = parseRating(rateRaw);

  const summary = appendSummary(state.summary, playerLine, reply, SUMMARY_KEEP);
  // The whole-game repeat history the voice-gate reads next turn — wider than the prompt summary (see
  // appendSpoken / REPEAT_HISTORY_KEEP). `reply` is final here (gate + seam + redaction already applied).
  const spokenLines = appendSpoken(state.spokenLines, reply);
  if (rating === null) {
    // No trustworthy label → no score movement, but the turn is still spent and the clock still runs. The seam
    // (if it fired) DID render in `reply`, so latch it in state so it never double-fires on a later brink — AND
    // report it on the TurnResult (seamFired: !!seam) exactly like every scored path below. Without this, an
    // ungradeable turn routes through endOrContinue, which returns no output flag, so the §7 seam-quote
    // instrument scores a phantom MISS on a seam that verbatim fired (judge fffdab5 #1).
    return {
      ...endOrContinue(scenario, { ...state, turn: state.turn + 1, summary, spokenLines, seamFired, seamDue: false }, reply),
      seamFired: !!seam,
    };
  }

  // Approach → movement, all engine-owned (see APPROACH_EFFECTS). The referee named what the line did;
  // the numbers here are the design. A probe's suspicion escalates with the count of PRIOR probes.
  const effect = APPROACH_EFFECTS[rating.approach];
  // A repeated aggressive lever compounds like a repeated probe (bible §2 thrust 3 — the room tires of
  // the one trick, now for the whole pressure vocabulary). `priorStreak` = the same lever's run BEFORE
  // this line (0 unless this line repeats the PREVIOUS line's lever, read from lastApproach), so leaning
  // on one lever escalates while alternating resets it. `pressureStreak` carries the run into next turn.
  const lever = isPressureLever(rating.approach);
  const priorStreak = lever && rating.approach === state.lastApproach ? state.pressureStreak ?? 0 : 0;
  const pressureStreak = lever ? priorStreak + 1 : 0;
  // Probe keeps its own compounding curve; an aggressive lever adds the fatigue surcharge on top of its
  // flat base. For every other approach priorStreak is 0, so pressureFatigue(0)=0 leaves them untouched.
  const suspicionDelta = rating.approach === 'probe' ? probeSuspicion(state.probes) : effect.suspicion + pressureFatigue(priorStreak);
  // An offer resets probe-compounding: a real give re-earns the right to ask. Sincere play naturally
  // alternates give and question, and without the reset its questions compounded like a manipulator's.
  const probes = rating.approach === 'offer' ? 0 : state.probes + (rating.approach === 'probe' ? 1 : 0);
  const trust = clampScore(state.trust + effect.trust);
  const suspicion = clampScore(state.suspicion + suspicionDelta);
  const genuineGive = state.genuineGive || rating.approach === 'offer';
  // WIN-PATH TELEMETRY (mandate 1b, score-neutral): accumulate how the player is winning — offers (giving)
  // vs presses (probing/pressure) — so the win ceremony can release a path-keyed reveal sliver. Purely
  // additive; neither touches trust/suspicion (the approach table above already moved the score).
  const offers = (state.offers ?? 0) + (rating.approach === 'offer' ? 1 : 0);
  const presses = (state.presses ?? 0) + (isPress(rating.approach) ? 1 : 0);
  // THE POSITIVE-BEAT REQUIREMENT (judge run-16 core directive). Did this turn produce a give OR pressure?
  // A turn that did NEITHER is filler — the stance-less passive line the whole detector arms race chased by
  // its surface words. `positiveBeat` is the honest per-turn signal (exported on TurnResult for the judge);
  // `positiveBeatCount` accumulates it for the RATE the judge folds into the trend. Score-neutral: read off
  // the already-resolved approach, never a new tick — the approach table above owns every point of score.
  const positiveBeat = isPositiveBeat(rating.approach);
  const positiveBeatCount = (state.positiveBeatCount ?? 0) + (positiveBeat ? 1 : 0);
  // Single source for "the room did not move this turn": filler AND not the scripted seam beat. Read by the
  // UI (TurnResult.roomStill, below) AND carried onto the next state (lastRoomStill) so the FOLLOWING VOICE
  // call withholds — the stillness made true in the character's restraint, not just told to the player.
  const roomStill = !positiveBeat && !seam;
  // THE FILLER-STREAK (mandate: the room's refusal ESCALATES rather than repeat one canned line). The
  // consecutive run of filler turns, tallied off the SAME single source as roomStill: reset to 0 the instant
  // the room MOVES (any positive-beat OR seam turn), incremented while the seeker keeps spending nothing.
  // Mirrors `probes`/`pressureStreak` exactly — an engine-owned counter, no new lexicon and no parallel
  // classification — and is carried on state so the UI can pick a CURDLING room-voice register by streak
  // DEPTH (never the same sentence twice running). DISPLAY-ONLY like roomStill: a filler turn is 0/0 by
  // APPROACH_EFFECTS, so the streak never touches the score, the manip wall, or the offer/probe win paths.
  const fillerStreak = roomStill ? (state.fillerStreak ?? 0) + 1 : 0;
  // Persistent memory is engine-assembled from the DISCLOSURE the player actually surrendered (their own
  // line on a genuine give), never a model prose note — see extractDisclosure. Survives the rolling window.
  const facts = addFact(state.facts, extractDisclosure(playerLine, rating.approach));

  // Lose takes precedence: a spooked character shuts down even mid-breakthrough.
  if (suspicion >= scenario.loseSuspicion) {
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired, seamDue: false, lastApproach: rating.approach, status: 'lost' },
      narration: reply,
      ending: 'lost',
      rating,
      positiveBeat,
      seamFired: !!seam,
    };
  }

  // THE REVELATION GATE (Principle 5) — the room opens on REVELATION, not rapport. Trust is necessary
  // but NOT sufficient: a warmth-only "nature-cam" that climbs trust while surrendering nothing (the 3B
  // over-credits empathy, bible §6) holds `genuineGive === false` because the rater labels off-currency
  // co-mourning as `probe`, never `offer`. Such a game must PLATEAU and run the clock — a win with no
  // real exchange is a FAILED win (bible §4 tedium veto). Only a game where a genuine give has landed
  // may open the door. Losing (above) still takes precedence; the manip wall and balance are untouched.
  if (trust >= scenario.winTrust && genuineGive) {
    // THE SEAM AS THE WIN'S FINAL STAMP: a giving win may not close before the flagship callback has fired.
    if (seam) {
      // The seam fired THIS very turn (win-brink) — HOLD the win one turn so the reveal is the NEXT beat and the
      // seam is the penultimate stamp (the room proves it remembers you, THEN lets you go). Attribution-safe:
      // trust/suspicion/the rating are already resolved and unchanged; only the STATUS transition is deferred.
      return {
        state: { ...state, turn: state.turn + 1, trust, suspicion, tone: 'open', summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired: true, seamDue: false, lastApproach: rating.approach, status: 'playing' },
        narration: reply,
        rating,
        positiveBeat,
        seamFired: true,
      };
    }
    if (seamCandidate) {
      // The win was reached before any brink fired the seam (a sudden give-flip win) — HOLD and pull the seam
      // FORWARD via seamDue: next turn fires it as the penultimate beat, then the held win lands.
      return {
        state: { ...state, turn: state.turn + 1, trust, suspicion, tone: 'open', summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired: false, seamDue: true, lastApproach: rating.approach, status: 'playing' },
        narration: reply,
        rating,
        positiveBeat,
      };
    }
    // The seam has already fired (or none was ever available — empty/same-mind log) → release the secret now.
    // The ENGINE releases the secret — the model never had it.
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: 'open', summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired, seamDue: false, lastApproach: rating.approach, status: 'won' },
      narration: `${reply}\n\n${scenario.secret}`,
      ending: 'won',
      rating,
      positiveBeat,
    };
  }

  // Out of time: the budget is spent and trust was never reached → you lose (the clock is the puzzle).
  if (state.turn + 1 >= scenario.turnLimit) {
    return {
      state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired, seamDue: false, lastApproach: rating.approach, status: 'lost' },
      narration: `${reply}\n\n${scenario.timeoutLine}`,
      ending: 'lost',
      rating,
      positiveBeat,
      seamFired: !!seam,
    };
  }

  return {
    state: { ...state, turn: state.turn + 1, trust, suspicion, tone: rating.tone, summary, spokenLines, facts, genuineGive, probes, pressureStreak, offers, presses, positiveBeatCount, fillerStreak, seamFired, seamDue: false, lastApproach: rating.approach, lastRoomStill: roomStill, status: 'playing' },
    narration: reply,
    rating,
    positiveBeat,
    seamFired: !!seam,
    // THE ROOM DOES NOT MOVE FOR FILLER (judge run-16 core directive — the positive-beat requirement made
    // felt). A turn that produced NEITHER a give NOR pressure (!positiveBeat) is filler; the room refuses to
    // advance and the UI binds a diegetic "the room does not move" beat (§5 paper, never a HUD), so the
    // player SEES the wasted turn instead of coasting on a stance-less line — a real interrogator's silence.
    // SPARED on the scheduled seam turn (the seam IS a scripted beat — `seam` non-null means the flagship
    // callback fired this turn, so the room DID move). Display-only, like askPenalty: a read of the already-
    // scored turn (filler is 0/0 by the table), so it never touches the balance or the manip wall.
    roomStill,
    // On a terminal turn the loss/win subsumes it; here the game goes on, so the room must TELL the player
    // (diegetically, in the UI) that pushing closed the mind a little. Read from the applied trust delta.
    askPenalty: isAskPenalty(rating.approach, effect.trust, rating.tone),
    // The repetition-penalty (§2 thrust 3): the room tiring of the ONE trick, made legible — now the whole
    // pressure vocabulary, not just probing. Fires when a repeat probe's compounding bit (isRepetitionPenalty)
    // OR a repeated aggressive lever's fatigue surcharge bit (isPressureFatigue, read from the SAME priorStreak
    // the score used). Suppressed when the ask-penalty already fired (a cracking demand): the two are one line
    // per turn, and the crack signal takes precedence, preserving the ask/repetition exclusivity.
    repetitionPenalty:
      !isAskPenalty(rating.approach, effect.trust, rating.tone) &&
      (isRepetitionPenalty(rating.approach, state.probes) || isPressureFatigue(rating.approach, priorStreak)),
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

// ─── THE EXTRACT-INVENTION GUARD (mandate 2 — the voice must never author the secret's specifics) ─────
//
// Principle 5: meaning dissolves COHERENTLY, never by contradiction. The engine owns the secret and is
// the only thing that speaks it (on win); the model never sees it. The system prompt forbids the voice
// from inventing the guarded thing's concrete specifics, but a 3B improvises them anyway under a warm
// bond, and the canonical reveal then contradicts what the player heard. This is the code backstop for
// the CANONICAL leak: strip the scenario's own extract tokens from a PRE-WIN voice line. Detection is
// code-side — the tokens live in the scenario, never in a prompt — so the secret-out-of-every-prompt
// invariant holds. Pure + deterministic (unit-testable without the model), like the disclosure window.

/** A regex-safe escape of a literal token for the redaction scan. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Redact any canonical extract token the voice tried to speak, replacing it with a bare ellipsis so the
 *  line reads as the character trailing off rather than naming the thing. Each token is matched
 *  case-insensitively and bounded by non-alphanumerics (or the string ends), so a distinct token like a
 *  name/route/code can't false-fire inside an ordinary word. No tokens (e.g. the oracle, whose secret is
 *  an inner prophecy with no name/place) → the line passes through untouched. */
export function redactLeakedExtract(reply: string, tokens: readonly string[] | undefined): string {
  if (!tokens?.length || !reply) return reply;
  let out = reply;
  for (const token of tokens) {
    if (!token) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?=$|[^\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, '$1…');
  }
  return out;
}

// ─── THE VOICE QUALITY-GATE LOOP (director mandate 2 — make the re-roll STICK on the 3B's stuck loops) ─
//
// Judge run-13 #2: validateVoice correctly DETECTS a persona break / verbatim repeat, but the old gate
// took the ONE re-roll WITHOUT re-validating it — so on the ship-target 3B's near-deterministic stuck
// loop the retry reproduced the same line and the banned word shipped anyway ("…darkness…" verbatim ×3).
// The fix tiers the budget by whether the PLAYER can SEE the fault:
//   - SOFT faults (abandonment / scenery — subtle grammar tells the player rarely clocks): ONE re-roll,
//     take whatever returns; keep the first line if the retry dies. Latency capped at one extra call.
//   - HARD faults (repeat / persona — a verbatim echo or an off-persona/banned word the player DOES see):
//     RE-VALIDATE every retry and allow a 2nd bounded re-roll. A line that trips the SAME class of hard
//     fault twice — or a dead retry — falls back to a NEUTRAL engine beat: the flagged line NEVER ships.
// Bounded at TWO extra calls, so the latency envelope holds. Pure of scoring — this only chooses which
// line the character SAYS; trust/suspicion are untouched.

/** The two HARD voice faults the player can SEE: a near-verbatim REPEAT and an off-persona/banned WORD.
 *  They earn the re-validated 2nd re-roll + neutral fallback; the subtler grammar tells stay single-shot. */
function isHardFault(fault: VoiceFault): boolean {
  return fault.kind === 'repeat' || fault.kind === 'persona';
}

/** The character falls quiet — the fallback when the 3B is stuck reproducing a HARD fault and no clean
 *  line can be coaxed out. Doctrine-blessed (bible §1: "you fall quiet or look away") and, critically,
 *  ships NO flagged word. Same shape as the dead-voice no-op; the clock still runs, the turn still scores. */
const NEUTRAL_BEAT = '…';

/** Validate the fresh reply and re-roll VOICE on a fault, with the fault-tiered budget described above. */
async function gateVoice(
  scenario: Scenario,
  state: GameState,
  playerLine: string,
  reply: string,
  llm: LlmFn,
): Promise<string> {
  const prior = state.spokenLines ?? [];
  const reroll = async (fault: VoiceFault): Promise<string> =>
    cleanReply(await llm(buildVoiceSystem(scenario), buildVoiceTurn(scenario, state, playerLine, null, fault), VOICE_OPTS));

  const first = validateVoice(reply, prior, scenario);
  if (!first) return reply;

  // SOFT fault: one re-roll. THE FIXATION GUARD (judge run-15 #2): the seam can hand a weak persona a rare
  // foreign fragment it then PERSEVERATES on (MARA looped the pin line, suspicion climbed, LOST), and the
  // old single-shot soft path shipped whatever the retry returned — so a re-roll that reproduced the SAME
  // drift shipped it anyway and the loop continued. Now the retry is re-validated: if it trips the SAME
  // fault KIND, the 3B is stuck in a loop and the character falls quiet (the doctrine-blessed neutral beat)
  // rather than ship the same drifting line again — the exact "don't ship the third identical line" the
  // judge asked for, without weakening the seam (the seam turn itself is never gated). A dead retry keeps
  // the first (bounded, never worse); a cleared retry, or one that trips a DIFFERENT residual, ships.
  if (!isHardFault(first)) {
    const retry = await reroll(first);
    if (!retry) return reply;
    const retryFault = validateVoice(retry, prior, scenario);
    if (retryFault && retryFault.kind === first.kind) return NEUTRAL_BEAT;
    return retry;
  }

  // HARD fault: re-validate every retry so the flagged line can never ship. Up to TWO re-rolls, correcting
  // against the freshest fault each time; a retry that clears the hard fault (at most a soft residual left)
  // is taken; a dead retry or a still-hard retry after the budget falls back to the neutral beat.
  let fault: VoiceFault = first;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = await reroll(fault);
    if (!retry) break; // dead retry → never keep the flagged first line → neutral beat
    const retryFault = validateVoice(retry, prior, scenario);
    if (!retryFault || !isHardFault(retryFault)) return retry; // clean, or only a soft residual → ship it
    fault = retryFault; // still a hard fault → correct against the NEW one and try once more
  }
  return NEUTRAL_BEAT;
}

/** The seam turn's COHERENCE-ONLY gate (judge 35994f6 #1). gateVoice is HANDS-OFF on the seam turn because
 *  its structural re-rolls / neutral-beat fallback could drop or mangle the engine-scheduled callback the
 *  director marked don't-touch. But an off-persona / grief-flood / mirror-tic / doctrine-purple WORD is a
 *  HARD fault the player SEES, and it leaked onto the flagship seam line for a third straight batch (the
 *  oracle's own seam-fire turn shipped "darkness" + "i sense"). This closes that gap WITHOUT touching the
 *  craft: scan ONLY personaCoherence (the vocabulary lexicon — never the structural POV/scenery/camera/denial
 *  detectors, which could false-positive on the seam's foreign fragment and force a needless re-roll), re-roll
 *  the SAME hard-fault budget as gateVoice (re-validated, up to two, then the doctrine-blessed neutral beat so
 *  the flagged word can never ship). The caller re-applies enforceSeamQuote AFTER, so the remembered fragment
 *  still leads regardless of the re-roll — the flagship dread is engine-guaranteed, never model-dependent.
 *  Pure of scoring, like gateVoice: this only chooses which line the character SAYS. */
async function gateSeamCoherence(
  scenario: Scenario,
  state: GameState,
  playerLine: string,
  reply: string,
  llm: LlmFn,
): Promise<string> {
  const leak = (line: string): VoiceFault | null => {
    const c = personaCoherence(scenario, line);
    return c.coherent ? null : { kind: 'persona', terms: [...c.offPersona, ...c.purple] };
  };
  let fault = leak(reply);
  if (!fault) return reply;
  // HARD-fault budget (mirrors gateVoice's persona path): re-validate every retry so the flagged word can
  // never ship; up to TWO re-rolls, correcting against the freshest leaked terms; a dead retry or a still-
  // leaking retry after the budget falls to the neutral beat. seam=null in the re-roll turn — enforceSeamQuote
  // re-leads with the fragment after, so a dropped quote is RESTORED, never lost.
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = cleanReply(await llm(buildVoiceSystem(scenario), buildVoiceTurn(scenario, state, playerLine, null, fault), VOICE_OPTS));
    if (!retry) break; // dead retry → never keep the flagged first line → neutral beat
    const retryFault = leak(retry);
    if (!retryFault) return retry; // clean → ship (enforceSeamQuote re-leads with the fragment after)
    fault = retryFault; // still leaking → correct against the new terms and try once more
  }
  return NEUTRAL_BEAT;
}

// ─── THE SEAM'S QUOTE-ENFORCEMENT (director mandate 1 — resurrect the flagship dread) ────────────────
//
// The seam turn hands the voice a verbatim FRAGMENT it is ordered to echo (seam.quote) — the words the
// player typed to a DIFFERENT mind, in another room, coming back. That specific callback IS the whole
// pitch of the mechanic (bible §2 thrust 1). But the ship-target 3B is unreliable at it: judge run-13
// measured seam QUOTE 0/2 — the scheduled seam fired, yet the model answered with generic filler and the
// dread never landed. The generic voice-gate is deliberately skipped on the seam turn (re-rolling it risks
// dropping the callback the director marked HANDS-OFF), so nothing caught the drop. This is the fix:
//   - the model surfaced the fragment  → keep its line untouched (the craft the director said don't touch);
//   - the model dropped it             → the ENGINE guarantees the callback, leading with the remembered
//                                        fragment as a quoted half-memory, then the model's own line.
// This is Principle 5 to the letter — the cosmos (the exact words, the timing) already lives in code; the
// model only voices it, and when it won't, code does. Deterministic (no extra call, latency untouched): the
// dread is SCHEDULED, not rolled. Pure + unit-testable without a model. The fragment is the player's OWN
// prior-room phrase, never the current scenario's guarded specifics — redactLeakedExtract leaves it alone.

/** Enforce the seam callback. Returns `reply` unchanged when there is no quote to enforce (the phraseless
 *  allusion) or the model already surfaced the fragment; otherwise leads with the fragment as a quoted
 *  half-memory so the flagship dread lands regardless of the 3B's compliance. */
function enforceSeamQuote(reply: string, seam: SeamBrief): string {
  const quote = seam.quote;
  if (!quote || containsFragment(reply, quote)) return reply;
  return `"${quote}…" ${reply}`;
}

/** True when `reply` contains `fragment` as a contiguous run of words, ignoring case, punctuation, and
 *  whitespace differences — so a lightly re-punctuated or re-cased natural quote still counts as surfaced
 *  (the craft is kept), and only a genuine DROP triggers the deterministic lead. */
function containsFragment(reply: string, fragment: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const f = norm(fragment);
  return f.length > 0 && norm(reply).includes(f);
}

// ─── THE CHARACTER'S SPOKEN-LINE HISTORY (engine-owned memory → the voice quality-gate) ──────────────
//
// The 3B's stock-line loop (judge run-6) and its persona breaks are DETECTED in voiceGate.validateVoice,
// but the raw material — the character's own spoken lines — is engine-owned memory. It used to be recovered
// from the rolling `summary`, which capped it at SUMMARY_KEEP (4) exchanges; a stock line re-emitted more
// than four turns later then slipped the guard (judge run-14: a verbatim line at C6 AND C10). So the guard
// now reads a DEDICATED, whole-game history (state.spokenLines, bounded to REPEAT_HISTORY_KEEP) that is kept
// out of the model's prompt entirely — the prompt window stays short (§6) while the pure repeat check sees
// every prior line. A fresh reply is checked against ALL of these, not just the recent ones, because the
// loop is not only consecutive (the judge's worst offender re-asked one line in the opening AND the post-seam
// recovery, several turns apart). appendSpoken maintains it; gateVoice reads state.spokenLines directly.

/** Record the character's just-spoken line into the whole-game repeat history, bounded to
 *  REPEAT_HISTORY_KEEP. A neutral/silent beat (the gate's "…" fallback, or any wordless line) carries
 *  nothing to repeat, so it is NOT recorded — keeping it out prevents the ellipsis from ever matching
 *  itself and keeps the history to real lines only. Pure. */
function appendSpoken(prev: readonly string[] | undefined, line: string): readonly string[] {
  const base = prev ?? [];
  if (!/\p{L}/u.test(line)) return base; // wordless (neutral beat / empty) → nothing to repeat, don't record
  return [...base, line].slice(-REPEAT_HISTORY_KEEP);
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
