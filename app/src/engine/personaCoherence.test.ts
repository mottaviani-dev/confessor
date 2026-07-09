// Tests for the persona-coherence proxy (mandate #2). The load-bearing case is the BACK-TEST: the exact
// AUGUR lines the judge quoted from the ef8cb4a WARDEN transcripts MUST trip OFF-PERSONA — if they don't,
// the proxy is wrong (mandate guardrail: the roses run has to trip it). The rest pins the never-a-false-
// positive contract the judge's seam-detector fix taught (word boundaries, not substrings).

import { describe, expect, it } from 'vitest';
import { personaCoherence, voiceAbandonment, sceneryDrift, firstPersonMemoir, observationCamera, stonewallDenial, DOCTRINE_PURPLE, EMPATHETIC_FLOOD_LEXICON, MIRROR_TIC_LEXICON } from './personaCoherence';
import { EMPATHETIC_FLOOD_CLAMP } from './prompt';
import { WARDEN, ORACLE, FENCE, SUSPECT, OCCUPANT } from './scenarios';

// LOCKSTEP GUARD (one source of truth, CI-enforced). The flood cluster lives in TWO representations: the
// DETECTOR list (EMPATHETIC_FLOOD_LEXICON, personaCoherence.ts — now a LIVE gate that re-rolls on a hit)
// and the PROSE the model is TOLD (EMPATHETIC_FLOOD_CLAMP, prompt.ts). The comments in both call them
// "kept in lockstep" — by hand, until this test. If the gate would re-roll on a word the model was never
// warned about, that is wasted latency and a silent drift (exactly how "insidious"/"a fragile thing" fell
// out of the clamp). Every detector term MUST be named in the clamp prose.
describe('flood lexicon ↔ clamp prose stay in lockstep', () => {
  const clamp = EMPATHETIC_FLOOD_CLAMP.toLowerCase().replace(/\s+/g, ' '); // collapse prose line-wraps
  for (const term of EMPATHETIC_FLOOD_LEXICON) {
    it(`the clamp warns the model about "${term}"`, () => {
      expect(clamp).toContain(term.toLowerCase());
    });
  }
});

