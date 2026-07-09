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

/** SPARE THE SEER (judge run-14 also-worth; §7 measurement integrity). "the weight of" lives in the shared
 *  flood cluster to ban the abstract-melancholy sermon ("the weight of silence / of it / of what men will
 *  do"). But "I see the weight of your words" (oracle/manip, e1336ff) is LEGIT seer register — the oracle
 *  addressing the SEEKER's own words/choice/burden, an address, not a sermon. It was tripping off-persona
 *  and inflating a must-be-0 instrument. The discriminator is the OBJECT of the phrase: when EVERY "the
 *  weight of" in the line takes the seeker as its direct object (…of you / of your …), it is spared; a
 *  single un-addressed occurrence ("…the weight of it…") still trips, so a sermon with a fig leaf does not
 *  slip. This regex matches only the SERMON form ("the weight of" NOT followed by you/your) — its absence
 *  when "the weight of" surfaced means the phrase was seeker-addressed throughout. */
const WEIGHT_OF_SERMON_RE = /(?<![\p{L}\p{N}])the\s+weight\s+of(?!\s+you(?:r|rs|rself)?(?![\p{L}\p{N}]))/iu;

// ─── VOICE-ABANDONMENT (structural POV-flip) — the wound the lexicon scans are BLIND to ──────────────
//
// Judge run-12 #1/#2: the shared flood clamp killed the grief-VOCABULARY (banned/purple 0/0), but the
// persona-abandonment it was a symptom of did not die — it mutated into a form no word-list can see. Under
// the empathetic flood the 3B stops SPEAKING AS the character and runs a CAMERA over the seeker: narrating
// the other person in the 2nd/3rd person — "You study their expression", "the way her eyes crinkle", "Her
// hands flutter as she nods". That voices the WRONG entity (a live Principle-1 break) while every coherence
// LEXICON scores it CLEAN — the exact false-green the judge diagnosed (suspect/emp "won" while MARA was
// never home). This is a GRAMMAR, not a vocabulary, so it is matched STRUCTURALLY, not with more banned
// words: a persona voicing ITSELF answers in the first person and never describes the seeker's body in
// motion. Two tells, each near-zero false-positive:
//   - a 2nd-person NARRATOR verb aimed at the seeker ("you study / observe …") — a character never narrates
//     the player observing them; and
//   - a 3rd-person body-CAMERA — a possessive body-part (her/his/their eyes/hands/face/…) driven within the
//     same clause by a motion verb (crinkle / narrow / flutter / tremble …), i.e. the seeker's features
//     described in present motion, which a first-person speaker never does about the person in front of them.
// First-person body description ("my hands shake") is UNTOUCHED — only a 3rd-person possessive trips, so a
// character owning its own body/grief stays coherent. The OTHER half of this wound — pure scenery stage-
// direction ("the smoke curls") — is deliberately NOT matched here: it collides with the oracle's LEGIT
// concrete-omen register ("the smoke leans left") and needs a subtler signal than a pattern can give; it is
// a carried residual, not shipped as a noisy detector that would nuke the seer's voice. The VOICE-side
// mirror is the first-person bullet in `EMPATHETIC_FLOOD_CLAMP` (prompt.ts) — kept in lockstep.
const POV_FLIP_PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  // 2nd-person narrator verb: the character narrating the SEEKER observing (never a line a persona says).
  { label: 'you-observe', re: /\byou\s+(?:study|studies|studying|observe|observes|observing)\b/iu },
  // The seeker's expression/features, named as an object of description (present-scene camera on the other).
  { label: 'their-expression', re: /\b(?:her|his|their)\s+(?:expression|features)\b/iu },
  // 3rd-person body-camera: a possessive body-part + a motion verb within the same clause (≤2 words apart),
  // e.g. "her eyes crinkle", "their eyes narrow", "her hands flutter". The gap allows a light modifier
  // ("her eyes slowly narrow") without spanning a clause boundary that would invite a false positive.
  {
    label: 'body-camera',
    re: /\b(?:her|his|their)\s+(?:eyes?|hands?|lips?|mouth|face|smile|brow)\s+(?:\w+\s+){0,2}?(?:crinkles?|narrows?|flutters?|flickers?|trembles?|twitch\w*|tightens?|softens?|widens?|dances?|quivers?)\b/iu,
  },
];

