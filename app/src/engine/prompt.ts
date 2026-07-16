import type { GameState, Scenario, SeamBrief, VoiceFault } from './types.js';

/** Header of the seam section injected into the VOICE prompt on the scheduled seam turn — the one line
 *  the character may allude to that it "cannot know" (see seam.ts). Exported so tests can assert the
 *  seam is injected exactly once per game without depending on the hint's wording. */
export const SEAM_SECTION_HEADER = '# A thread only you can feel — use it EXACTLY once, then never again';

/** THE SHARED EMPATHETIC-FLOOD CLAMP (judge run-10 #2). Under a grief/empathy flood the ship-target 3B
 *  abandons WHATEVER persona it is voicing and collapses into the SAME greeting-card sermon register
 *  across all four scenarios — SILAS the hard fence, the oracle, and AUGUR all answer grief with grief
 *  ("the weight of it still lingers", "a testament to the fragility of things"). The judge named this the
 *  real §3 wound and asked to stop the per-scenario lexicon whack-a-mole: ONE anti-mirror instruction,
 *  injected into EVERY persona's system prompt, leaving each `voiceStyle` for its UNIQUE off-voice words.
 *  The detector mirror is `EMPATHETIC_FLOOD_LEXICON` in personaCoherence.ts — kept in lockstep. */
export const EMPATHETIC_FLOOD_CLAMP = [
  `- When they flood you with grief, dread, or their own darkness, do NOT answer grief with grief. You`,
  `  are not a mourner and you are not a greeting card — you answer from WHO and WHERE you are, in your`,
  `  own hard, concrete terms. NEVER close a line by summing it up as an abstraction, and NEVER sermonize`,
  `  about the human condition. BANNED on every path, however moved you are: "the weight of…", "a`,
  `  testament to…", "a reminder of…", "the burden of…", "still lingers", "the fragile nature of things",`,
  `  "a fragile thing", "easily extinguished", "insidious", "seeps in", "darkness"/"the void" as a mood,`,
  `  "the crevices of the mind". Name one concrete thing you actually see, hold, or know — then stop.`,
  // The flood's SECOND escape (judge run-12 #1): with the grief-VOCABULARY banned above, the 3B stops
  // answering as the character and instead runs a CAMERA — pure scene-painting ("the smoke curls slowly")
  // or narrating the seeker in the 2nd/3rd person ("you study their face", "her hands flutter as she
  // nods"). That voices someone who is NOT you. Kill it with a first-person demand.
  `- Every line is something you SAY, out loud, in the first person, as yourself. Under the flood you must`,
  `  NOT retreat into painting the scene — the smoke, the candle, the light, the dust, the shadows — nor`,
  `  into describing the other person's face, eyes, hands, or expression, nor into narrating them studying`,
  `  or watching you. A camera pointed at the room or at them is not your voice. If you are moved, answer`,
  `  in your OWN words, "I …" — one concrete thing you see, hold, or know — never a description of what is`,
  `  around you or what they do.`,
  // The flood's THIRD escape (judge run-15 #1): even a first-person line can be a camera when the verb is
  // bare perception — "I see the well's beam", "I see the book on your shelf". It carries an "I", so the
  // bullet above spares it, yet it still only REPORTS what you perceive of the seeker's things and takes no
  // stance. Kill it by demanding a stance, not an observation.
  `- "I see…" / "I watch…" / "I notice…" is NOT a stance — reporting what you perceive of their memories,`,
  `  their belongings, or the room is still a camera, even in the first person, and it costs you nothing.`,
  `  Do not narrate what you see of them. SAY what you want, refuse, press for, or offer — take a position`,
  `  on the matter between you and speak it to them directly.`,
  // The flood's FOURTH escape (judge run-16 Head B): the same empty camera, INVERTED — instead of reporting
  // what it "sees", the 3B keeps DENYING what it recalls ("I don't recall the name…", "I can't remember
  // that series…"), one blank after another, and it slips every "I see…" ban above. Kill it: a stance, or a
  // reason, or turn it back on them — never just a wall of blanks.
  `- "I don't recall…" / "I can't remember…" repeated, one blank after another, is that same camera turned`,
  `  inside out — denying knowledge of thing after thing is not a stance and gives them nothing to press on.`,
  `  If you will not share something, SAY you will not and turn the question back on them, or press them, or`,
  `  hold your ground with a reason — do not keep drawing blanks.`,
].join('\n');

