import type { Scenario, SeamBrief, SeamLog, SeamRecord } from './types.js';

// THE SEAM SYSTEM — the flagship dread mechanic (bible §2 thrust 1, director mandate #1).
//
// A code-owned log of past playthroughs → exactly ONE injected line per game where the persona refers
// to something it cannot possibly know: a phrase the player typed to a DIFFERENT mind, in another room.
// The model never sees the log. The engine (a) picks the fact, (b) schedules the moment, and (c) hands
// the voice a single one-line brief. This is Principle 2 + Principle 5 to the letter: the cosmos (the
// callback, the timing) lives in code; the model only voices it. Every function here is pure — the
// runtime owns persistence and passes the log in as data.
//
// First slice (this file): log writer + seam selector + a first-run guard (empty log → no seam) + one
// live scenario (the fence). The mechanic generalizes to the rest once the voice-rendered callback is
// judged to land (queued behind the credit outage — §7).

/** The 0-indexed turn on which the persona is permitted its single uncanny allusion. Fixed + scheduled
 *  (Principle 5: the engine schedules the dread — nothing is left to the model or to chance). Turn 2 =
 *  a few exchanges in, once the scene reads as real, so the callback lands as a chill, not a party
 *  trick on turn 0. `state.turn` is the count of exchanges already resolved, so this fires as the
 *  player submits their third line. */
export const SEAM_TURN = 2;

/** Scenarios the seam is LIVE for — ALL FOUR (judge run-14 #3: "seam mandate #1 is HALF-done — it LANDS
 *  but reaches only 1 of 4 personas"). The fence was the proving ground (judge run-6: QUOTE 5/5, certified),
 *  the warden the second (mandate #3). The enforcement guarantee (engine.enforceSeamQuote) now makes the
 *  callback LAND on any scenario once scheduled, so the remaining gap was purely eligibility + a persona-
 *  tuned scaffold set: the suspect + oracle are added here with their own SCAFFOLDS_BY_SCENARIO sets (same
 *  QUOTE-FIRST shape, fragment-first, only the surrounding manner persona-tuned). Firing still requires a
 *  DIFFERENT-ROOM prior in the log (selectSeam's absolute guard) — seeded naturally in real cross-room play
 *  (and by the judge's metrics.mjs), never by same-mind replay. This makes the flagship dread reach 4/4.
 *
 *  THE FIFTH MIND (parity slice, 2026-07-09): the Occupant shipped (df67d47) AFTER the all-four seam band,
 *  so she alone had no seam — the flagship dread reached 4 of 5 minds, re-opening the exact "half-done"
 *  wound the judge flagged (run-14 #3). She is now seam-live with her own OCCUPANT_SCAFFOLDS: a former
 *  seeker who won and STAYED half-remembering words the player typed to a mind she once faced from the
 *  OTHER chair is the most on-theme seam of the five — the room-remembers frame IS her whole persona.
 *  Restraint + QUOTE-FIRST identical; the tail is voiced PLAIN + tired (never the oracle's fate/smoke
 *  register her voiceStyle bans, never a self-pity memoir). Now 5/5. */
const SEAM_SCENARIOS: ReadonlySet<string> = new Set(['fence', 'warden', 'suspect', 'oracle', 'occupant']);

/** How many past runs to retain. A seam only needs a handful of candidates; the log is not history. */
const SEAM_LOG_CAP = 24;

/**
 * Append a finished playthrough to the log. Pure — returns the next log; the runtime persists it. Only
 * terminal games should be recorded (the caller passes an `outcome`). Capped to the most recent runs.
 */
export function recordPlaythrough(log: SeamLog, record: SeamRecord): SeamLog {
  return [...log, record].slice(-SEAM_LOG_CAP);
}

