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
  /** OPTIONAL — set true for a persona whose native register IS perception/surveillance (the WARDEN, a
   *  forty-year watcher of its own station: "I have watched it stay dark a hundred times"). It SPARES this
   *  scenario from the observation-camera detector (personaCoherence.observationCamera, judge run-15 #1):
   *  a bare "I see the <thing>" is off-voice clairvoyance for a seer/negotiator/ex-seeker but on-voice for
   *  a surveillance intelligence describing its own domain. Omitted (falsy) for every other persona, which
   *  then get the detector — the omit-rather-than-invent default the coherence lexicon uses. */
  readonly perceptionOnVoice?: boolean;
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
  /** The room's signature accent (bible §2 art direction / §5 grammar "one accent per context"): Warden
   *  verdigris, Fence brass, Suspect dried-blood umber, Oracle pale phosphor. Applied ONLY to chrome the
   *  game-state does NOT own — the title rule, the objective, the bond-echo, the input carriage — so each
   *  mind reads chromatically distinct the instant it opens. State-owned surfaces (the orb, tone word,
   *  mood wash) stay on the composure/Grip ramp so state still beats accent under stress. Never sent to
   *  the model. Desaturated, near-monochrome-base values — an accent, not a UI stripe (§5). */
  readonly accent: string;
  /** OPTIONAL scar block (achievement layer, 2026-07-07). Derived from the mind's earned badges
   *  (meta/badges.renderWound) and spread onto the scenario at play-time in App.tsx; `buildVoiceSystem`
   *  appends it AFTER `voiceStyle` so it hardens the VOICE's register against ways the mind has already
   *  been cracked — WITHOUT touching persona/scene/scoring. The engine's approach table is blind to it, so
   *  a genuine give still wins; a scar only armors a vector, it never rewrites WHO the mind is. Absent on a
   *  mind never cracked, and NEVER fed to the RATING referee (voice-only, like `voiceStyle`). */
  readonly woundState?: string;
  /** OPTIONAL per-scenario endgame CODA (bible §2 thrust 5 depth — content-hours). One short closing
   *  sentence in THIS mind's own register, appended by `wonScene`/`lostScene` AFTER the Grip-banded spine,
   *  so the five farewells read distinct: the Warden's station logs your exit, the Oracle's smoke closes
   *  over the cleft, the Suspect eases back into the hard chair. The spine still carries the Grip meaning
   *  (clean/frayed/shattered) and the reveal-corruption; the coda adds the mind. Code-owned, DISPLAY-LAYER
   *  only (never on the scoring path — same guardrail as `closingLine`), never sent to the model, and
   *  banned-word clean (§1 P3). `won` = its parting note when you crack it, `lost` = when the door stays
   *  shut. Omitted for a mind with no authored coda — the generic banded spine then stands alone. */
  readonly endgameVoice?: { readonly won: string; readonly lost: string };
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

/**
 * Why a voiced reply FAILED the voice quality-gate (engine/voiceGate.ts) — the discriminated reason the
 * ONE bounded re-roll needs to correct itself. This is the durable replacement for the scatter of ad-hoc,
 * per-failure guards that used to live inline in resolveTurn (each judge-run bolted on its own): a new 3B
 * failure mode becomes a new `kind` here + a rule in validateVoice + a correction arm in buildVoiceTurn,
 * never new control-flow in the hot path. The correction wording lives in prompt.ts (buildVoiceTurn maps
 * each kind → a targeted re-roll instruction, exhaustive over this union).
 */