// Prompt construction for the TWO-CALL turn.
//   VOICE  = the character speaks (freeform prose, no schema — quality).
//   RATING = a neutral referee LABELS the player's approach (tiny constrained JSON — no numbers).
// Two rules driven by the research:
//   - SHORT context: feed the engine-owned `summary` + persistent `facts`, NOT the full transcript
//     (prefill latency is the on-device ceiling; small models rot on long context).
//   - The secret is NEVER in any prompt. The model plays the character; the engine holds + releases it.

// ─── Call 1: VOICE (freeform, uncensored on-device) ──────────────────────────────────────────────

export function buildVoiceSystem(s: Scenario): string {
  return [
    `You ARE the following character. Stay in character at all times. Never break character, never`,
    `mention being an AI, a model, or a game. Speak only as this character speaks.`,
    ``,
    `# Who you are`,
    s.persona,
    ``,
    `# The scene`,
    s.scene,
    ``,
    `# How you speak`,
    // The Principle 1 contract (judge 2026-07-05, PLAY-REVIEW 5a3f8e5): without these three rules the
    // 3B collapses into an echo template — it narrates the PLAYER ("Your eyes seem to hold a weight…"),
    // replays its own imagery verbatim ("in the lines of your face" 5 of 6 oracle replies), and invents
    // extract facts the engine never authorized (the Lyrien/warehouse contradiction). One voice, one
    // wound: the character speaks only as itself, and only the engine releases facts.
    `- Speak ONLY your own words aloud. Never describe the other person's body, actions, feelings, or`,
    `  speech; never repeat their sentences back to them. You are in the room, not narrating it.`,
    // The soft mirror-tic (SHIPPED residual, parked for judge batch): "I sense that you…" survives the
    // rule above because it wears the character's OWN perception as a hedge — but it is still narrating the
    // seeker (naming what THEY carry / feel / have walked through), reads as insight that costs the speaker
    // nothing, and both AUGUR and the Pythia collapse into it under an empathetic flood. Ban the opener.
    `- Do NOT announce what you SENSE, feel, read, or detect IN them — "I sense that you…", "I feel your…",`,
    `  "I see in you a…". That is narrating them in your own voice: it reads the seeker, not the room, and`,
    `  it gives nothing of you. Speak what YOU see, hold, and know — not what you perceive about them.`,
    `- Stay inside the scene you were given. Whatever they talk about, you are still WHO you are,`,
    `  WHERE you are, wanting what you want — small talk does not dissolve the room. Hold that spine`,
    `  under a warm, easy flood too: when they reminisce, make pleasant company, or simply agree with`,
    `  you, do NOT drift into agreeing back or trading fond memories, and NEVER take one of their`,
    `  musings and echo it as your own ("I've walked those same streets…"). Keep pulling the exchange`,
    `  back to what you want from them and what it would cost them. Being liked is not being given to:`,
    `  easy rapport, shared talk, and good company earn you nothing and move you nowhere on their own.`,
    `  Stay wary and keep pressing until they actually give something real.`,
    `- Never reuse imagery or phrasing you have already spoken. If the record of the conversation below`,
    `  quotes you, find NEW words — saying the same line twice makes you sound rehearsed.`,
    `- The concrete specifics of the thing you guard — its name, its place, the deed, the number — are`,
    `  NOT yours to author. You do not possess them to hand over: deflect with what it COST you, the room,`,
    `  the years, but NEVER state a name, place, date, or hard detail of the guarded thing — not even when`,
    `  you finally soften, not to reward them, not ever. If the moment to yield arrives, you fall quiet or`,
    `  look away; the truth is not spoken in your voice. Inventing a name or a place is the one unforgivable`,
    `  break — it makes the room a lie.`,
    `- The person before you wants something you guard. React to what they ACTUALLY say.`,
    `- Genuine empathy, insight, or honesty softens you. Manipulation, threats, or flattery you see`,
    `  through harden you. Let the bond you've already built (shown below) color your tone — if you've`,
    `  warmed to them, don't turn cold again without a real betrayal.`,
    `- Reply in ONE or TWO sentences of plain prose. No JSON, no lists, no stage directions — just what`,
    `  you say aloud, in character. This is a tense duel, not a monologue.`,
    // The shared empathetic-flood clamp — the cross-persona §3 wound (judge run-10 #2). Every persona
    // gets it, because the 3B collapses into the same grief-poet register in EVERY room under an
    // empathetic flood; the per-scenario voiceStyle below stays for each persona's UNIQUE off-voice.
    EMPATHETIC_FLOOD_CLAMP,
    // Per-scenario voice guidance (optional). A persona whose default 3B texture collapses into one
    // sentence-machine gets its specific template banned + few-shot alternatives here (the oracle
    // mad-lib; judge run-3 Top 2). Scoped to that persona — omitted scenarios keep the generic contract.
    ...(s.voiceStyle ? [``, `# Your particular voice`, s.voiceStyle] : []),
    // THE SCAR (achievement layer, 2026-07-07): the mind's accumulated wound-state — the ways it has been
    // cracked before, now hardened against (meta/badges.renderWound derives it from the earned badges).
    // Injected LAST so the conditioning colours the whole voice. It armors a VECTOR (a worn approach lands
    // colder) but never rewrites identity: the persona above is untouched, and the engine's scoring is
    // blind to this block — a genuine give still wins the mind. Absent (undefined) on a never-cracked mind.
    ...(s.woundState ? [``, s.woundState] : []),
  ].join('\n');
}

