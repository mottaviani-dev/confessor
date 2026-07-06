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

describe('bondCrossedUp', () => {
  it('detects an upward state change', () => {
    expect(bondCrossedUp(3, 4, 12)).toBe(true); // A FLICKER → REACHED (0.25 → 0.33)
    expect(bondCrossedUp(4, 5, 12)).toBe(false); // REACHED → REACHED
    expect(bondCrossedUp(5, 3, 12)).toBe(false); // downward never announces
  });
});