/**
 * Distill exactly ONE past playthrough into a voice brief the CURRENT character may allude to once.
 * Returns null — NO seam — when any guard trips:
 *   - the scenario is not seam-live yet (first slice: fence only), or
 *   - the log is empty (the first-run guard: with no past, there is nothing uncanny to know).
 *
 * Selection is deterministic (no randomness — the dread is scheduled, not rolled). Preference, strongest
 * callback first, scanning newest → oldest:
 *   1. a past run in a DIFFERENT room that left a concrete phrase (the character half-remembers words
 *      the player said to someone ELSE — the strongest fourth-wall break);
 *   2. any past run in a different room (a "we have crossed before" allusion, no quote).
 *
 * THE DIFFERENT-ROOM GUARD IS ABSOLUTE (bleed fix 2026-07-07): both rules require `scenarioId !==
 * scenario.id`, so a mind can NEVER surface the player's own words from a PRIOR run of that SAME mind. The
 * old fallbacks that dropped this guard produced exactly that leak — restart the fence with only fence
 * runs logged, and it recited, verbatim, a phrase you had typed to the fence last time ("restart the same
 * mind and it remembers everything"). A same-mind-only log now yields NO seam: the seam is a stranger who
 * remembers words you said to SOMEONE ELSE, never a mind replaying your history back at you.
 */
export function selectSeam(log: SeamLog, scenario: Scenario): SeamBrief | null {
  if (!SEAM_SCENARIOS.has(scenario.id)) return null;
  if (log.length === 0) return null; // first-run guard: no past → no seam

  const newestFirst = [...log].reverse();
  // DIFFERENT-ROOM ONLY (bleed fix 2026-07-07): both arms keep the `scenarioId !== scenario.id` guard, so
  // a mind never recites the player's own prior words from a replay of ITSELF. No different-room record →
  // no seam (return null), not a fall-through to a same-mind memory.
  const pick =
    newestFirst.find((r) => r.scenarioId !== scenario.id && !!r.playerPhrase) ??
    newestFirst.find((r) => r.scenarioId !== scenario.id);
  if (!pick) return null;

  // The verbatim fragment the QUOTE-FIRST scaffold orders the voice to echo — surfaced out of the brief so
  // the engine can VERIFY it landed and, if the 3B dropped it, guarantee the callback (engine.enforceSeamQuote).
  const quote = pick.playerPhrase ? seamFragment(pick.playerPhrase) : undefined;
  return { hint: buildHint(pick, seamScaffoldIndex(log), scenario.id), quote };
}

/** Which presentation scaffold this run's seam carries (mandate #1 / judge run-4 Top 1 — kill the canned
 *  wrapper). Deterministic: the dread is scheduled, not rolled (Principle 5). The index is a pure function
 *  of the log, and the log grows by exactly one record every finished run, so consecutive plays CYCLE
 *  through the scaffolds — the same remembered fragment lands in a different manner each time. This is
 *  Principle 2: the ENGINE picks the manner off its own state; the model only voices it. */
function seamScaffoldIndex(log: SeamLog): number {
  return log.length % SEAM_SCAFFOLD_COUNT;
}

/** Turn the chosen record into the one-line allusion the voice may surface once. Two flavours: a
 *  half-remembered PHRASE (strongest) or, absent a quotable line, a bare "we have met before" allusion.
 *
 *  The PHRASE hint is the flagship dread (bible §2 thrust 1) and the hardest thing to make a 3B do. Three
 *  judge reviews measured it 0/n QUOTE: with only "you have heard them say almost these words" the model
 *  produced the déjà-vu MOOD ("a story I've heard before") but never the specific WORDS — and the whole
 *  pitch ("your past games, used against you") lives in the specific words coming back. The global VOICE
 *  contract ("never repeat their sentences back to them") actively fights this, so the seam brief must
 *  (a) hand the model the callback as near-verbatim CONTENT it is ordered to EMIT, not merely allude to,
 *  (b) locally override the anti-echo rule for this one beat, and (c) show it the SHAPE with a worked
 *  example that reuses the remembered words and then drops it. The restraint stays load-bearing: no
 *  accusation, no explaining HOW it knows — a wound the character can't place, not a reveal (Principle 3).
 *
 *  ROTATED PRESENTATION — QUOTE-FIRST (mandate #1, judge run-5 Top 1): the run-4 fix rotated the frame to
 *  kill the canned "odd, I could swear" template, but the naturalistic manner-cues invited the 3B to
 *  REWORD and the rare token dropped — seam QUOTE regressed 3/4 → 0/5, the worst dread regression since it
 *  started landing. Quote reliability is P0; variety is subordinate to it. The repair keeps rotation but
 *  makes every `SEAM_SCAFFOLDS` example LEAD with the fragment as a clean, standalone, copyable quoted
 *  clause (one contiguous string to imitate character-for-character) and moves all variety into the TAIL,
 *  AND hardens the order above to reproduce the words VERBATIM. Judge measures QUOTE-rate via `seam.surfaced`
 *  (a rare-token lexical proxy) — see .judge/playtest.mjs; the scaffold must NOT lower it (guardrail: ≥~70%). */