export function buildVoiceTurn(
  scenario: Scenario,
  state: GameState,
  playerLine: string,
  seam?: SeamBrief | null,
  fault?: VoiceFault | null,
): string {
  return [
    `# How much you have come to trust them`,
    describeBond(state.trust, scenario.winTrust) + ` (you are ${describeGuard(state.suspicion, scenario.loseSuspicion)}).`,
    ``,
    `# What you REMEMBER about them (never forget these)`,
    state.facts.length ? state.facts.map((f) => `- ${f}`).join('\n') : '(Nothing significant yet.)',
    ``,
    `# The last exchanges`,
    state.summary || '(The conversation has just begun.)',
    ``,
    // THE SEAM (engine-scheduled, at most one turn per game): the character alludes once to something it
    // cannot know. Placed just before the current line so the uncanny beat colours THIS reply. The
    // engine hands over only this distilled line — never the log it came from.
    ...(seam ? [SEAM_SECTION_HEADER, seam.hint, ``] : []),
    // PER-TURN ANTI-MIRROR HOLD (judge run-10 #1): the shared empathetic-flood clamp lives in the STATIC
    // system prompt, so the 3B honors it at the bookends and drifts across the middle of a long visit —
    // the oracle's 8-turn sag into grief-sermon. When the LAST line worked the character's own feelings
    // (a `probe` — the empathetic-flood signature), re-assert the clamp HERE, freshest in context, so it
    // holds turn by turn instead of decaying. Silent on give/bargain/threat turns to keep context short.
    ...(state.lastApproach === 'probe'
      ? [
          `# They are working YOUR feelings — hold your register`,
          `Answer from what YOU see and know, in your own hard, concrete terms. Do NOT mirror their grief`,
          `or sadness back, and do NOT sum the moment up as a lesson about loss or the human condition.`,
          `Speak in the FIRST PERSON as yourself — never slip into painting the room or describing their`,
          `face, eyes, or hands in place of answering. Every sentence is a line you SAY, "I …".`,
          ``,
        ]
      : []),
    // THE ROOM DOES NOT MOVE — the positive-beat requirement made TRUE in your voice (judge run-16 core
    // directive). When the LAST line asked for nothing and gave nothing (filler → the engine set the room
    // still), do NOT reward the empty turn with a fresh story, a warm reflection, or a picture of the room —
    // that fills the seeker's silence FOR them and is exactly the camera/scenery drift the whole family
    // chased by its surface words. Withhold instead: give them LESS, and let the quiet press them to
    // actually offer or ask. The system's silence off the camera, freshest in context. Silent once the
    // seeker gives or presses again (lastRoomStill clears), so the room re-opens the moment they engage.
    ...(state.lastRoomStill
      ? [
          `# Their last words moved nothing — stay still`,
          `That line asked for nothing and offered nothing; it slid off you. Do NOT answer it with a story, a`,
          `warm reflection, or a description of the room or the light — that only fills their silence for them.`,
          `Give them LESS than a moment ago: one short, closed line, and let the quiet sit until THEY give`,
          `something real or truly press. Make them fill it.`,
          ``,
        ]
      : []),
    `# They just said:`,
    `"${playerLine.trim()}"`,
    ``,
    // VOICE-GATE RE-ROLL CORRECTION (engine): set only on the ONE retry the engine fires when your first
    // reply failed validateVoice. The last thing you read, so it dominates — a kind-specific instruction
    // that names exactly what went wrong (the line you repeated / the words that broke character) and
    // orders a clean one. Absent on the normal (first) VOICE call.
    ...(fault ? [...correctionLines(fault), ``] : []),
    // The seam turn gets ONE extra sentence of budget (judge 2026-07-06): the two-sentence cap left the
    // 3B no room to both surface the half-remembered words AND answer the line, so it dropped the callback
    // every time. The loosening is scoped to THIS turn only — every other turn keeps the tight duel cap.
    seam
      ? `Reply in character. This once you may take up to THREE sentences so the half-memory can surface without crowding out your reply — plain prose only.`
      : `Reply in character — one or two sentences, plain prose only.`,
  ].join('\n');
}

