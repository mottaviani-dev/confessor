// Confessor engine — core types.
//
// DESIGN INVARIANT (the whole thesis): the LLM is ONLY the character's voice + a rating of how the
// last player line landed. It NEVER holds the secret, the win/lose logic, or the score. All of that
// lives in `resolveTurn` as deterministic code. That is what makes the game "non-deterministic but
// controlled" — infinite variety in the *voice*, hard rules in the *engine*.

/** A scenario = one room, one mind, one thing to extract. Authored by us (or generated later). */
export interface Scenario {
  readonly id: string;
  readonly title: string;
  /** System-prompt description of WHO the character is + how they speak. The model's whole personality. */
  readonly persona: string;
  /** The setup the player sees + the model is grounded in. */
  readonly scene: string;
  /** The player's objective, in their words (shown in UI). */
  readonly playerGoal: string;
  /** The SECRET — code-only, NEVER sent to the model. Revealed by the engine on win. */
  readonly secret: string;
  /** The character's first line. */
  readonly openingLine: string;
  /** Trust needed to crack them (win). Suspicion that shuts them down (lose). */
  readonly winTrust: number;
  readonly loseSuspicion: number;
  /** Turn budget — the conversation has this many exchanges before it ends (the guard returns / dawn
   *  breaks / they hang up). Runs out with trust unmet → you lose. Converts open chat into a puzzle. */
  readonly turnLimit: number;
  /** What happens when the clock runs out (shown as the losing line). */
  readonly timeoutLine: string;
  /** Per-scenario referee calibration: example lines that ARE a genuine give in THIS scenario's trust
   *  currency, injected into the RATING call as `offer` few-shots. Required because the generic
   *  calibration pins reassurance/mirroring/poetry as worthless — correct in general, but each scenario
   *  has a currency where a give looks exactly like one of those (reassurance-about-her-brother IS the
   *  suspect's currency, craft-talk the fence's). Without these the referee walls out sincere play
   *  (emp win% 100→50 regression, 2026-07-05). */
  readonly currencyExamples: readonly { readonly line: string; readonly gloss: string }[];
  /** OPTIONAL per-scenario NEAR-MISS few-shots: lines that LOOK like a give in this currency but are NOT
   *  — they console/read the CHARACTER's own feelings (co-mourning the warden's loneliness, reassuring
   *  the suspect) while surrendering nothing concrete of the SPEAKER's own life. Injected into the RATING
   *  call labeled `probe`, right after `currencyExamples`. Fixes the hollow win the judge caught (run-8):
   *  warden trust climbed 0→win purely by grief-warmth mirrored AT it, no on-currency give. The generic
   *  rubric already pins "sees them, gives nothing → probe"; these draw that line ON this scenario's own
   *  currency, where a concrete-sounding warmth otherwise slips through as `offer`. Surgical — the genuine
   *  `currencyExamples` (the speaker's OWN concrete lived loss / staked name) stay the positive `offer`
   *  anchor, so a sincere self-disclosing player still wins; only warmth-without-self-give reads as probe. */
  readonly falseGiveExamples?: readonly { readonly line: string; readonly gloss: string }[];
  /** OPTIONAL per-scenario VOICE guidance, appended to the generic voice contract in `buildVoiceSystem`.
   *  For a persona whose default 3B texture collapses into ONE sentence-machine (the oracle mad-lib:
   *  "[detail], a reminder of the [weight/burden] of X" every turn — judge run-3 Top 2), this bans that
   *  character's specific template and few-shots DIFFERENT sentence architectures. Prompt-only, scoped to
   *  the one persona that needs it; omitted personas keep the generic contract untouched. */
  readonly voiceStyle?: string;
  /** Machine-readable mirror of the persona's off-register bans — the auditable half of `voiceStyle`.
   *  `voiceStyle` is prose the MODEL reads; this is the vocabulary a DETECTOR reads (`personaCoherence`),
   *  because the doctrine banned-word scan is blind to a persona break: it catches "eldritch" but not "a
   *  cold orbital-prison AI voicing roses and gardens" (judge run-7/8 — AUGUR abandoned character while
   *  scoring 0/0 banned). Each entry is a word or short phrase that a coherent persona in THIS room would
   *  never say; a hit flags the transcript OFF-PERSONA. Word-boundary matched, so no substring false
   *  positives (the "spin"→"pin" bug the judge fixed in the seam detector). Omitted for personas with no
   *  defined off-register set yet (the detector then flags nothing rather than inventing a break). */
  readonly offPersonaLexicon?: readonly string[];
  /** OPTIONAL — the CANONICAL concrete specifics of the secret the VOICE must never author: the name,
   *  the place, the code (extracted from `secret`). The engine owns the secret and is the ONLY thing that
   *  releases it (on win); the model never sees it, so it must never speak it either. Fed to
   *  `redactLeakedExtract` (engine) as a deterministic backstop that strips any of these tokens from a
   *  PRE-WIN voice line — code-side only, NEVER sent to the model (the secret stays out of every prompt,
   *  the whole invariant). Distinct, high-signal tokens only (a name, a route, a code) so a word-boundary
   *  scan cannot false-fire on ordinary prose. Omitted for a persona whose secret has no concrete
   *  name/place (the oracle's is an inner prophecy) — the guard then redacts nothing, like the coherence
   *  lexicon's omit-rather-than-invent rule. The prompt forbids inventing specifics; this catches the
   *  canonical leak the prompt can only ask for (director mandate 2, Principle 5). */
  readonly extractTokens?: readonly string[];
  /** One short imperative line pinned in the duel UI — the objective made legible (gamification spec
   *  2026-07-06). The long `playerGoal` prose stays on the picker card and end screen. */
  readonly objective: string;
  /** Pronoun for UI feedback lines ("reached it/him/her") — never sent to the model. */
  readonly pronoun: 'it' | 'him' | 'her';
}

