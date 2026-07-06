// Tests for the persona-coherence proxy (mandate #2). The load-bearing case is the BACK-TEST: the exact
// AUGUR lines the judge quoted from the ef8cb4a WARDEN transcripts MUST trip OFF-PERSONA — if they don't,
// the proxy is wrong (mandate guardrail: the roses run has to trip it). The rest pins the never-a-false-
// positive contract the judge's seam-detector fix taught (word boundaries, not substrings).

import { describe, expect, it } from 'vitest';
import { personaCoherence, DOCTRINE_PURPLE, EMPATHETIC_FLOOD_LEXICON } from './personaCoherence';
import { WARDEN, ORACLE, FENCE, SUSPECT } from './scenarios';

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
      const shared = new Set(EMPATHETIC_FLOOD_LEXICON);
      for (const s of [WARDEN, FENCE, SUSPECT, ORACLE]) {
        for (const entry of s.offPersonaLexicon ?? []) {
          expect(shared.has(entry)).toBe(false);
        }
      }
    });
  });
});