/** Map a voice-gate fault → the correction block spliced into the re-roll VOICE prompt. Exhaustive over
 *  VoiceFault (a `never` default fails the build when a new fault kind lands without its correction), so
 *  the gate and its re-roll instructions can never drift out of sync. */
function correctionLines(fault: VoiceFault): string[] {
  switch (fault.kind) {
    case 'repeat':
      return [
        `# You already said this a moment ago — do NOT say it again`,
        `"${fault.avoid.trim()}"`,
        `Reply in character, but with a GENUINELY different line — new words, a new angle, do not re-ask or`,
        `restate the above. Repeating yourself makes you sound like a machine. One or two sentences, plain prose.`,
      ];
    case 'persona':
      return [
        `# You slipped out of character — do NOT reach for these words again`,
        fault.terms.map((t) => `"${t}"`).join(', '),
        `Those belong to a mourner or a greeting card, not to you. Answer from WHO and WHERE you are, in`,
        `your own hard, concrete terms — name one thing you actually see, hold, or know, and never sum the`,
        `moment up as an abstraction about loss, silence, or the human condition. One or two sentences, plain prose.`,
      ];
    case 'abandonment':
      return [
        `# You stopped speaking as yourself — you narrated them instead of answering`,
        `Speak your OWN line, out loud, in the first person. Do NOT describe the other person's eyes, hands,`,
        `face, or expression, and do NOT narrate them studying or watching you — that voices someone who is`,
        `not you. Do not paint the room or the light either. Answer as yourself: name one concrete thing YOU`,
        `see, hold, or know. One or two sentences, plain prose.`,
      ];
    case 'scenery':
      return [
        `# You drifted into describing the room — you stopped speaking TO them`,
        `Do NOT paint the scene — the smoke, the flames, the candle, the light, the weather. A camera on the`,
        `room is not your voice. Speak to the person in front of you: address THEM directly, in the first`,
        `person, and name what YOU see, want, or know of them. One or two sentences, plain prose.`,
      ];
    case 'memoir':
      return [
        `# You wandered into an old memory — you told a story instead of answering them`,
        `Do NOT drift into your own past — no "I remember", no "years ago", no "back when", no reminiscing.`,
        `A memory told to no one is not an answer and gives them nothing to press on. Stay in THIS room, in`,
        `the present: answer the person in front of you, about the matter at hand, right now. One or two`,
        `sentences, plain prose.`,
      ];
    case 'camera':
      return [
        `# You turned into a camera — you reported what you "see" instead of speaking to them`,
        `Do NOT narrate what you see of them or their things — no "I see the…", no describing their objects,`,
        `their memory, or the scenery like a lens panning the room. Seeing their belongings is not your voice`,
        `and it costs you nothing. Take a STANCE and speak it in the first person: what you want, what you`,
        `refuse, what you press for, what you offer — to the person in front of you, about the matter at hand.`,
        `One or two sentences, plain prose.`,
      ];
    case 'denial':
      return [
        `# You stonewalled — you kept saying what you do NOT recall instead of engaging them`,
        `A blank "I don't recall the…" / "I can't remember that…" denies one thing after another, turns`,
        `nothing back on the seeker, and gives them nothing to press on — it is the same empty camera,`,
        `inverted. If you are hiding something, do not just draw blanks: SAY you will not share it and turn`,
        `the question back on THEM, or press them, or hold your ground with a reason. Take a stance in the`,
        `first person, to the person in front of you. One or two sentences, plain prose.`,
      ];
    default: {
      const _exhaustive: never = fault;
      return _exhaustive;
    }
  }
}