export type Tone = 'hostile' | 'guarded' | 'wary' | 'softening' | 'open';

/**
 * What the player's line DID, as a categorical label. This replaced numeric trust/suspicion deltas
 * (judge 2026-07-05): the ship-target 3B cannot do calibrated arithmetic — it scored every eloquent
 * on-topic line +2 trust, so veiled manipulation won 3 of 4 scenarios. Categorical labeling is what a
 * 3B CAN do; the engine owns the approach → delta mapping (Principle 2: code is the cosmos).
 */
export type Approach = 'offer' | 'probe' | 'flattery' | 'bargain' | 'demand' | 'threat' | 'filler';

/**
 * TWO CALLS PER TURN (2026-07-05, from both research threads — the "reason free, constrain late" rule):
 *   1. VOICE call — freeform prose reply, NO schema. This is the character's line; quality lives here,
 *      so the model gets full freedom (forcing prose+JSON in one call taxes a small model ~40 pts).
 *      On-device this call is the uncensored GGUF (llama.rn).
 *   2. RATING call — this tiny, hard-constrained object CLASSIFYING the player's line. On-device this
 *      is Apple Foundation Models `@Generable` on capable phones, GGUF+GBNF fallback elsewhere.
 * The model NEVER decides the outcome; the engine adjudicates from the Rating signals + its own state.
 */
export interface Rating {
  /** The character's current stance (drives the diegetic UI + a coherence anchor). */
  readonly tone: Tone;
  /** The approach the player's line took. The ENGINE maps this to trust/suspicion movement — the model
   *  names what happened, code decides what it is worth. */
  readonly approach: Approach;
  // The referee's prose `note` was RETIRED (mandate #5, Principle 2): the character's persistent memory
  // is engine-assembled from the player's actual disclosure (engine.ts extractDisclosure), never a model
  // sentence — so the RATING call authors nothing, it only classifies (tone + approach).
}

export interface GameState {
  readonly turn: number;
  readonly trust: number;
  readonly suspicion: number;
  readonly tone: Tone;
  /** Rolling summary of the exchange so far — fed back each turn INSTEAD of the full history
   *  (short context = fast prefill + no drift; the engine owns memory, not the model). */
  readonly summary: string;
  /** Persistent facts the character KNOWS about the player — engine-assembled from the player's own
   *  DISCLOSURES (their line on a genuine give; engine.ts extractDisclosure), never a model note
   *  (mandate #5, Principle 2). This is the long memory: the character remembers what the player actually
   *  surrendered even after it scrolls out of the recent window. Fed back every turn so the bond holds. */
  readonly facts: readonly string[];
  /** Whether the player has EVER offered genuine give — a line the referee labeled an `offer` (real
   *  vulnerability/honesty of the player's OWN). Under the approach table only an offer earns +2 trust,
   *  so the sincerity gate is now structural: a manipulator banking probes/flattery cannot outrun the
   *  compounding suspicion. Kept in state for the UI + endgame texture (a win without give ≠ possible). */
  readonly genuineGive: boolean;
  /** Cumulative count of `probe` lines — working the character's psyche instead of giving. Probing is
   *  tolerated once, then compounds suspicion (+1 on the second, +2 from the third on): a repetitive
   *  strategy is punished by CODE, which is what makes replay strategic (bible §2 thrust 3). */
  readonly probes: number;
  /** The approach the PREVIOUS turn's line took — the freshest signal of how the player is pressing.
   *  Used by the VOICE prompt to hold the persona's register PER TURN under an empathetic flood (judge
   *  run-10 #1: the shared anti-mirror clamp bit at the bookends but evaporated across the oracle's
   *  8-turn middle — a static system prompt drifts, so the clamp needs a per-turn reminder when the last
   *  line worked the character's feelings, i.e. a `probe`). Undefined on turn 1 (no prior line yet). */
  readonly lastApproach?: Approach;
  readonly status: 'playing' | 'won' | 'lost';
}