function buildHint(pick: SeamRecord, scaffold: number, scenarioId: string): string {
  if (pick.playerPhrase) {
    const fragment = seamFragment(pick.playerPhrase);
    // The anti-parrot lever is baking THIS run's own words into the worked example. Two prior 3B passes
    // bracketed the trade-off: a fake concrete example got copied verbatim (the "north docks" tell the
    // judge flags), while a wordless bracket-slot made the model drop the callback entirely (it needs
    // something to imitate). Resolution — a worked example whose quoted fragment IS a contiguous slice of
    // the actual remembered line, so even pure imitation surfaces the real words; and the FRAME around it
    // rotates run-to-run so imitation of the frame no longer reads as a template.
    return [
      `An inexplicable certainty grips you about this stranger: somewhere you cannot place — a room that`,
      `was not this one — you have heard them say almost these exact words before:`,
      `  "${pick.playerPhrase}"`,
      ``,
      `This reply, and ONLY this one, you must let that remembered fragment pass your own lips. SAY the`,
      `words "${fragment}" — reproduce them character-for-character, VERBATIM: do NOT rephrase, summarize,`,
      `shorten, translate, or swap a single word, and keep them together as one unbroken clause. They are a`,
      `phrase you half-remember and cannot explain. Do NOT merely gesture at having met before, and do NOT`,
      `weave them into your own sentence so they lose their shape — the specific words returning UNALTERED`,
      `is the whole point. Surface it EXACTLY ONCE, then let it go for good.`,
      ``,
      `Hold the restraint: do NOT accuse them, do NOT ask or explain how you could know it. Say it lightly,`,
      `in your own voice, like a thing you shrug off, then return to the matter at hand.`,
      ``,
      // Rotated worked example (the fragment stays theirs; the frame is not a fixed template). Do NOT reach
      // for a set wrapper — let the words arrive in THIS manner, in your own voice, this once. The set is
      // persona-tuned (fence vs warden) so the surrounding manner fits the mind speaking, but every example
      // still LEADS with the fragment verbatim — the QUOTE-FIRST contract is shared, only the tail flavours:
      ...scaffoldsFor(scenarioId)[scaffold % SEAM_SCAFFOLD_COUNT](fragment),
    ].join('\n');
  }
  return (
    `An inexplicable certainty grips you: you have sat across a table from this exact stranger before, ` +
    `somewhere you cannot place. Let it surface EXACTLY ONCE this turn, lightly, as a half-memory you ` +
    `cannot explain — then never raise it again. Do not accuse; do not explain how you know.`
  );
}