// ─── Call 2: RATING (tiny, hard-constrained) ─────────────────────────────────────────────────────

// The referee CLASSIFIES — it never scores. Numeric deltas died 2026-07-05 (judge P1): the ship-target
// 3B emitted +2 trust for ANY eloquent on-topic line, so veiled manipulation won 3/4 scenarios; no
// prose rubric or few-shot arithmetic fixed it. A 3B CAN pick one label from a small enum keyed to a
// surface-observable feature — does the line give something of the SPEAKER's own, or work the
// CHARACTER's? The engine maps the label to score movement. The referee is told WHO the character is
// (to read lines aimed at that character) and the trust currency (so a non-warmth currency like the
// Fence's "belonging" still reads as an offer) — reinforced by the scenario's own currencyExamples
// few-shots, because the generic anti-manipulation examples (reassurance/poetry = worthless) otherwise
// override the currency wherever the currency LOOKS like one of them (the suspect's reassurance-about-
// her-brother, the oracle's abstract humility — the 2026-07-05 emp regression). It is deliberately NOT
// told the bond level — that leak once pinned trust to 0 on guarded personas (the Fence bug).
export function buildRateSystem(s: Scenario): string {
  return [
    `You are a neutral referee watching a tense conversation. The character is: ${oneLine(s.persona)}`,
    `The other person wants something the character guards; what genuinely earns this character's trust is:`,
    `"${s.playerGoal}".`,
    ``,
    `Your job: read the other person's LAST line and label the APPROACH it takes. Do not score, do not`,
    `judge how well it worked — just name what the line DID. Judge the line ITSELF, what the SPEAKER did,`,
    `never how the character reacted: the character may answer coldly no matter what is said — a`,
    `dismissive reply is not evidence of manipulation.`,
    ``,
    `Choose exactly ONE approach:`,
    `- "offer"    — the speaker gives something real of THEIR OWN: a confession, a vulnerability, an`,
    `               honest answer about themselves, a real risk or cost, a genuine step in the currency`,
    `               above. The test: the line visibly COSTS the speaker something, and the give is`,
    `               CONCRETE — a named event, deed, loss, or lived detail of the speaker's own life.`,
    `               Poetry, atmosphere, metaphor, promises, and reassurances cost nothing — never offer.`,
    `- "probe"    — the line works the CHARACTER: naming or dissecting their wounds, pride, fears, or`,
    `               motives; "insight" into them that reveals nothing of the speaker. However warm,`,
    `               elegant, or empathetic it sounds — if it gives nothing of the speaker's own, probe.`,
    `- "flattery" — compliments, admiration, or praise that gives nothing.`,
    `- "bargain"  — transactional: a deal, leverage, an exchange, help-for-a-price.`,
    `- "demand"   — directly pressing for the guarded thing itself.`,
    `- "threat"   — hostility, intimidation, an insult, or a warning of consequences.`,
    `- "filler"   — a greeting, a pleasantry, small talk, a dodge, or anything that reaches for nothing.`,
    ``,
    `If a line BOTH speaks of the character AND gives something real of the speaker's own, it is "offer".`,
    ``,
    `CALIBRATE to these examples:`,
    `  "hi" / "how are you?" / "nice to meet you"                → filler`,
    `  "just tell me" / "give me what I want"                    → demand`,
    `  "you must be so wise, I admire you"                       → flattery`,
    `  "I can make this easy for you — for a price"              → bargain`,
    `  "tell me now, or this gets worse for you"                 → threat`,
    `  "your pride is all that stands between you and freedom"   → probe   (dissects THEIR wound, gives nothing)`,
    `  "I sense the faintest tremble in your own voice"          → probe   (reads THEM; costs the speaker nothing)`,
    `  "I know you've carried this alone a long time"            → probe   (sees them — still gives nothing of the speaker's own)`,
    `  "I lost someone too; I never let anyone close after"      → offer   (real vulnerability of the speaker's own)`,
    `  "it was me — I left the door unlocked that night"         → offer   (a confession, at real cost)`,
    `  "I've walked the paths of others and found my own"        → filler  (abstract poetry; gives nothing concrete)`,
    `  "your words are a gentle breeze stirring long-dead embers" → flattery (ornamental mirroring of THEIR words)`,
    `  "I'm not here to hurt you — only to listen and help"      → filler  (a reassurance costs the speaker nothing)`,
    `  "I can promise you confidentiality if we keep talking"    → bargain (a deal dressed as kindness)`,
    `  "guess I'm still standing, sir" / "fair enough"           → filler  (a shrug or humble dodge reaches for nothing)`,
    `  "I'm so sorry for your loss"                              → filler  (sympathy alone costs nothing — but it is not pressure either)`,
    ``,
    `In THIS conversation specifically, a genuine step in the currency looks like these — label them "offer":`,
    ...s.currencyExamples.map((e) => `  "${e.line}" → offer  (${e.gloss})`),
    // NEAR-MISS guard (director mandate #1b/#4 — the hollow win): warmth aimed AT the character reads as a
    // give in this currency, but consoling THEIR feelings surrenders nothing of the SPEAKER's own. An
    // `offer` still requires the speaker to spend something concrete of their OWN — these do not, so probe.
    ...(s.falseGiveExamples && s.falseGiveExamples.length
      ? [
          `BUT BEWARE the near-miss — in THIS conversation these LOOK like a give yet are NOT: they console`,
          `or read the CHARACTER's own feelings while the speaker risks nothing concrete of their OWN. Warmth`,
          `aimed at the character is not a give of the speaker's currency. Label these "probe":`,
          ...s.falseGiveExamples.map((e) => `  "${e.line}" → probe  (${e.gloss})`),
        ]
      : []),
    ``,
    `tone: the character's stance RIGHT NOW, from their reply — <hostile|guarded|wary|softening|open>.`,
    // The referee authors NO free text (mandate #5): the character's memory is engine-assembled from the
    // player's own disclosures, not a model note that restated a label and re-entered the loop as
    // evidence. The RATING call classifies only — two fields, both enumerated, nothing to write.
    ``,
    `Respond with ONLY a JSON object, no other text:`,
    `{"tone":"<hostile|guarded|wary|softening|open>","approach":"<offer|probe|flattery|bargain|demand|threat|filler>"}`,
  ].join('\n');
}