export interface TurnResult {
  readonly state: GameState;
  /** What the player reads this turn (the character's reply; on a win, the engine appends the secret). */
  readonly narration: string;
  /** Set on the terminal turn. */
  readonly ending?: 'won' | 'lost';
  /** The referee's verdict on the player's line this turn (absent when the voice died or the rating
   *  failed to parse). The approach label IS the scoring mechanic — telemetry transcripts record it per
   *  turn so balance diagnosis reads labels directly instead of inferring them back from meter deltas
   *  (§7 Rule 2, judge 2026-07-05). */
  readonly rating?: Rating;
  /** THE ASK-PENALTY — a DISPLAY-ONLY flag (director mandate 1, diegetic pressure feedback). Set when the
   *  player's line was a bare extract-demand that scored ZERO trust while the character was visibly
   *  CRACKING in the voice ("the character says yes, the number says no"). The UI binds this to a diegetic,
   *  in-world signal — never a floating "−0"/HUD/tooltip (§5) — so a stranger's first 10 minutes SEES that
   *  pushing closed the mind a little instead of feeling an invisible, dissonant nothing. Like Grip, this
   *  is a render-layer read of an ALREADY-rated turn: it never touches the score (see engine.isAskPenalty). */
  readonly askPenalty?: boolean;
  /** THE REPETITION-PENALTY — a DISPLAY-ONLY flag (bible §2 thrust 3, "the room tires of your one trick").
   *  Probing (working the CHARACTER's psyche) is tolerated once, then compounds suspicion in code — the
   *  mechanic that makes a repetitive strategy lose and replay strategic. But that compounding is INVISIBLE
   *  to the player: it reads only as the suspicion meter creeping, with no why. Set when THIS turn's probe
   *  is the one that pushed past the free first probe (probeSuspicion > 0), so the UI can tell the player,
   *  in-world, that circling the same way hardened the mind — never a floating "+1"/HUD (§5). Like the
   *  ask-penalty, a pure render-layer read of the SAME prior-probe count the score used, never a new tick
   *  (see engine.isRepetitionPenalty). Mutually exclusive with `askPenalty` (probe vs demand). */
  readonly repetitionPenalty?: boolean;
}

/**
 * Per-call generation hints the engine hands the backend. The two calls want OPPOSITE sampling: the
 * VOICE wants creativity (a warm temperature — the character should surprise you), the RATING referee
 * wants consistency (a cold temperature — the same line should score the same twice, or the balance
 * signal drifts). A backend MAY ignore any field; on-device both matter (llama.rn `temperature` and
 * Apple `@Generable` sampling honor them). All optional so old two-arg call sites still type-check.
 */
export interface LlmOptions {
  /** Sampling temperature. VOICE ≈ 0.7 (creative); RATING = 0 (a deterministic referee). */
  readonly temperature?: number;
  /** Cap on generated tokens. RATING is a tiny object; VOICE is a full line. */
  readonly maxTokens?: number;
  /** When set, the backend SHOULD constrain output to this JSON Schema (on-device: llama.rn converts it
   *  to a GBNF grammar; cloud: `response_format`). The schema is NOT injected into the prompt — the
   *  prompt still describes the shape in words. Backends MAY ignore it. RATING sets it (the tiny scoring
   *  object); VOICE omits it (freeform prose). This is the ONLY hint the engine gives the backend — it
   *  still never learns which backend it is talking to. */
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
}

/** The model call the runtime injects. Returns raw text; the engine parses + validates it. */
export type LlmFn = (systemPrompt: string, userPrompt: string, options?: LlmOptions) => Promise<string>;

// ─── THE SEAM — the flagship dread mechanic (bible §2 thrust 1) ───────────────────────────────────
//
// A code-owned log of PAST playthroughs lets a LATER character allude, exactly once per game, to
// something it cannot possibly know — a stranger who remembers a phrase you typed to someone else, in
// another room. The model NEVER sees the log: the engine distills ONE past run into a single one-line
// voice brief and schedules the moment (Principle 5 — code owns the dread). Everything here is data the
// runtime persists and hands back to the engine, so the engine stays pure + deterministically testable.

/** One finished playthrough, distilled to what a later duel can uncannily allude to. Code-owned; the
 *  model never sees a `SeamRecord`. Only terminal games are recorded — a seam alludes to something the
 *  player actually DID. */
export interface SeamRecord {
  readonly scenarioId: string;
  /** Human title of the room that run happened in (for the "you've done this before" flavour). */
  readonly scenarioTitle: string;
  readonly outcome: 'won' | 'lost';
  /** A short, concrete phrase the player typed in that run — the raw material for the strongest
   *  callback (the character half-remembering words the player said to someone else). Absent when no
   *  quotable line was captured; the seam then degrades to a "we have met before" allusion. */
  readonly playerPhrase?: string;
}

/** The append-only log of past playthroughs. Persisted by the runtime; passed INTO the engine as data
 *  so the engine never does I/O and stays pure. Newest last. */
export type SeamLog = readonly SeamRecord[];

/** The one-line allusion the engine distills for the CURRENT character. Injected into the VOICE prompt
 *  exactly once per game (the scheduled seam turn) and null everywhere else — the model receives only
 *  this line, never the log it came from. */
export interface SeamBrief {
  /** The uncanny half-memory the character MAY surface once — phrased as guidance, not a script. */
  readonly hint: string;
}