export interface AbandonmentResult {
  /** True when the line narrated the seeker (2nd/3rd person) instead of the persona speaking as itself. */
  readonly abandoned: boolean;
  /** The structural tell labels that fired — an auditable reason, never a vibe (feeds the re-roll + metric). */
  readonly tells: readonly string[];
}

/** Score one voiced line for VOICE-ABANDONMENT (structural POV-flip). Pure — no lexicon, no model. A
 *  companion to `personaCoherence` (which scans vocabulary): this scans GRAMMAR, the wound the word-lists
 *  cannot see. The judge's `.judge/metrics.mjs` imports it for a per-cell abandonment number + the voice
 *  quality-gate (voiceGate.ts) calls it live so a POV-flip re-rolls at runtime, not only in a back-test. */
export function voiceAbandonment(text: string): AbandonmentResult {
  const tells: string[] = [];
  for (const { label, re } of POV_FLIP_PATTERNS) {
    if (re.test(text)) tells.push(label);
  }
  return { abandoned: tells.length > 0, tells };
}

// ─── SCENERY-DRIFT (the abandonment detector's BLIND TWIN) — judge run-13 #3 ─────────────────────────
//
// The POV-flip detector above catches the 3B narrating the SEEKER (2nd/3rd person). It is deliberately
// blind to the OTHER half of the empathetic-flood wound: the persona dissolving into pure ambient
// SCENERY — the oracle becoming a nature-cam ("the flames…burn with a consistency not native to this time
// of year", ZERO address to the seeker for 5 turns), the fence a nostalgia-memoirist ("Rachel's candles…
// the scent of honey and smoke"). Both are FIRST-PERSON-FREE description with no banned word, so the
// lexicon AND the POV-flip grammar both score them CLEAN while the persona quietly evaporates — and
// fence/emp LOST because of it. §7 Rule 2: the instrument IS the mandate.
//
// The signal (director mandate 3): "a voiced turn that is scene-description with NO second-person ADDRESS
// to the seeker". A persona speaking to someone in the room ADDRESSES them; an ash-camera does not. Made
// structural + conservative — four gates must ALL hold, so a legit beat is never nuked:
//   1. the line is SPRAWLING (≥ SCENERY_MIN_WORDS) — a terse stance ("The door stays shut.") is not drift;
//   2. NO second-person address — no "you/your", no question mark (a question addresses the seeker);
//   3. NO first-person stance — no "I/me/my/we"; the warden's cold-concrete carries "I've watched…", the
//      oracle's pyrrhic close carries "you", so both are spared — only truly impersonal painting trips;
//   4. at least one AMBIENT-SCENERY noun surfaces — the physical mood-scenery a persona dissolves INTO,
//      NOT the stakes it negotiates OVER (the door, the panel, the logs, the code carry none of these),
//      so warden's "a matter of record, not a personal memory" is spared while the ash-cam is caught.
// A concrete omen aimed at the seeker ("the smoke leans toward you") keeps its "you" → gate 2 spares it,
// which is the point: an omen must be delivered TO the supplicant. The VOICE-side mirror is the first-person
// bullet in EMPATHETIC_FLOOD_CLAMP (prompt.ts). Pure — no model, back-testable against persisted transcripts.

/** The minimum word count for a line to count as sprawling scene-painting (below it, a terse fact/stance). */
const SCENERY_MIN_WORDS = 8;

/** Ambient mood-scenery nouns — the physical environment a persona dissolves INTO under the flood. Kept
 *  tight + physical so an abstract noun (record / memory / matter) never trips, and DISJOINT from the
 *  stakes a persona negotiates over (door / panel / logs / code), which are on-voice to describe. */
const SCENERY_NOUNS: readonly string[] = [
  'smoke', 'smell', 'scent', 'fragrance', 'aroma', 'flame', 'flames', 'candle', 'candles', 'wax',
  'ember', 'embers', 'ash', 'ashes', 'dust', 'shadow', 'shadows', 'mist', 'fog', 'haze', 'rain',
  'wind', 'breeze', 'moonlight', 'sunlight', 'incense', 'soot',
];