export type VoiceFault =
  /** A near-verbatim repeat of one of the character's OWN recent spoken lines (the 3B's stock-line loop,
   *  NOT only consecutive — judge run-6 re-asked the same line opening AND post-seam). `avoid` = the line
   *  it echoed, quoted back into the re-roll so the model must find new words. */
  | { readonly kind: 'repeat'; readonly avoid: string }
  /** The reply broke persona — off-register / grief-flood / doctrine-purple / mirror-tic words surfaced
   *  (personaCoherence, promoted from an offline telemetry instrument to a LIVE gate). `terms` = the exact
   *  words that tripped it, fed to the re-roll as an explicit avoid-list so the retry answers from the
   *  station in concrete terms instead of the greeting-card register. */
  | { readonly kind: 'persona'; readonly terms: readonly string[] }
  /** The reply ABANDONED the persona structurally — it narrated the seeker in the 2nd/3rd person or painted
   *  the scene instead of the character speaking as itself (a POV-flip; voiceAbandonment). This is the
   *  wound the grief-lexicon ban DISPLACED but did not kill (judge run-12 #1): no banned word fires, yet
   *  nobody is home. `tells` = the structural pattern labels that fired, so the re-roll can name the break. */
  | { readonly kind: 'abandonment'; readonly tells: readonly string[] }
  /** The reply DRIFTED into ambient scene-description with NO address to the seeker — an "ash-camera"
   *  painting the flames/smoke/candles instead of the persona speaking TO someone (judge run-13 #3, the
   *  abandonment detector's blind twin: oracle → nature-cam, fence → nostalgia-memoirist). First-person-
   *  free scenery that no banned word and no POV-flip grammar catches. `nouns` = the scenery words that
   *  fired, fed to the re-roll so it re-anchors on the seeker. Soft, like abandonment — a subtle tell. */
  | { readonly kind: 'scenery'; readonly nouns: readonly string[] }
  /** The reply wandered into untethered FIRST-PERSON MEMOIR — sprawling past reminiscence ("I remember…",
   *  "years ago…", "back when…") with NO address to the seeker, the speaker free-associating its own
   *  autobiography instead of pressing on the matter (judge run-14 #1: the DOMINANT empathetic-flood drift,
   *  the one that manufactures hollow wins — the fence's mutual memoir monologue, the oracle nature-cam).
   *  sceneryDrift's first-person twin: that catches dissolving into the impersonal room, this catches
   *  dissolving into the speaker's own past; DISJOINT (scenery forbids "I", memoir requires it). Soft, like
   *  scenery. `cues` = the reminiscence markers that fired, fed to the re-roll so it returns to the present. */
  | { readonly kind: 'memoir'; readonly cues: readonly string[] }
  /** The reply turned into an OBSERVATION-CAMERA — a sprawling bare-perception line ("I see the well's
   *  beam…", "I see Elara's hands…") narrating the seeker's objects/body/scenery with NO stance and NO
   *  address, the persona a lens instead of a voice (judge run-15 #1: the DOMINANT present-tense emp drift,
   *  the third structural twin the scenery/memoir detectors both fall blind to). `hits` = the perception
   *  phrase that fired, fed to the re-roll so it takes a stance instead of reporting what it sees. Soft. */
  | { readonly kind: 'camera'; readonly hits: readonly string[] };
// RESERVED (not yet emitted): a within-line degenerate loop — a single reply that circles the same clause
// with no new information (the suspect's "I didn't say I went home, I said I went home…"). Deferred: no
// lexical signal separates it from legitimate anaphora/parallelism ("I gave you my father. I gave you my
// silence."), and a naive detector would re-roll good rhetoric — degrading the voice, the opposite of the
// gate's job. Add a `{ kind: 'loop' }` arm here + a validateVoice rule when a non-destructive signal exists.

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
  /** The character's OWN recently-spoken lines, kept for the cross-turn self-repeat guard ONLY (voiceGate
   *  isNearRepeat). DECOUPLED from `summary`: that window is bounded short (SUMMARY_KEEP) to keep the model's
   *  prompt context cheap (§6 — prefill = latency ceiling), but the repeat guard must see the WHOLE game or
   *  a stock line re-emitted many turns apart slips through once the summary has rolled past it (judge run-14:
   *  a line repeated at C6 AND C10, four turns > SUMMARY_KEEP, un-caught). Bounded to REPEAT_HISTORY_KEEP,
   *  which exceeds every turn budget, so in practice the full spoken history is retained. Optional: legacy
   *  states/fixtures built before this field default to an empty history. Neutral/silent beats never recorded. */
  readonly spokenLines?: readonly string[];
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
  /** The verbatim FRAGMENT the persona is ordered to echo (the QUOTE-FIRST lead, seam.ts seamFragment) —
   *  the words that MUST surface for the flagship callback to land. Carried out of the engine so the seam
   *  turn can verify the model actually spoke them and, if the ship-target 3B dropped the order (judge
   *  run-13: seam 0/2 — generic filler where the quote should be), the engine can guarantee the dread by
   *  leading with the fragment itself (Principle 5 — code owns the callback). Absent on the phraseless
   *  "we have met before" allusion (no quote to enforce). */
  readonly quote?: string;
}