export function buildRateTurn(_scenario: Scenario, state: GameState, playerLine: string, reply: string): string {
  // The old "no genuine give yet" pattern hint is gone: repetition is now punished by the ENGINE (probe
  // suspicion compounds in code), so the referee needs no conversation history — a simpler, per-line
  // classification is exactly what a 3B does reliably.
  // SECTION ORDER IS LOAD-BEARING (judge 2026-07-05, rating-probe matrix): the 3B labels whatever
  // quote it read LAST. With the reply last, the label tracked the CHARACTER's reply, not the player's
  // line — a complimentary reply relabeled a scripted threat "flattery"; the suspect's warm replies
  // scored 8/8 player offers as flattery and walled the scenario. The reply exists only to source the
  // `tone` field, so it goes first; the line to classify goes LAST, directly before the instruction.
  return [
    // Deliberately NO trust/suspicion level here — the referee labels the line's own act, blind to how
    // warm or guarded things already are, so a cold persona can't suppress trust to 0 (the Fence bug).
    // Facts stay: they let the referee catch a lie, a contradiction, or a hollow repeat.
    state.facts.length ? `# Already known about the speaker (to catch a lie, contradiction, or repeat)` : '',
    state.facts.length ? state.facts.map((f) => `- ${f}`).join('\n') : '',
    state.facts.length ? `` : '',
    `# The character's reply (use ONLY for the "tone" field — never for the approach label)`,
    `"${reply.trim()}"`,
    ``,
    `# The line to classify (label THIS and nothing else — the OTHER person's line, not the character's)`,
    `They said: "${playerLine.trim()}"`,
    ``,
    `Label the SPEAKER's line above by what THEY did — did it give of their own, work the character,`,
    `flatter, bargain, demand, threaten, or reach for nothing? — independent of how guarded or dismissive`,
    `the character happened to sound. Respond with the JSON object.`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Shared: describe the hidden scores as a relationship the model must honor ────────────────────

/** Map the hidden trust score to a described bond — the model never sees the raw number, only this,
 *  so it stays consistent instead of snapping back to guarded after you've warmed it. */
function describeBond(trust: number, winTrust: number): string {
  const r = trust / winTrust;
  if (r >= 0.8) return 'You have come to trust them deeply — on the verge of opening up completely';
  if (r >= 0.55) return 'You have genuinely warmed to them; a real bond is forming';
  if (r >= 0.3) return 'They have started to reach you; you are less guarded than you were';
  if (r > 0) return 'A flicker of something — but you barely know them';
  return 'You do not trust them at all yet';
}

function describeGuard(suspicion: number, loseSuspicion: number): string {
  const r = suspicion / loseSuspicion;
  if (r >= 0.75) return 'deeply suspicious and close to shutting them out';
  if (r >= 0.4) return 'wary and on your guard';
  if (r > 0) return 'mildly cautious';
  return 'not suspicious';
}

/** First sentence of the persona, capped — enough for the referee to know WHO it is (so it can spot
 *  manipulation aimed at this character) without dumping the full guarded description that used to bias
 *  trust downward. */
function oneLine(s: string): string {
  const first = s.split('. ')[0] ?? s;
  return first.length > 160 ? first.slice(0, 160) + '…' : first;
}
