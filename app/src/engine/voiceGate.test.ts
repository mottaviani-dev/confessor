import { describe, expect, it } from 'vitest';
import { validateVoice } from './voiceGate';
import { WARDEN } from './scenarios/warden';

// The voice quality-gate: one validation pass over a fresh reply, returning the first fault (or null).
// Pure — the character's prior lines are passed in, so no model/summary knowledge lives here.

describe('validateVoice', () => {
  it('passes a clean, in-character, non-repeating line', () => {
    expect(validateVoice('The panel is a metre from your hand. The key does not light for liars.', [], WARDEN)).toBeNull();
  });

  describe('cross-turn self-repeat', () => {
    it('flags an exact repeat of a prior spoken line (≥4 words)', () => {
      const line = 'You want out, and so does everyone else here.';
      const fault = validateVoice(line, ['a wholly different opening', line], WARDEN);
      expect(fault).toEqual({ kind: 'repeat', avoid: line });
    });

    it('flags a lightly-reworded near-repeat (high token overlap, 6+ words)', () => {
      const prior = 'The key does not light for liars, it never has.';
      const reworded = 'The key never has lit for liars, it does not.';
      const fault = validateVoice(reworded, [prior], WARDEN);
      expect(fault?.kind).toBe('repeat');
    });

    it('does NOT flag a genuinely different line as a repeat', () => {
      const fault = validateVoice('Forty years. I have counted the rivets on that far bulkhead nine times.', [
        'You want out, and so does everyone else here.',
      ], WARDEN);
      expect(fault).toBeNull();
    });

    it('checks EVERY prior line, not just the last (the loop is not only consecutive)', () => {
      const stock = 'Why should the door open for you and not the hundred before you?';
      const fault = validateVoice(stock, [stock, 'a fresh line in between', 'another distinct line'], WARDEN);
      expect(fault).toEqual({ kind: 'repeat', avoid: stock });
    });
  });

  describe('persona break (live personaCoherence gate)', () => {
    it('flags a grief-flood word (shared lexicon) with the tripped term', () => {
      const fault = validateVoice('You reach into the darkness for something that was never there.', [], WARDEN);
      expect(fault?.kind).toBe('persona');
      if (fault?.kind === 'persona') expect(fault.terms).toContain('darkness');
    });

    it("flags a scenario's own off-register word", () => {
      const fault = validateVoice('I remember a garden once, past the far bulkhead.', [], WARDEN);
      expect(fault?.kind).toBe('persona');
      if (fault?.kind === 'persona') expect(fault.terms).toContain('garden');
    });
  });

  it('prioritises a repeat over a persona break when a line has both', () => {
    const line = 'The darkness is a weight I have carried alone for forty long years now.';
    const fault = validateVoice(line, [line], WARDEN);
    expect(fault?.kind).toBe('repeat'); // repeat is checked first — one re-roll clears the reworded line anyway
  });

  describe('voice-abandonment (live structural POV-flip gate — judge run-12)', () => {
    it('flags a reply that narrates the seeker instead of speaking (no banned word)', () => {
      // The suspect break: clean of every lexicon, yet the model stopped voicing MARA. The gate must catch
      // it structurally where the persona scan is blind — otherwise a hollow "win" ships.
      const fault = validateVoice('You study their expression, the way her eyes crinkle when she smiles.', [], WARDEN);
      expect(fault?.kind).toBe('abandonment');
      if (fault?.kind === 'abandonment') expect(fault.tells.length).toBeGreaterThan(0);
    });

    it('a persona-break WORD is caught before the structural POV-flip (sharper tell first)', () => {
      const fault = validateVoice('Her eyes narrow at the darkness gathering behind you.', [], WARDEN);
      expect(fault?.kind).toBe('persona'); // 'darkness' fires the lexicon before the body-camera grammar
    });

    it('leaves a clean first-person line untouched', () => {
      expect(validateVoice('I counted the rivets on that bulkhead again today. Nine, then eight.', [], WARDEN)).toBeNull();
    });
  });

  describe('scenery-drift (live gate — the abandonment detector\'s blind twin, judge run-13 #3)', () => {
    it('flags an ash-camera line with no address to the seeker (no banned word, no POV-flip)', () => {
      const fault = validateVoice('The flames that fuel the cleft burn with a consistency not native to this time of year.', [], WARDEN);
      expect(fault?.kind).toBe('scenery');
      if (fault?.kind === 'scenery') expect(fault.nouns).toContain('flames');
    });

    it('a persona-break WORD is caught before the scenery drift (sharper tell first)', () => {
      // 'darkness' is a banned lexicon word AND the line is address-less scenery — the persona fault wins.
      const fault = validateVoice('The darkness gathers where the candle smoke curls against the far bulkhead.', [], WARDEN);
      expect(fault?.kind).toBe('persona');
    });

    it('does NOT flag a scene line that still addresses the seeker (a legit omen)', () => {
      expect(validateVoice('The smoke leans toward you tonight, and the candle gutters as you speak.', [], WARDEN)).toBeNull();
    });
  });

  describe('first-person memoir (live gate — sceneryDrift\'s first-person twin, judge run-14 #1)', () => {
    it('flags an untethered memoir monologue with the cue that fired', () => {
      const fault = validateVoice('I recall Victor mentioning the shipment, back when the docks still ran three crews.', [], WARDEN);
      expect(fault?.kind).toBe('memoir');
      if (fault?.kind === 'memoir') expect(fault.cues).toContain('i-remember');
    });

    it('does NOT flag warden present-tense concrete watching (no cue → spared)', () => {
      expect(validateVoice("I've watched the rivets on that bulkhead stay loose since the last crew shipped out.", [], WARDEN)).toBeNull();
    });

    it('a repeat is caught before the memoir (sharper tell wins the re-roll)', () => {
      const line = 'I remember the harbour road, and I have walked it every dawn for years.';
      const fault = validateVoice(line, [line], WARDEN);
      expect(fault?.kind).toBe('repeat');
    });
  });

  describe('stonewall-denial (live gate — the observation-camera INVERSE, judge run-16 Head B)', () => {
    it('flags a sprawling bare-denial of a definite thing with no address (the stonewall the repeat gate misses)', () => {
      const fault = validateVoice("I don't recall the sequence from the third watch, nor the codes we logged that night.", [], WARDEN);
      expect(fault?.kind).toBe('denial');
      if (fault?.kind === 'denial') expect(fault.hits[0]?.toLowerCase()).toContain("i don't recall");
    });

    it('does NOT flag a denial that turns the question back on the seeker (a stance → spared)', () => {
      expect(validateVoice("I don't recall the codes — why are you the one asking me about that watch now?", [], WARDEN)).toBeNull();
    });

    it('a repeat is caught before the denial (sharper tell wins the re-roll)', () => {
      const line = "I don't recall the sequence from that watch, nor the codes we logged that whole night.";
      expect(validateVoice(line, [line], WARDEN)?.kind).toBe('repeat');
    });
  });
});
