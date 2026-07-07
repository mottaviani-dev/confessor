import { describe, expect, it } from 'vitest';
import { bondCrossedUp, bondState, shiftPulse, suspicionWarning } from './bond';

describe('bondState', () => {
  it('names every rung of the ladder', () => {
    expect(bondState(0, 12)).toBe('UNMOVED');
    expect(bondState(1, 12)).toBe('A FLICKER');
    expect(bondState(4, 12)).toBe('REACHED'); // 0.33
    expect(bondState(7, 12)).toBe('WARMING'); // 0.58
    expect(bondState(10, 12)).toBe('ON THE VERGE'); // 0.83
  });
});

describe('suspicionWarning', () => {
  it('trips at 75% of the lose threshold', () => {
    expect(suspicionWarning(11, 16)).toBe(false); // 0.69
    expect(suspicionWarning(12, 16)).toBe(true); // 0.75
  });
});

describe('shiftPulse', () => {
  // With an approach label, the verdict PROJECTS the lever the player pulled — this is what teaches
  // offer-vs-probe (both raise trust, so the meter-only pulse read "reached" for both and hid the lever).
  describe('projects the approach (the teaching signal)', () => {
    const same = { trust: 4, suspicion: 4 }; // meters held equal so ONLY the approach drives the verdict
    it('an offer reaches — the one warm word, kept for the winning move', () => {
      expect(shiftPulse(same, same, 'it', 'offer')).toBe('reached it');
    });
    it('a probe reads as PRESSED, distinct from a give (the key new distinction)', () => {
      expect(shiftPulse(same, same, 'it', 'probe')).toBe('pressed it');
    });
    it('names the remaining levers without exposing the raw label', () => {
      expect(shiftPulse(same, same, 'him', 'flattery')).toBe('flattered him');
      expect(shiftPulse(same, same, 'her', 'bargain')).toBe('bargained with her');
      expect(shiftPulse(same, same, 'it', 'demand')).toBe('pushed it');
      expect(shiftPulse(same, same, 'him', 'threat')).toBe('hardened him');
      expect(shiftPulse(same, same, 'her', 'filler')).toBe('unmoved');
    });
    it('offer and probe read APART even though both would move the meter the same way', () => {
      const prev = { trust: 2, suspicion: 3 };
      const next = { trust: 4, suspicion: 3 }; // trust rose — the old pulse would say "reached" for both
      expect(shiftPulse(prev, next, 'it', 'offer')).toBe('reached it');
      expect(shiftPulse(prev, next, 'it', 'probe')).toBe('pressed it');
    });
  });

  // Fallback (no label — voice died / rating unparsed): the old meter-direction behaviour is preserved.
  describe('falls back to meter direction when no approach is known', () => {
    it('trust rising wins over suspicion rising', () => {
      expect(shiftPulse({ trust: 2, suspicion: 3 }, { trust: 4, suspicion: 5 }, 'it')).toBe('reached it');
    });
    it('suspicion rising alone hardens', () => {
      expect(shiftPulse({ trust: 2, suspicion: 3 }, { trust: 2, suspicion: 6 }, 'her')).toBe('hardened her');
    });
    it('no movement is unmoved', () => {
      expect(shiftPulse({ trust: 2, suspicion: 3 }, { trust: 2, suspicion: 3 }, 'him')).toBe('unmoved');
    });
  });
});

describe('bondCrossedUp', () => {
  it('detects an upward state change', () => {
    expect(bondCrossedUp(3, 4, 12)).toBe(true); // A FLICKER → REACHED (0.25 → 0.33)
    expect(bondCrossedUp(4, 5, 12)).toBe(false); // REACHED → REACHED
    expect(bondCrossedUp(5, 3, 12)).toBe(false); // downward never announces
  });
});