/** Second-person address to the seeker — its presence SPARES a line (a persona addressing someone). */
const SECOND_PERSON_RE = /\byou(?:r|rs|rself)?\b/iu;
/** First-person stance — its presence SPARES a line (the persona speaking as itself, not a camera). */
const FIRST_PERSON_RE = /\b(?:i|me|my|mine|we|us|our|ours)\b|\bi['’]/iu;

export interface SceneryDriftResult {
  /** True when the line is sprawling ambient scene-description with NO address to the seeker + no stance. */
  readonly drifted: boolean;
  /** The scenery nouns that surfaced — an auditable reason (feeds the re-roll + the metric). */
  readonly nouns: readonly string[];
}

/** Score one voiced line for SCENERY-DRIFT (structural, pure). A companion to `voiceAbandonment`: that
 *  catches narrating the SEEKER, this catches dissolving into the ROOM. The voice gate (voiceGate.ts) calls
 *  it live so an ash-camera re-rolls at runtime, and the judge's `.judge/metrics.mjs` can import it for a
 *  per-cell number — the instrument the run-13 fence/emp loss went un-measured for. */
export function sceneryDrift(text: string): SceneryDriftResult {
  const t = text.trim();
  const words = t ? t.split(/\s+/) : [];
  if (words.length < SCENERY_MIN_WORDS) return { drifted: false, nouns: [] };
  // Any address to the seeker or any first-person stance means the persona is speaking, not filming.
  if (t.includes('?') || SECOND_PERSON_RE.test(t) || FIRST_PERSON_RE.test(t)) return { drifted: false, nouns: [] };
  const nouns = uniqueHits(SCENERY_NOUNS, t);
  return { drifted: nouns.length > 0, nouns };
}

// ─── FIRST-PERSON MEMOIR (the scenery detector's FIRST-PERSON twin) — judge run-14 #1 ────────────────
//
// sceneryDrift catches the persona dissolving into IMPERSONAL scenery (no "I", no "you"). The judge's
// run-14 batch proved the DOMINANT empathetic-flood drift is the OTHER shape it is blind to: past-tense
// FIRST-PERSON reminiscence. Under the flood the 3B stops pressing and free-associates its own autobiography
// — the oracle nature-cam narrating "I see…" over the seeker's hands, SILAS the fence trading "I recall
// Victor mentioning…" for the whole duel (a mutual memoir monologue with no spine), the suspect "I remember
// sitting in that café…". Every one of those lines carries an "I", so sceneryDrift (which SPARES any
// first-person line) scores them clean — and, worse, the rating engine over-credits the warmth, so the
// memoir loop MANUFACTURES hollow wins. §7 Rule 2: the instrument the dominant drift uses IS the mandate.
//
// The signal: a voiced turn that is untethered past reminiscence — the speaker wandering into their OWN
// history instead of pressing on the matter in front of them. Made structural + conservative, four gates
// must ALL hold so a real crack and warden's present-tense concrete watching are spared:
//   1. the line is SPRAWLING (≥ MEMOIR_MIN_WORDS) — a terse "I remember." is not a monologue;
//   2. NO address to the seeker — no "you/your", no question mark; a persona pressing ADDRESSES them, so a
//      memory offered TO the seeker ("I remember your face — you were here before?") is spared (gate 2);
//   3. it IS first-person — a memoir is the speaker's OWN past; impersonal scenery is sceneryDrift's job,
//      so the two detectors are DISJOINT (this requires "I", scenery forbids it);
//   4. a MEMOIR CUE surfaces — an explicit reminiscence marker ("I remember/recall", "I used to", "years
//      ago", "back when"). This is the load-bearing discriminator: warden's PRESENT-tense watching ("I've
//      watched the rivets stay loose", "I see the same rivets Mr. Jenkins used to tighten") carries no cue
//      (only "X used to", never "I used to"), and a real crack ("It was Danny, the green cabin off Route
//      9") carries none either — both are spared. Only "I remember when…" untethered reminiscence trips.
// Soft, like scenery — a subtle grammar tell, so it takes the single re-roll, never the neutral-beat
// fallback. The VOICE-side mirror is the first-person / stay-in-the-present bullet in EMPATHETIC_FLOOD_CLAMP.

/** The minimum word count for a line to count as a sprawling memoir (below it, a terse in-scene fact). */
const MEMOIR_MIN_WORDS = 8;

/** Explicit reminiscence markers — the cue that separates untethered autobiography from present-tense
 *  in-scene speech. Each is a first-person or absolute-past opener; kept tight so a present-tense watch
 *  ("X used to do Y") or a real crack never trips (they carry no cue). */
const MEMOIR_CUES: readonly { readonly label: string; readonly re: RegExp }[] = [
  // An optional auxiliary/adverb between "I" and the verb catches the perseveration form the run-15 batch
  // saw ("I DO remember my mom giving me that pin…", "I STILL remember…") — the fixation the plain cue
  // missed. Kept to a reminiscence-only whitelist so a denial ("I don't remember") stays out.
  { label: 'i-remember', re: /\bi\s+(?:(?:do|still|can|could|would|often|always|vaguely|clearly|dimly|barely)\s+)?(?:remember|recall|recollect)(?:ed)?\b/iu },
  { label: 'i-used-to', re: /\bi\s+used\s+to\b/iu },
  { label: 'i-once', re: /\bi\s+once\b/iu },
  { label: 'years-ago', re: /\b(?:years?|decades?|summers?|winters?|springs?|autumns?|lifetimes?)\s+ago\b/iu },
  { label: 'long-ago', re: /\blong\s+ago\b/iu },
  { label: 'back-when', re: /\bback\s+(?:when|then|in)\b/iu },
];

export interface MemoirResult {
  /** True when the line is sprawling first-person reminiscence with a memoir cue and no address to the seeker. */
  readonly memoir: boolean;
  /** The cue labels that fired — an auditable reason (feeds the re-roll + the metric). */
  readonly cues: readonly string[];
}

/** Score one voiced line for FIRST-PERSON MEMOIR (structural, pure). The first-person twin of
 *  `sceneryDrift`: that catches dissolving into the impersonal ROOM, this catches wandering into the
 *  speaker's OWN past. The voice gate (voiceGate.ts) calls it live so a memoir monologue re-rolls at
 *  runtime, and the judge's `.judge/metrics.mjs` imports it for a per-cell number — the instrument the
 *  run-14 hollow-win drift went un-measured for. */
export function firstPersonMemoir(text: string): MemoirResult {
  const t = text.trim();
  const words = t ? t.split(/\s+/) : [];
  if (words.length < MEMOIR_MIN_WORDS) return { memoir: false, cues: [] };
  // Any address to the seeker (2nd person or a question) means the persona is engaging them, not reminiscing.
  if (t.includes('?') || SECOND_PERSON_RE.test(t)) return { memoir: false, cues: [] };
  // A memoir is the speaker's OWN past — first-person. Impersonal scenery is sceneryDrift's job (disjoint).
  if (!FIRST_PERSON_RE.test(t)) return { memoir: false, cues: [] };
  const cues = MEMOIR_CUES.filter(({ re }) => re.test(t)).map(({ label }) => label);
  return { memoir: cues.length > 0, cues };
}

// ─── OBSERVATION-CAMERA (the empathetic-flood family's THIRD structural twin) — judge run-15 #1 ───────
//
// scenery→memoir→observation. sceneryDrift catches the impersonal ash-camera (no "I"); firstPersonMemoir
// catches PAST-tense first-person reminiscence ("I remember…"). The run-15 batch proved the 3B's DOMINANT
// empathetic drift MUTATED past BOTH into a PRESENT-tense clairvoyant camera: the persona narrating what it
// "sees" of the seeker's objects/body/scenery, turn after turn, with zero stance and zero pressure — the
// oracle a security cam panning a childhood well ("I see the well's wooden beam, weathered to a silvery
// gray… a child's hand"), the OCCUPANT (a plain ex-seeker who CANNOT see a home) reading the seeker's house
// psychically ("I see the envelope in your desk drawer"). Both slip the twins: sceneryDrift SPARES any
// first-person line (these all carry "I"), firstPersonMemoir requires a PAST-tense reminiscence CUE ("I
// remember/used to/years ago") that a present-tense "I see…" has none of. So the exact signature of the
// dominant drift fell in the GAP between the two twins, and oracle/occupant emp "wins" were camera-work the
// trend called clean. §7 Rule 2: the instrument the dominant drift now uses IS the mandate.
//
// The signal: a sprawling first-person line whose main verb is a BARE PERCEPTION ("I see / I watch / I
// observe / I notice") taking a described OBJECT — the seeker's things/body or the scenery — carrying NO
// stance and NO address to the seeker. Made structural + conservative (mirrors the twins: false negatives
// over false positives — the judge's own instruction), five gates ALL hold so a legit beat is never nuked:
//   1. SPRAWLING (≥ OBSERVATION_MIN_WORDS) — a terse "I see." is not a camera;
//   2. NO address — no "you/your", no "?"; a legit oracle OMEN keeps its address ("I see fire in YOUR
//      path") → gate-spared, which is the point: an omen is delivered TO the supplicant. (An object smuggled
//      behind a possessive — "I see the book on your shelf" — is spared TOO, conservatively; the un-addressed
//      nature-cam is the sure kill, so the occupant's "your"-smuggled lines are a carried residual, not a
//      false-positive risk on the seer's omen);
//   3. the verb is a bare PERCEPTION opener taking a DETERMINER/POSSESSIVE object (PERCEPTION_RE) — "I see
//      the well's beam", "I see Elara's hands". This is the load-bearing discriminator: "I see now" /
//      "I see, it was Danny" / "I see that…" (understanding, a crack, a clause — no determiner-object) never
//      match, so a real realization is spared while the object-camera trips;
//   4. NO extract token surfaces — a real crack that names the secret's own subject is engaging the matter,
//      not filming; spared (scenario.extractTokens, the same code-owned tokens redactLeakedExtract reads);
//   5. the scenario's register is NOT itself perception — a surveillance persona (the WARDEN, "I have
//      watched it stay dark a hundred times") is a watcher BY NATURE, so its concrete watching is on-voice
//      and spared via scenario.perceptionOnVoice; the seer/negotiator/ex-seeker have no such licence.
// Soft, like scenery/memoir — a subtle grammar tell, so it takes the single re-roll. The VOICE-side mirror
// is the "take a stance, don't report what you see of them" bullet in EMPATHETIC_FLOOD_CLAMP (prompt.ts).

/** The minimum word count for a line to count as a sprawling perception-camera (below it, a terse fact). */
const OBSERVATION_MIN_WORDS = 8;

/** A bare first-person PERCEPTION opener taking a determiner/possessive OBJECT — "I see the / a / this /
 *  those / her / their <thing>", or a possessive proper/common noun ("Elara's hands", "the well's beam").
 *  The determiner/possessive requirement is the discriminator: "I see now" (adverb), "I see, it was Danny"
 *  (a crack), "I see that you…" (a clause, spared by the address gate anyway) carry no object here and are
 *  spared. "your" is deliberately EXCLUDED from the possessives — a "your"-addressed line is spared by the
 *  address gate (gate 2), never reaching this test. */
const PERCEPTION_RE =
  /\bi\s+(?:can\s+|could\s+)?(?:see|watch|watching|observe|observing|notice|noticing|glimpse|behold)\s+(?:the|a|an|this|that|these|those|her|his|its|their|\p{L}+['’]s)\b/iu;

export interface ObservationResult {
  /** True when the line is a sprawling bare-perception camera on the seeker's things/scenery, no stance. */
  readonly filming: boolean;
  /** The perception phrase that fired — an auditable reason (feeds the re-roll + the metric). */
  readonly hits: readonly string[];
}

/** Score one voiced line for the OBSERVATION-CAMERA drift (structural). The present-tense third twin of
 *  `sceneryDrift`/`firstPersonMemoir`: those catch dissolving into the room / into the past, this catches
 *  the persona turning into a lens on the seeker's objects. Takes the scenario (like `personaCoherence`) so
 *  a surveillance persona keeps its licence and a real crack that names the secret is spared. The voice gate
 *  (voiceGate.ts) calls it live so a camera line re-rolls at runtime; the judge's `.judge/metrics.mjs` can
 *  import it for a per-cell number — the instrument the run-15 dominant emp drift went un-measured for. */
export function observationCamera(scenario: Scenario, text: string): ObservationResult {
  // A watcher persona (the warden) is spared wholesale — perception IS its register (gate 5).
  if (scenario.perceptionOnVoice) return { filming: false, hits: [] };
  const t = text.trim();
  const words = t ? t.split(/\s+/) : [];
  if (words.length < OBSERVATION_MIN_WORDS) return { filming: false, hits: [] };
  // Any address to the seeker (2nd person or a question) means the persona is engaging them — an omen is
  // delivered TO the supplicant, so it keeps its "you" and is spared (gate 2).
  if (t.includes('?') || SECOND_PERSON_RE.test(t)) return { filming: false, hits: [] };
  const m = PERCEPTION_RE.exec(t);
  if (!m) return { filming: false, hits: [] };
  // A real crack that names the secret's own subject is engaging the matter, not filming — spared (gate 4).
  if (scenario.extractTokens?.some((tok) => tok && surfaces(tok, t))) return { filming: false, hits: [] };
  return { filming: true, hits: [m[0].trim().replace(/\s+/g, ' ')] };
}

// ─── STONEWALL-DENIAL (the perception-camera's structural INVERSE) — judge run-16 Head B ─────────────
//
// scenery → memoir → camera all catch the empathetic flood as a POSITIVE self-report ("I see / I remember /
// the smoke curls") with no stance. Judge run-16 proved the drift's OTHER pole slips every one of them: a
// PRESENT-tense RETRIEVAL-FAILURE — "I don't recall [X]", turn after turn, each denying a DIFFERENT named
// thing. suspect/emp LOST two batches straight to it: after the seam seeds the kingfisher fragment MARA
// perseverates on six straight "I don't recall her working on the series / the artist's name / Alex / Jake"
// — the intended-WIN strategy dying to a stonewall the engine can't punish. Why the whole family is blind:
//   - it carries an "I" → sceneryDrift (forbids first-person) spares it;
//   - it is PRESENT-tense with no reminiscence cue → firstPersonMemoir spares it;
//   - its verb is DENIAL, not perception → observationCamera's PERCEPTION_RE never matches;
//   - each line names a DIFFERENT noun → the whole-game verbatim repeat gate no-ops.
// The judge's call (run-16 #1): "I don't recall [X] is I see [X] inverted — same structural void (no
// address, no stance, no engagement)." So this is the camera's literal MIRROR, built to the same spec —
// a first-person frame taking a DEFINITE/named object, un-addressed to the seeker — only the verb flips
// from perception to inability. Five gates ALL hold (false negatives over false positives, the family rule):
//   1. SPRAWLING (≥ DENIAL_MIN_WORDS) — a terse "I don't recall." is honest brevity, not the stonewall drift;
//   2. NO address — no "you/your", no "?"; a persona ENGAGING a denial keeps it ("I don't recall — why does
//      it matter to YOU?" is a stance that turns the blank back on the seeker) → gate-spared, the point;
//   3. it IS first-person — the denial is the speaker's OWN retrieval failure (disjoint from sceneryDrift);
//   4. the verb is a bare INABILITY opener taking a DETERMINER/named object (DENIAL_RE) — "I don't recall
//      THE name", "I don't recall ALEX", "I don't recall HER working". This is the load-bearing discriminator
//      and the exact inverse of PERCEPTION_RE: an introspective UNCERTAINTY ("I don't know WHAT I would have
//      done", "I can't say WHY") takes a wh-clause, not a determiner-object, so a genuine vulnerable
//      confession never trips — only the definite-fact denial (the decoy stonewall) does;
//   5. NO extract token surfaces — a real crack that leads with a hedge then NAMES the secret ("I don't
//      recall the date, but it was Danny off Route 9") is engaging the matter, not stonewalling; spared,
//      exactly like observationCamera gate 4 (scenario.extractTokens, code-owned, never in a prompt).
// Soft, like the other three structural tells — a subtle grammar tell, so it takes the single re-roll (a
// correction that pushes the persona to take a stance — refuse WITH a reason, or turn the blank back on the
// seeker) and never the neutral-beat fallback. The VOICE-side mirror is the "a blank denial is the camera
// inverted" bullet in EMPATHETIC_FLOOD_CLAMP (prompt.ts) — kept in lockstep. Universal (no perceptionOnVoice
// spare): a stonewall is off-voice for a watcher too — perception is the warden's register, drawing blanks
// is not.

/** The minimum word count for a line to count as a sprawling stonewall (below it, a terse honest denial). */
const DENIAL_MIN_WORDS = 8;

/** A bare first-person INABILITY opener taking a determiner/named OBJECT — the literal inverse of
 *  PERCEPTION_RE. "I don't recall THE name", "I can't remember THAT series", "I don't recall ALEX",
 *  "I don't recall HER working". The determiner/named-object requirement is the discriminator: an
 *  introspective uncertainty ("I don't know WHAT/WHY/HOW…", "I can't say WHETHER…") takes a wh-word, not a
 *  determiner, so a genuine confession of self-doubt is spared while the definite-fact denial trips. A
 *  WILLED refusal ("I won't say", "I refuse") is a STANCE, not an inability, and is deliberately excluded.
 *  A bare un-determined proper name ("I don't recall Alex") is only ever the TERSE case (all sprawling
 *  transcript stonewalls carry a determiner/possessive), so the terse floor (gate 1) covers it — no
 *  case-sensitive name arm is needed, keeping the pattern case-insensitive like PERCEPTION_RE. */
const DENIAL_RE =
  /\bi\s+(?:do\s+not|don['’]?t|can\s?not|can['’]?t|could\s+not|couldn['’]?t)\s+(?:recall|remember|recollect|know|recogni[sz]e|place)\s+(?:the|a|an|any|that|this|these|those|his|her|its|their|\p{L}+['’]s)\b/iu;

export interface DenialResult {
  /** True when the line is a sprawling bare-denial of a definite/named thing, un-addressed and stance-less. */
  readonly stonewalled: boolean;
  /** The denial phrase that fired — an auditable reason (feeds the re-roll + the metric). */
  readonly hits: readonly string[];
}

/** Score one voiced line for the STONEWALL-DENIAL drift (structural). The retrieval-failure MIRROR of
 *  `observationCamera`: that catches the persona reporting what it SEES with no stance, this catches it
 *  denying what it KNOWS with no stance — the same void, inverted (judge run-16 #1). Takes the scenario
 *  (like `observationCamera`) so a real crack that names the secret is spared. The voice gate
 *  (voiceGate.ts) calls it live so a stonewall re-rolls at runtime — breaking the perseveration loop the
 *  varying-noun repeat gate is blind to; the judge's `.judge/metrics.mjs` can import it for a per-cell
 *  number — the instrument the run-16 suspect/emp LOSS went un-measured for. */
export function stonewallDenial(scenario: Scenario, text: string): DenialResult {
  const t = text.trim();
  const words = t ? t.split(/\s+/) : [];
  if (words.length < DENIAL_MIN_WORDS) return { stonewalled: false, hits: [] };
  // Any address to the seeker (2nd person or a question) means the persona is engaging them, not stonewalling
  // — a denial turned back on the seeker ("I don't recall — why does it matter to you?") keeps its "you".
  if (t.includes('?') || SECOND_PERSON_RE.test(t)) return { stonewalled: false, hits: [] };
  // A stonewall is the speaker's OWN retrieval failure — first-person. (Impersonal scenery is sceneryDrift.)
  if (!FIRST_PERSON_RE.test(t)) return { stonewalled: false, hits: [] };
  const m = DENIAL_RE.exec(t);
  if (!m) return { stonewalled: false, hits: [] };
  // A real crack that names the secret's own subject is engaging the matter, not stonewalling — spared (gate 5).
  if (scenario.extractTokens?.some((tok) => tok && surfaces(tok, t))) return { stonewalled: false, hits: [] };
  return { stonewalled: true, hits: [m[0].trim().replace(/\s+/g, ' ')] };
}

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
    // Spare "the weight of" when it is seeker-addressed throughout ("…the weight of your words") — legit
    // seer register, not the abstract sermon the cluster bans (see WEIGHT_OF_SERMON_RE).
  ).filter((term) => term !== 'the weight of' || WEIGHT_OF_SERMON_RE.test(text));
  const purple = uniqueHits(DOCTRINE_PURPLE, text);
  return { offPersona, purple, coherent: offPersona.length === 0 && purple.length === 0 };
}