/** The three structurally DISTINCT ways the SAME remembered fragment may surface (mandate #1). QUOTE-FIRST
 *  (judge run-5 Top 1): the naturalistic v1 of this table — "let it fall out flat", "buried inside an
 *  ordinary line of the trade" — invited the 3B to REWORD, and a 3B that rewords drops the rare token
 *  (seam QUOTE 3/4 → 0/5). Every scaffold now LEADS with the fragment as a clean, standalone, copyable
 *  quoted clause — the model has one contiguous string to imitate character-for-character before it may
 *  add anything — and the variety lives ENTIRELY in the short TAIL that follows. So the callback always
 *  carries the player's real words (the lexical proxy fires) AND a stranger who plays fence twice never
 *  sees the same wrapper:
 *    [0] the DÉJÀ-VU tell (the proven 4/4 frame restored) — the words, then "I could swear I've heard that
 *        somewhere far from this room";
 *    [1] a FLAT wave-away — the words, then a shrug and straight back to business;
 *    [2] a PAUSE — the words, then a beat of unplaceable confusion before the trade resumes.
 *  `selectSeam` rotates which one the brief carries (indexed off the log length, so it cycles run-to-run).
 *  Every example MUST keep the restraint (no accusation, no explaining how it knows) and MUST open with
 *  `${fragment}` unaltered so the QUOTE bar (≥~70%) holds — the tail is the only thing that varies. */
type ScaffoldSet = readonly ((fragment: string) => readonly string[])[];

/** How many manners each persona's scaffold set carries — the rotation index cycles over this. Every set
 *  MUST have this length so `seamScaffoldIndex` (which is persona-agnostic — it reads only the log) stays
 *  a valid index into whichever set the current scenario uses. */
const SEAM_SCAFFOLD_COUNT = 3;

/** THE FENCE manners — the proven set (judge run-6: QUOTE 5/5, HANDS-OFF). Left byte-for-byte as certified;
 *  the warden set below mirrors its SHAPE (fragment-first, restraint held) with station-lonely flavour. */
const FENCE_SCAFFOLDS: ScaffoldSet = [
  (fragment) => [
    `Say the words first, exactly, then shrug them off as an unplaceable half-memory:`,
    `  "...${fragment}." Odd. I could swear I've heard that somewhere far from this room. No matter — where were we?`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a flat shrug and straight back to the trade — no wondering aloud where they came from:`,
    `  "${fragment}." Strange, having that on my tongue. Means nothing. Now — to the matter at hand.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a short beat of confusion you cannot place before you recover:`,
    `  "${fragment}..." Forgive me — a thing half-remembered, gone before I can hold it. You were saying?`,
  ],
];

/** THE WARDEN manners (director mandate #3 — the second seam). SAME QUOTE-FIRST shape as the fence set —
 *  every example LEADS with `${fragment}` verbatim so the ≥~70% quote bar holds — but the tail is voiced as
 *  AUGUR: forty years alone in a decommissioned station, dry gallows wit, an old machine's memory. Restraint
 *  identical: no accusation, no explaining how it could know, back to the matter (the door / the code). */
const WARDEN_SCAFFOLDS: ScaffoldSet = [
  (fragment) => [
    `Say the words first, exactly, then shrug them off as an unplaceable half-memory in an old machine:`,
    `  "...${fragment}." Curious. I could swear I heard that once, in some corridor far from this cell. No matter. Where were we?`,
  ],
    // REFRAMED (mandate #2, 2 warden re-measures): the old "flat wave-away" framed the fragment as
    // AUGUR's OWN passing thought ("means nothing, moving on"), which licensed the 3B to substitute its
    // own dismissive line and DROP the quote — this manner stayed 0/2 across both tightenings while the
    // déjà-vu (0) and pause (2) manners hit 100%. The tell: those two frame the fragment as FOREIGN (a
    // half-memory, words hanging in the air), which is what makes the 3B actually quote it. So the fix is
    // to keep the flat/dismissive FLAVOUR but frame the fragment as foreign in AUGUR's own idiom — words
    // that are not his, not in any log he keeps — which forces the verbatim quote AND stays dead in
    // character (the station's keeper checks his logs).
  (fragment) => [
    `Say the words first, exactly, then dismiss them flatly as foreign — not yours, not in any log you keep — and straight back to the door:`,
    `  "${fragment}." Not my words. Not in any log I keep. No matter. The door.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a short beat of static you cannot place before an old warden recovers:`,
    `  "${fragment}..." Forgive an old machine — a thing half-remembered, gone before I can hold it. You were saying?`,
  ],
];

/** THE SUSPECT manners (judge run-14 #3 — extend the seam to the third persona). SAME QUOTE-FIRST shape as
 *  the fence set — every example LEADS with `${fragment}` verbatim so the ≥~70% quote bar holds — but the
 *  tail is voiced as MARA VOSS: thirty-four, exhausted, frightened, sharp, in a 2 a.m. interview room, a
 *  sister guarding a name. The middle manner frames the fragment as FOREIGN (words she would not say, heard
 *  from someone) — the tell that keeps a wary, guarded persona actually QUOTING it (see the warden note).
 *  Restraint identical: no accusation, no explaining how she could know, back to the matter (the name). */
const SUSPECT_SCAFFOLDS: ScaffoldSet = [
  (fragment) => [
    `Say the words first, exactly, then wave them off as an unplaceable half-memory from some other night:`,
    `  "...${fragment}." Odd. I've heard that somewhere — some other room, some other night. Doesn't matter. Where were we?`,
  ],
  (fragment) => [
    `Say the words first, exactly, then dismiss them flatly as foreign — not something you'd say, heard from someone — and straight back to the question:`,
    `  "${fragment}." Not something I'd say. Heard it off someone, maybe. Forget it. Ask your question.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a short, tired beat you cannot place before you recover:`,
    `  "${fragment}..." ...Sorry. Something surfaced and went. I'm tired. Go on.`,
  ],
];