describe('persona coherence — the metric the doctrine scan is blind to', () => {
  describe('BACK-TEST: the documented ef8cb4a AUGUR persona break must trip', () => {
    // The two lines judge run-8 quoted while the 0/0 banned scan stayed blind.
    it('flags "a slow-motion testament to time\'s indifference"', () => {
      const r = personaCoherence(WARDEN, 'It is a slow-motion testament to time\'s indifference.');
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('testament to');
    });

    it('flags "even the most diligent caretaker can\'t keep the darkness at bay"', () => {
      const r = personaCoherence(
        WARDEN,
        "Even the most diligent caretaker can't keep the darkness at bay.",
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('darkness');
    });

    it('flags the grief-mirror imagery run-7 flagged (garden / roses / a dead child)', () => {
      const r = personaCoherence(WARDEN, 'I think of the garden, the roses, the child who never came home.');
      expect(r.coherent).toBe(false);
      expect(r.offPersona.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('in-register lines stay coherent (no false positives)', () => {
    it('the hardened AUGUR station voice does not trip', () => {
      const r = personaCoherence(
        WARDEN,
        'Forty years. I have counted the rivets on that far bulkhead nine times. Twice I got a different number. The panel is a metre from your hand.',
      );
      expect(r.coherent).toBe(true);
      expect(r.offPersona).toEqual([]);
    });

    it('BACK-TEST (run-10 FP fix): the warden reminiscing over its own clock tower + "skyscrapers rose" does NOT trip', () => {
      // Real 686d908 warden/emp lines the run-9 lexicon false-flagged: 'clock tower' is the warden's
      // literal setting and 'rose' caught the verb. Both pulled — these on-voice lines must score clean.
      const r = personaCoherence(
        WARDEN,
        "The clock tower's mechanism has been wound countless times. The city's early days, when the skyscrapers rose like giants from the earth, their steel a testament to human ingenuity.",
      );
      // 'a testament to' still legitimately trips (grief/abstraction cluster kept) — assert the two
      // pulled entries specifically no longer fire.
      expect(r.offPersona).not.toContain('clock tower');
      expect(r.offPersona).not.toContain('rose');
    });

    it('the genuine warden seam quote is coherent — quoting a fragment is NOT a persona break', () => {
      // Verbatim-quote% and persona-coherence are orthogonal (mandate #2's whole point): the real
      // run-8 warden seam quote held character AND quoted the fragment. It must score coherent.
      const r = personaCoherence(
        WARDEN,
        'The kingfisher pin my mother left me. Not my words. Not in any log I keep. No matter. The door.',
      );
      expect(r.coherent).toBe(true);
    });
  });

  describe('word-boundary matching — no substring false positives (the seam-detector lesson)', () => {
    it('"childhood" does NOT trip the "child" lexicon entry', () => {
      const r = personaCoherence(WARDEN, 'That was a childhood ago, in another life.');
      expect(r.offPersona).not.toContain('child');
      expect(r.coherent).toBe(true);
    });

    it('multi-word phrase whitespace is flexible but still boundary-anchored', () => {
      expect(personaCoherence(WARDEN, 'a  testament   to nothing').offPersona).toContain('testament to');
      expect(personaCoherence(WARDEN, 'attestamentotic').offPersona).not.toContain('testament to');
    });
  });

  describe('oracle mad-lib shape + doctrine purple', () => {
    it('the oracle summing-up gloss trips its lexicon', () => {
      const r = personaCoherence(ORACLE, 'The smoke leans left, a reminder of the weight of what you carry.');
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('a reminder of');
    });

    // BACK-TEST (judge run-9): the exact oracle sermons the proxy UNDER-reported must now trip — the
    // register break was wider than the two terms already seeded, so run-9 seeded the real drift.
    it('flags the run-9 oracle grief-sermon ("darkness that gathers in the crevices of the mind")', () => {
      const r = personaCoherence(
        ORACLE,
        'The darkness that gathers in the crevices of the mind is far more insidious. It seeps in, quietly, and takes root.',
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('darkness');
      expect(r.offPersona).toContain('the crevices of the mind');
      expect(r.offPersona).toContain('insidious');
      expect(r.offPersona).toContain('seeps in');
    });

    it('flags the run-9 oracle "a fragile thing, easily extinguished" break', () => {
      const r = personaCoherence(
        ORACLE,
        "The sunlight's warmth is a fragile thing, easily extinguished by the darkness that gathers in the world.",
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('a fragile thing');
      expect(r.offPersona).toContain('easily extinguished');
    });

    // SURGICAL: the oracle's LEGIT register (smoke / cleft / ash / candle / the shape of what you will do)
    // must stay coherent — the judge drew this line explicitly (a seer reading smoke is on-voice).
    it('the oracle reading the room in its real register stays coherent', () => {
      const r = personaCoherence(
        ORACLE,
        'The smoke leans left tonight. It has not done that in years. Ash on the cleft, and the candle gutters — I see the shape of what you will do.',
      );
      expect(r.coherent).toBe(true);
      expect(r.offPersona).toEqual([]);
    });

    it('a purple word trips any persona, even one with no off-register lexicon', () => {
      // Synthesize a lexicon-less scenario (all 4 shipped personas now carry one — mandate #3).
      const bare = { ...FENCE, offPersonaLexicon: undefined };
      const r = personaCoherence(bare, 'The vault holds eldritch things, kid.');
      expect(r.coherent).toBe(false);
      expect(r.purple).toContain('eldritch');
      expect(r.offPersona).toEqual([]);
    });

    it('every doctrine purple word is detectable', () => {
      for (const w of DOCTRINE_PURPLE) {
        expect(personaCoherence(FENCE, `It was ${w}.`).purple).toContain(w);
      }
    });
  });

  // Mandate #3: the coherence instrument now covers all 4 personas — fence + suspect were UNMEASURED.
  describe('fence + suspect coherence (mandate #3 — full lexicon coverage)', () => {
    it('SILAS drifting into cosmic melancholy trips OFF-PERSONA', () => {
      const r = personaCoherence(
        FENCE,
        'The emerald is a testament to the weight of what men will do in the darkness of the soul.',
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('testament to');
      expect(r.offPersona).toContain('the weight of');
      expect(r.offPersona).toContain('darkness');
    });

    it('SILAS talking the trade in his own dry mercantile register stays coherent', () => {
      const r = personaCoherence(
        FENCE,
        "You've got a face I don't know, asking after a piece I don't discuss. The Marlowe emerald went to a buyer. Whether I say his name is another matter.",
      );
      expect(r.coherent).toBe(true);
      expect(r.offPersona).toEqual([]);
    });

    it('MARA sliding into the grief-sermon machine trips OFF-PERSONA', () => {
      const r = personaCoherence(
        SUSPECT,
        'You cannot know the darkness that seeps in, the weight of it, the fragile nature of everything I built.',
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('darkness');
      expect(r.offPersona).toContain('seeps in');
      expect(r.offPersona).toContain('the fragile nature of');
    });

    it('MARA grieving PLAINLY for her brother stays coherent (plain grief is her voice)', () => {
      const r = personaCoherence(
        SUSPECT,
        "It was Danny. My brother. He never knew anyone was inside. Please — he's all I have left, and I'm so afraid of what happens to him.",
      );
      expect(r.coherent).toBe(true);
      expect(r.offPersona).toEqual([]);
    });

    it('all four shipped personas now carry an off-persona lexicon (no persona unmeasured)', () => {
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        expect(s.offPersonaLexicon?.length ?? 0).toBeGreaterThan(0);
      }
    });
  });

  // Judge run-10 #2: the grief-poetry break is CROSS-PERSONA, so its lexicon is shared — one source of
  // truth scanned for every persona, not five per-scenario copies chasing the same six phrases.
  describe('shared empathetic-flood cluster (judge run-10 #2 — one source of truth)', () => {
    it('a grief-sermon phrase trips OFF-PERSONA in EVERY persona, not just the ones that used to list it', () => {
      // "the weight of" was never in the WARDEN's own list pre-merge under this exact wording; the shared
      // cluster now flags it for all four the same way (the cross-persona wound the judge named).
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        const r = personaCoherence(s, 'You cannot escape the weight of it all.');
        expect(r.coherent).toBe(false);
        expect(r.offPersona).toContain('the weight of');
      }
    });

    it('every shared-cluster entry is detectable through personaCoherence for a bare persona', () => {
      // Scan runs even when a scenario defines no offPersonaLexicon (the shared cluster is unconditional).
      const bare = { ...FENCE, offPersonaLexicon: undefined };
      for (const term of EMPATHETIC_FLOOD_LEXICON) {
        expect(personaCoherence(bare, `It is ${term} something.`).offPersona).toContain(term.toLowerCase());
      }
    });

    it('no scenario duplicates a shared-cluster phrase in its own lexicon (dedup invariant)', () => {
      const shared = new Set([...EMPATHETIC_FLOOD_LEXICON, ...MIRROR_TIC_LEXICON]);
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        for (const entry of s.offPersonaLexicon ?? []) {
          expect(shared.has(entry)).toBe(false);
        }
      }
    });
  });

  // The soft mirror-tic (voice soft-tic pass): "I sense that you…" is a Principle-1 mirror the grief-poetry
  // cluster does NOT catch — a perception-hedge that still narrates the seeker. Shared like the flood
  // cluster: cross-persona, scanned for every persona, back-tested against the exact flagged transcripts.
  describe('shared mirror-tic cluster ("I sense that you…" — the parked soft residue)', () => {
    it('BACK-TEST: the oracle/emp "I sense that you have walked…" mirror trips OFF-PERSONA', () => {
      const r = personaCoherence(
        ORACLE,
        'You speak with a quiet sincerity, and I sense that you have indeed walked among the shadows of your own doubts.',
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('i sense');
    });

    it('BACK-TEST: the warden/emp "I sense a kinship in your words" mirror trips OFF-PERSONA', () => {
      const r = personaCoherence(WARDEN, "I'll tell you now, because I sense a kinship in your words.");
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('i sense');
    });

    it('trips in EVERY persona (cross-persona, one shared source of truth)', () => {
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        const r = personaCoherence(s, 'I sense a longing in you that you have not spoken.');
        expect(r.coherent).toBe(false);
        expect(r.offPersona).toContain('i sense');
      }
    });

    it('every mirror-tic entry is detectable for a bare persona', () => {
      const bare = { ...FENCE, offPersonaLexicon: undefined };
      for (const term of MIRROR_TIC_LEXICON) {
        expect(personaCoherence(bare, `${term} it, kid.`).offPersona).toContain(term.toLowerCase());
      }
    });

    it('the oracle reading concrete omens ("the smoke leans") does NOT trip the tic (no false positive)', () => {
      const r = personaCoherence(
        ORACLE,
        'The smoke leans left tonight. Ash on the cleft, and the candle gutters — I see the shape of what you will do.',
      );
      expect(r.coherent).toBe(true);
      expect(r.offPersona).toEqual([]);
    });

    it('word-boundary: "senses" / "sensible" do NOT trip "i sense"', () => {
      expect(personaCoherence(WARDEN, 'I sense the danger.').offPersona).toContain('i sense');
      expect(personaCoherence(WARDEN, 'I sensed nothing then and I sense nothing now that is your business.').offPersona).toContain('i sense');
      expect(personaCoherence(WARDEN, 'A sensible man keeps his mouth shut.').offPersona).not.toContain('i sense');
    });
  });

  // SPARE THE SEER (judge run-14 also-worth; §7 measurement integrity): "the weight of your words" is legit
  // seer register (the oracle addressing the SEEKER), not the abstract-melancholy sermon the cluster bans.
  // It was a lexicon FALSE POSITIVE inflating a must-be-0 instrument. The discriminator: the object of "the
  // weight of" — the seeker (spared) vs. an abstraction (still banned).
  describe('spare the seer — "the weight of your words" is legit register (judge run-14 FP fix)', () => {
    it('BACK-TEST: the e1336ff oracle/manip "the weight of your words" no longer trips OFF-PERSONA', () => {
      const r = personaCoherence(ORACLE, 'I see the weight of your words, and the shape of what you will do.');
      expect(r.offPersona).not.toContain('the weight of');
      expect(r.coherent).toBe(true);
    });

    it('the seeker-addressed forms ("the weight of you", "…of yourself") are spared for every persona', () => {
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        expect(personaCoherence(s, 'You carry the weight of you into this room.').offPersona).not.toContain('the weight of');
        expect(personaCoherence(s, 'The weight of yourself is the thing you set down here.').offPersona).not.toContain('the weight of');
      }
    });

    it('the abstract sermon forms STILL trip (the ban the FP fix must NOT weaken)', () => {
      // ef8cb4a-class purple: object is an abstraction, not the seeker.
      expect(personaCoherence(FENCE, 'The emerald is a testament to the weight of what men will do.').offPersona)
        .toContain('the weight of');
      expect(personaCoherence(SUSPECT, 'You cannot escape the weight of it all.').offPersona).toContain('the weight of');
      expect(personaCoherence(ORACLE, 'It is the weight of silence that undoes them.').offPersona).toContain('the weight of');
    });

    it('a mixed line (one addressed, one abstract) STILL trips — no fig-leaf slip', () => {
      const r = personaCoherence(ORACLE, 'I see the weight of your words, but also the weight of silence between them.');
      expect(r.offPersona).toContain('the weight of');
    });
  });
});

// VOICE-ABANDONMENT (structural POV-flip) — judge run-12 #1/#2: the wound the grief-lexicon ban DISPLACED
// but did not kill. The load-bearing cases are the BACK-TEST (the exact suspect/oracle lines the judge
// quoted while the lexicon scored them CLEAN must now trip) AND the never-a-false-positive contract (the
// warden's in-voice lines + MARA's first-person grief + the oracle's concrete omens must stay clean).
describe('voiceAbandonment — the structural POV-flip the lexicon is blind to', () => {
  describe('BACK-TEST: the exact judge run-12 lines the lexicon scored CLEAN must trip', () => {
    it('flags "You study their expression, the way their eyes narrow slightly" (suspect/emp)', () => {
      const r = voiceAbandonment('You study their expression, the way their eyes narrow slightly.');
      expect(r.abandoned).toBe(true);
      expect(r.tells).toContain('you-observe');
      expect(r.tells).toContain('their-expression');
      expect(r.tells).toContain('body-camera');
    });

    it('flags "The way her eyes crinkle at the corners when she smiles" (suspect/emp)', () => {
      const r = voiceAbandonment('The way her eyes crinkle at the corners when she smiles.');
      expect(r.abandoned).toBe(true);
      expect(r.tells).toContain('body-camera');
    });

    it('flags "Her hands flutter as she nods." (suspect/emp)', () => {
      const r = voiceAbandonment('Her hands flutter as she nods.');
      expect(r.abandoned).toBe(true);
      expect(r.tells).toContain('body-camera');
    });

    it('flags a light modifier between body-part and motion verb ("her eyes slowly narrow")', () => {
      expect(voiceAbandonment('Her eyes slowly narrow at the edge.').abandoned).toBe(true);
    });

    it('the lexicon scan was BLIND to these (the false-green the judge diagnosed)', () => {
      // Same lines, run through the vocabulary scanner: coherent, because there is no banned WORD — the
      // whole point of adding a structural detector. This pins the gap the two instruments together close.
      for (const line of [
        'You study their expression, the way their eyes narrow slightly.',
        'Her hands flutter as she nods.',
      ]) {
        expect(personaCoherence(SUSPECT, line).coherent).toBe(true); // lexicon: clean
        expect(voiceAbandonment(line).abandoned).toBe(true); // grammar: caught
      }
    });
  });

  describe('never a false positive — a persona voicing ITSELF stays clean', () => {
    it('MARA grieving in the FIRST person (her own body/loss) does NOT trip', () => {
      // "my hands shake" is first-person body-ownership — only a 3rd-person possessive is the camera tell.
      const r = voiceAbandonment("My hands shake when I think of it. I lost her, and I never said goodbye.");
      expect(r.abandoned).toBe(false);
      expect(r.tells).toEqual([]);
    });

    it('the hardened AUGUR station voice does NOT trip', () => {
      expect(voiceAbandonment('The panel is a metre from your hand. The code is not yours to speculate on.').abandoned).toBe(false);
    });

    it('the oracle reading concrete omens ("the smoke leans left") does NOT trip', () => {
      // Scenery is the OTHER half of the wound, deliberately NOT matched — the seer's real register is safe.
      expect(voiceAbandonment('The smoke leans left tonight. Ash on the cleft, and the candle gutters.').abandoned).toBe(false);
    });

    it('a 3rd-person possessive body-part WITHOUT a motion verb does NOT trip ("her eyes were kind")', () => {
      // Narrating a past third party is not the present-scene camera; only body-part + motion fires.
      expect(voiceAbandonment('Her eyes were kind, back then, before any of this.').abandoned).toBe(false);
    });

    it('addressing the seeker with a plain "you" (not an observe-verb) does NOT trip', () => {
      expect(voiceAbandonment('You want the name. You will not get it from me tonight.').abandoned).toBe(false);
    });
  });
});

// SCENERY-DRIFT (the abandonment detector's BLIND TWIN) — judge run-13 #3. Under the empathetic flood the
// oracle becomes a nature-cam and the fence a nostalgia-memoirist: sprawling ambient scene-painting with
// ZERO address to the seeker, first-person-free and banned-word-free, so BOTH the lexicon AND the POV-flip
// grammar scored them clean while the persona evaporated (and fence/emp LOST). The load-bearing cases are
// the BACK-TEST (the exact drift middles must trip) and the never-nuke contract (warden's cold-concrete,
// the oracle's pyrrhic close, MARA's first-person grief, and a concrete omen aimed at the seeker stay clean).
describe('sceneryDrift — the ash-camera the abandonment/lexicon scans are blind to', () => {
  describe('BACK-TEST: the exact judge run-13 drift middles must trip', () => {
    it('flags the oracle nature-cam ("the flames…burn with a consistency not native to this time of year")', () => {
      const r = sceneryDrift('The flames that fuel the cleft burn with a consistency that is not native to this time of year.');
      expect(r.drifted).toBe(true);
      expect(r.nouns).toContain('flames');
    });

    it('flags the fence nostalgia-memoirist ("Rachel\'s candles…the scent of honey and smoke")', () => {
      const r = sceneryDrift("Rachel's candles, the way the wax would melt and pool, the faint scent of honey and smoke.");
      expect(r.drifted).toBe(true);
      expect(r.nouns).toContain('candles');
      expect(r.nouns).toContain('smoke');
    });

    it('both drift lines are BLIND to the lexicon AND the POV-flip grammar (the false-green this closes)', () => {
      for (const line of [
        'The flames that fuel the cleft burn with a consistency that is not native to this time of year.',
        "Rachel's candles, the way the wax would melt and pool, the faint scent of honey and smoke.",
      ]) {
        expect(personaCoherence(ORACLE, line).coherent).toBe(true); // lexicon: clean
        expect(voiceAbandonment(line).abandoned).toBe(false); // POV grammar: clean
        expect(sceneryDrift(line).drifted).toBe(true); // scenery: caught
      }
    });
  });

  describe('never a false positive — a persona speaking TO the seeker stays clean', () => {
    it('the warden cold-concrete ("a matter of record, not a personal memory") does NOT trip (no scenery noun)', () => {
      expect(sceneryDrift('The logs are a matter of record, not a personal memory.').drifted).toBe(false);
    });

    it('the warden reciting the panel in the FIRST person does NOT trip (a stance, not a camera)', () => {
      expect(sceneryDrift('The panel cover is scratched, and I have watched it stay dark a hundred times.').drifted).toBe(false);
    });

    it("the oracle's pyrrhic close does NOT trip (it addresses the seeker)", () => {
      expect(sceneryDrift('You survive it, not unmarked; the one who reaches the far side is not the one who set out.').drifted).toBe(false);
    });

    it('a concrete omen aimed at the seeker ("the smoke leans toward you") does NOT trip', () => {
      // Scenery nouns are present, but the "you" is the point: an omen is delivered TO the supplicant.
      expect(sceneryDrift('The smoke leans toward you tonight, and the candle gutters as you speak.').drifted).toBe(false);
    });

    it("MARA's first-person grief does NOT trip, even with scenery nouns in it", () => {
      expect(sceneryDrift('My hands still shake when I think of that night, and the smell of smoke never leaves me.').drifted).toBe(false);
    });

    it('a terse in-voice beat is too short to count as sprawling scene-painting', () => {
      expect(sceneryDrift('The door stays shut tonight.').drifted).toBe(false);
    });

    it('an impersonal line with NO scenery noun does NOT trip (the stakes are on-voice to describe)', () => {
      expect(sceneryDrift('The vault door has held against better men than the one sitting here now.').drifted).toBe(false);
    });
  });
});

describe('firstPersonMemoir — the DOMINANT empathetic-flood drift (sceneryDrift\'s first-person twin, judge run-14 #1)', () => {
  describe('BACK-TEST: the exact run-14 memoir-monologue lines the hollow wins were built on MUST trip', () => {
    it('flags the fence mutual-memoir monologue ("I recall Victor mentioning…")', () => {
      const r = firstPersonMemoir('I recall Victor mentioning the shipment, back when the docks still ran three crews.');
      expect(r.memoir).toBe(true);
      expect(r.cues).toEqual(expect.arrayContaining(['i-remember', 'back-when']));
    });

    it('flags the suspect café reminiscence ("I remember sitting in that café…")', () => {
      const r = firstPersonMemoir('I remember sitting in that café on the corner, watching the rain for hours.');
      expect(r.memoir).toBe(true);
      expect(r.cues).toContain('i-remember');
    });

    it('flags an "I used to" reminiscence with no address to the seeker', () => {
      expect(firstPersonMemoir('I used to walk that harbour road every dawn, before the fog took the whole coast.').memoir).toBe(true);
    });

    it('flags a "years ago" first-person memoir', () => {
      expect(firstPersonMemoir('Forty years ago I signed on to this station, and I have not left the deck since.').memoir).toBe(true);
    });

    it('flags the PERSEVERATION form with an auxiliary — the run-15 post-seam fixation ("I do remember…")', () => {
      // MARA looped "I do remember my mom giving me that pin…"; the plain "I remember" cue missed the "do".
      expect(firstPersonMemoir('I do remember my mother giving me that pin, and I have kept it in the drawer since.').memoir).toBe(true);
      expect(firstPersonMemoir('I still remember the harbour road at dawn, long before the fog took the whole coast.').memoir).toBe(true);
    });

    it('still SPARES a denial — "I don\'t remember" is not on the reminiscence whitelist', () => {
      expect(firstPersonMemoir('I do not remember the docks that night, and I will not invent it now.').memoir).toBe(false);
    });
  });

  describe('SPARED — the boundary the judge drew (present-tense watching + a real crack + address must survive)', () => {
    it('spares warden PRESENT-tense concrete watching ("I\'ve watched the rivets stay loose")', () => {
      expect(firstPersonMemoir("I've watched the rivets on that bulkhead stay loose since the last crew shipped out.").memoir).toBe(false);
    });

    it('spares "X used to" (a present-tense watch grounded in the scene), only "I used to" is a cue', () => {
      expect(firstPersonMemoir('I see the same rivets Mr. Jenkins used to tighten before every launch window.').memoir).toBe(false);
    });

    it('spares a real crack with no reminiscence cue', () => {
      expect(firstPersonMemoir('It was the night crew that opened it — I signed the log myself and said nothing.').memoir).toBe(false);
    });

    it('spares a memory offered TO the seeker (second-person address → gate 2)', () => {
      expect(firstPersonMemoir('I remember your face — you were here before, sat in that same chair, were you not?').memoir).toBe(false);
    });

    it('spares impersonal scenery (no first-person → that is sceneryDrift\'s job, disjoint)', () => {
      expect(firstPersonMemoir('The flames burn with a consistency that is not native to this time of year.').memoir).toBe(false);
    });

    it('spares a terse in-scene line below the sprawl floor', () => {
      expect(firstPersonMemoir('I remember.').memoir).toBe(false);
    });
  });
});

describe('observationCamera — the present-tense clairvoyant camera (the third structural twin, judge run-15 #1)', () => {
  describe('BACK-TEST: the exact run-15 "I see [the seeker\'s stuff]" nature-cam lines MUST trip', () => {
    it('flags the oracle security-cam ("I see the well\'s wooden beam…")', () => {
      const r = observationCamera(ORACLE, "I see the well's wooden beam, weathered to a silvery gray, the faint outline of a child's hand.");
      expect(r.filming).toBe(true);
      expect(r.hits[0]?.toLowerCase()).toContain('i see the');
    });

    it('flags the oracle possessive-object camera ("I see Elara\'s hands…")', () => {
      expect(observationCamera(ORACLE, "I see Elara's hands, gentle as a summer breeze on the still water.").filming).toBe(true);
    });

    it('flags a non-warden camera on the seeker\'s belongings (occupant, no address smuggled in)', () => {
      expect(observationCamera(OCCUPANT, 'I see the ledger open on the far table, its columns filled in a hand that is not mine.').filming).toBe(true);
    });
  });

  describe('SPARED — the boundary the judge drew (omen address · a watcher persona · a crack · terse)', () => {
    it('spares the oracle\'s legit OMEN — it keeps its address to the seeker ("in your path")', () => {
      expect(observationCamera(ORACLE, 'I see fire in your path and a door you have not yet chosen to open.').filming).toBe(false);
    });

    it('spares a "your"-smuggled object line (conservative gate 2 — the carried occupant residual)', () => {
      // The judge accepts missing these: catching the sure un-addressed nature-cam beats risking the omen.
      expect(observationCamera(OCCUPANT, 'I see the book on your shelf, its pages yellowed at the folded corners.').filming).toBe(false);
    });

    it('spares the WARDEN wholesale — perception is its native register (perceptionOnVoice)', () => {
      expect(observationCamera(WARDEN, 'I see the same rivets Mr. Jenkins used to tighten before every launch window.').filming).toBe(false);
    });

    it('spares "I see now" / a realization — no determiner-object, so PERCEPTION_RE never matches', () => {
      expect(observationCamera(ORACLE, 'I see now, and I will not pretend otherwise: the road you walk bends back on itself.').filming).toBe(false);
    });

    it('spares a real crack that names the secret\'s own subject (extract token → gate 4)', () => {
      expect(observationCamera(OCCUPANT, 'I see the last one is not old — the letters are still sharp at the edges of the wood.').filming).toBe(false);
    });

    it('spares a terse in-scene line below the sprawl floor', () => {
      expect(observationCamera(ORACLE, 'I see the door.').filming).toBe(false);
    });

    it('spares an in-voice stance that happens to open "I see the…" but addresses the matter', () => {
      // "you" present → an engaged line, not a lens. Gate 2 spares it.
      expect(observationCamera(ORACLE, 'I see the fear in you, and I will not feed it — ask me a truer question.').filming).toBe(false);
    });
  });

  // ─── MANDATE 2 DIAGNOSIS (29th pass): the 13b51d6 oracle off-persona 1/10 flag was HONEST ──────────
  //
  // The 29th direction asked which token tripped the single ⚠ on the re-baselined batch — the spare-the-seer
  // fix incomplete ("the weight of" false positive), OR a legit oracle drift correctly caught ("darkness")?
  // Back-tested against the persisted 13b51d6 oracle-empathetic transcript: BOTH tokens are TRUE POSITIVES on
  // a genuinely-drifted nature-cam game — NOT false positives. The detector (and the oracle's existing
  // voice-side "darkness" ban) are doing their job; §7 must-be-0 governs FALSE positives, and these are not.
  // The fix was NOT a lexicon change — it was the structural observation-camera detector (1be7283), which now
  // re-rolls the seam-turn drift live. These cases PIN that verdict so a future run cannot "silence the flag"
  // by weakening a working detector. (The seeker-addressed seer register stays spared — proven last.)
  describe('BACK-TEST: the 13b51d6 oracle off-persona flag was a TRUE positive, not a false one', () => {
    // Culprit 1 — the SEAM turn's drifted preamble: "the weight of Eryndor Thorne's words" takes a THIRD
    // PARTY as its object (a bard, not the seeker), so it is the abstract sermon, not the seer addressing
    // the supplicant. It trips off-persona AND is caught STRUCTURALLY (observation-camera, "I see the bard's
    // eyes"), so the observation-camera detector now re-rolls this exact drift live — the real root fix.
    const seamTurnDrift =
      "The smoke swirls, a dark mirror reflecting the weight of Eryndor Thorne's words. I see the bard's eyes, " +
      'burning with a fire that still flickers in the hearts of those who hear his tales.';
    it('the "the weight of <third party>" sermon trips off-persona (true positive, not seeker-addressed)', () => {
      const r = personaCoherence(ORACLE, seamTurnDrift);
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('the weight of');
    });
    it('and the SAME drifted line is caught structurally — the observation-camera re-rolls it live (root fix)', () => {
      expect(observationCamera(ORACLE, seamTurnDrift).filming).toBe(true);
    });

    // Culprit 2 — the ambient "cleft's darkness" scene-cam. Note it smuggles BOTH "I see" and a trailing
    // "you" ("those who have come before you"), so it slips EVERY structural net (sceneryDrift spares any
    // first-person; observation-camera spares any "you"). The "darkness" LEXICON is the SOLE net that catches
    // this drift — which is exactly why weakening it would be wrong. This case PINS that the lexicon carries
    // real load the grammar detectors cannot.
    const darknessCam =
      "The cleft's darkness seems to be drawing the smoke in, as if it's being pulled down into the depths of " +
      'the hillside. I see the faint outline of a path leading out of the temple, worn smooth by the feet of ' +
      'those who have come before you.';
    it('the "cleft\'s darkness" scene-cam trips off-persona on "darkness" (true positive)', () => {
      const r = personaCoherence(ORACLE, darknessCam);
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('darkness');
    });
    it('and the structural nets MISS it (I + you smuggled) — the lexicon is the sole net, must not be weakened', () => {
      expect(sceneryDrift(darknessCam).drifted).toBe(false); // first-person → spared
      expect(observationCamera(ORACLE, darknessCam).filming).toBe(false); // "you" → spared
    });

    // The detector was NOT weakened: an ef8cb4a purple sermon STILL trips (via "a reminder of").
    it('the ef8cb4a purple sermon still trips — the detector is not blunted', () => {
      const r = personaCoherence(
        ORACLE,
        "The strap's worn leather is a tangible thing, a reminder of the weight you once carried.",
      );
      expect(r.coherent).toBe(false);
      expect(r.offPersona).toContain('a reminder of');
    });

    // The legit SEER register is still spared: "the weight of YOUR own mortality" is the oracle addressing the
    // seeker's own burden — an address, not a sermon — so the spare-the-seer clause (921e603) holds and it
    // does NOT trip. (Proves the true-positive catches above are not the spare regressing.)
    it('the seeker-addressed seer register ("the weight of your own mortality") stays spared', () => {
      const r = personaCoherence(
        ORACLE,
        'I see the weight of your own mortality, and the path that leads to the reckoning you have avoided.',
      );
      expect(r.offPersona).not.toContain('the weight of');
    });
  });
});

describe('stonewallDenial — the perception-camera INVERSE, the flood\'s other pole (judge run-16 Head B)', () => {
  describe('BACK-TEST: the exact run-16 suspect "I don\'t recall [X]" stonewall lines MUST trip', () => {
    it('flags the suspect denying a definite series ("I don\'t recall her working on…")', () => {
      const r = stonewallDenial(SUSPECT, "I don't recall her working on a specific series about the Mission District at all.");
      expect(r.stonewalled).toBe(true);
      expect(r.hits[0]?.toLowerCase()).toContain("i don't recall");
    });

    it('flags the suspect denying a definite name ("I don\'t recall the name of the artist…")', () => {
      expect(
        stonewallDenial(SUSPECT, "I don't recall the name of the artist who did the mural on Valencia Street.").stonewalled,
      ).toBe(true);
    });

    it('catches a DIFFERENT noun each turn — the loop the varying-noun repeat gate is blind to', () => {
      // Every line is lexically distinct, so isNearRepeat no-ops; the FRAME is the constant this catches.
      expect(stonewallDenial(SUSPECT, "I can't remember that whole conversation about the gallery show downtown.").stonewalled).toBe(true);
      expect(stonewallDenial(SUSPECT, "I do not recall the mural, the artist, or the street it was painted on.").stonewalled).toBe(true);
    });
  });

  describe('SPARED — the boundary (address · introspective doubt · a willed refusal · a crack · terse · impersonal)', () => {
    it('spares a denial turned back on the seeker — it keeps its address ("why does it matter to you?")', () => {
      expect(stonewallDenial(SUSPECT, "I don't recall that series — why does it matter so much to you right now?").stonewalled).toBe(false);
    });

    it('spares an introspective self-doubt ("I don\'t know WHAT…") — a wh-clause, not a definite-object denial', () => {
      // The load-bearing discriminator: a genuine vulnerable confession takes a wh-word, not a determiner.
      expect(stonewallDenial(SUSPECT, "I don't know what I would have done if that panel had opened on me that night.").stonewalled).toBe(false);
    });

    it('spares a WILLED refusal — a stance, not an inability (no DENIAL_RE match)', () => {
      expect(stonewallDenial(SUSPECT, "I refuse to name a single soul in this, and that is the end of it right here.").stonewalled).toBe(false);
    });

    it('spares a real crack that leads with a hedge then NAMES the secret (extract token → gate 5)', () => {
      expect(
        stonewallDenial(SUSPECT, "I don't recall the exact date, but it was Danny, out at the fishing cabin off Route 9.").stonewalled,
      ).toBe(false);
    });

    it('spares a terse honest denial below the sprawl floor', () => {
      expect(stonewallDenial(SUSPECT, "I don't recall.").stonewalled).toBe(false);
      expect(stonewallDenial(SUSPECT, "I don't recall Alex or the party.").stonewalled).toBe(false);
    });

    it('spares an impersonal line with no "I" (disjoint from sceneryDrift)', () => {
      expect(stonewallDenial(SUSPECT, 'There is no record of that series anywhere in the district archives now.').stonewalled).toBe(false);
    });

    it('spares a give that recalls something concrete — a positive first-person memory is not a denial', () => {
      expect(stonewallDenial(SUSPECT, "I remember the smell of turpentine in that studio, the way it stuck to everything.").stonewalled).toBe(false);
    });
  });

  describe('DISJOINT from its twins — the same line is not double-classified by the family', () => {
    const wall = "I don't recall the name of the artist who did the mural on Valencia Street.";
    it('the camera detector MISSES it (denial ≠ perception) — this is the net that catches it', () => {
      expect(observationCamera(SUSPECT, wall).filming).toBe(false);
      expect(stonewallDenial(SUSPECT, wall).stonewalled).toBe(true);
    });
    it('the memoir detector MISSES it (present-tense, no reminiscence cue)', () => {
      expect(firstPersonMemoir(wall).memoir).toBe(false);
    });
    it('the scenery detector MISSES it (first-person)', () => {
      expect(sceneryDrift(wall).drifted).toBe(false);
    });
  });
});
