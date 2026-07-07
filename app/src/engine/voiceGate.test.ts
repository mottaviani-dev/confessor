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
});