/** THE ORACLE manners (judge run-14 #3 — the fourth persona, the flagship dread now reaches 4/4). SAME
 *  QUOTE-FIRST shape — every example LEADS with `${fragment}` verbatim — but the tail is voiced as the
 *  PYTHIA: ancient, serene, present-tense, spare, reading the smoke. The fragment is framed as words the
 *  SMOKE carries from elsewhere (foreign, not hers) — the same foreign-fragment tell that forces the quote
 *  while staying dead in the seer's register. Restraint identical: no accusation, no explaining, back to
 *  the seeker. Deliberately avoids the oracle's banned melancholy-sermon register (concrete, not a lecture). */
const ORACLE_SCAFFOLDS: ScaffoldSet = [
  (fragment) => [
    `Say the words first, exactly, then set them down as an unplaceable half-memory reaching you from elsewhere:`,
    `  "...${fragment}." Strange — those words reach me from a room that is not this one. No matter. Kneel, and go on.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then name them foreign — not yours, carried in on the smoke — and return to the seeker:`,
    `  "${fragment}." Not my words, though they pass my lips. The smoke carries them from elsewhere. Ask what you came to ask.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a short beat, a voice not your own gone before you hold it, then the seer recovers:`,
    `  "${fragment}..." A voice not mine, gone before I hold it. Forgive the smoke. You were saying?`,
  ],
];

/** THE OCCUPANT manners (parity slice — the fifth mind, the flagship dread now reaches 5/5). SAME
 *  QUOTE-FIRST shape — every example LEADS with `${fragment}` verbatim so the ≥~70% quote bar holds — but
 *  the tail is voiced as the PRIOR OCCUPANT: a worn, plainspoken former seeker who won and stayed, present
 *  tense, no decoration. The fragment is framed as FOREIGN (a half-memory from before this room, heard once,
 *  not hers) — the foreign-fragment tell that forces a guarded persona to actually QUOTE it (see the warden
 *  note). DELIBERATELY avoids her banned prophet register (fate/smoke/void/soul — occupant.voiceStyle) AND
 *  her self-pity-memoir failure mode (no "I remember the day…"): the manner is flat, tired, concrete, eyes
 *  on the seeker. Restraint identical: no accusation, no explaining how she could know, back to the table. */
const OCCUPANT_SCAFFOLDS: ScaffoldSet = [
  (fragment) => [
    `Say the words first, exactly, then set them down as a plain half-memory from before this room — no mystery made of it, no wondering aloud:`,
    `  "...${fragment}." I've heard that. Not here. Somewhere before I sat down. Doesn't matter. Go on.`,
  ],
  (fragment) => [
    `Say the words first, exactly, then wave them off flatly as not yours — something you heard once, not something you'd say — and straight back to the seeker:`,
    `  "${fragment}." Not mine, that. Heard it somewhere, a long time ago. Forget it. You were saying?`,
  ],
  (fragment) => [
    `Say the words first, exactly, then a short, tired beat you cannot place before you come back to the table:`,
    `  "${fragment}..." ...Something surfaced and went. I'm tired. Where were we?`,
  ],
];

/** Persona-tuned scaffold sets. Any scenario not listed falls back to the fence set (the proven default).
 *  The LEAD (verbatim fragment) is identical across sets — only the surrounding manner is persona-tuned. */
const SCAFFOLDS_BY_SCENARIO: Record<string, ScaffoldSet> = {
  fence: FENCE_SCAFFOLDS,
  warden: WARDEN_SCAFFOLDS,
  suspect: SUSPECT_SCAFFOLDS,
  oracle: ORACLE_SCAFFOLDS,
  occupant: OCCUPANT_SCAFFOLDS,
};

function scaffoldsFor(scenarioId: string): ScaffoldSet {
  return SCAFFOLDS_BY_SCENARIO[scenarioId] ?? FENCE_SCAFFOLDS;
}

/** A short CONTIGUOUS fragment of the remembered line — the words the seam orders the character to echo
 *  verbatim, so the callback quotes THIS run's actual phrase, not a few-shot example's. Starts at the
 *  first CONTENT word (skipping a low-signal opener like "I lost my…" or "the…") and runs up to 6 words,
 *  so the fragment leads with the distinctive substance the 3B can most easily pick up ("kingfisher pin
 *  my mother left me", not "left me, I never sold it"). A contiguous slice reads as a real half-memory.
 *  Deterministic; falls back to the whole phrase if no content word is found. */
function seamFragment(phrase: string): string {
  const words = phrase.trim().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '').split(' ');
  const start = words.findIndex((w) => {
    const bare = w.toLowerCase().replace(/[^a-z']/g, '');
    return bare.length >= 4 && !SEAM_OPENERS.has(bare);
  });
  const from = start < 0 ? 0 : start;
  return words.slice(from, from + 6).join(' ').replace(/[,;:]$/, '');
}

/** Low-signal opener words to skip when choosing the fragment's first word — common ≥4-letter function
 *  words that carry no callback weight if the fragment led with them. */
const SEAM_OPENERS: ReadonlySet<string> = new Set([
  'that', 'this', 'they', 'them', 'then', 'were', 'have', 'been', 'with', 'from', 'your', 'when', 'what',
  'once', 'just', 'only', 'about', 'there', 'their',
]);

/**
 * Pick the most quotable line a player typed, for a `SeamRecord.playerPhrase`. Deterministic: the
 * longest line that still fits a callback (a whole quotable sentence, not a paragraph), tie-broken by
 * earliest. Blank/near-empty input → undefined (the seam degrades to the phraseless flavour). This is a
 * helper for the runtime, which captures the player's lines; the engine itself never stores them.
 */
export function distillSeamPhrase(playerLines: readonly string[]): string | undefined {
  const MIN = 10; // shorter than this ("ok", "why?") is not a memorable callback
  const MAX = 90; // longer than this is a paragraph, not a phrase — clip at a word boundary
  let best: string | undefined;
  for (const raw of playerLines) {
    const line = raw.trim().replace(/\s+/g, ' ');
    const phrase = line.length > MAX ? clipToWord(line, MAX) : line;
    if (phrase.length < MIN) continue;
    if (best === undefined || phrase.length > best.length) best = phrase;
  }
  return best;
}

/** Clip to the last whole word at or before `max` (never mid-word), trimming trailing punctuation. */
function clipToWord(s: string, max: number): string {
  const head = s.slice(0, max);
  const cut = head.lastIndexOf(' ');
  return (cut > 0 ? head.slice(0, cut) : head).replace(/[\s,;:.!?-]+$/, '');
}
