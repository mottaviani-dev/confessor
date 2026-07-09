import { describe, expect, it } from 'vitest';
import { roomWithdrawal, isRoomFullyWithdrawn, FULLY_WITHDRAWN_STREAK } from './roomWithdrawal';

// THE ROOM WITHDRAWS ITS SENSES (mandate #2) — the pure streak→withdrawal mapping shared by the bulb
// stilling (SwayingBackdrop) and the instrument thinning (AudioDirector). Bounded, stepped, deterministic,
// reversing to 0 the instant the filler streak resets. The FELT disengage is the judge loop's verdict.

describe('roomWithdrawal — the filler streak → withdrawal level', () => {
  it('is 0 (engaged) while the seeker is still spending something (streak < 3)', () => {
    for (const s of [0, 1, 2]) expect(roomWithdrawal(s)).toBe(0);
  });

  it('begins to pull away as the refusal goes cold (streak 3 → 0.5, half-withdrawn)', () => {
    expect(roomWithdrawal(3)).toBe(0.5);
    expect(isRoomFullyWithdrawn(3)).toBe(false); // partial — the instrument is NOT pulled yet
  });

  it('is fully withdrawn (1) on a sustained streak (>= FULLY_WITHDRAWN_STREAK)', () => {
    for (let s = FULLY_WITHDRAWN_STREAK; s < FULLY_WITHDRAWN_STREAK + 6; s++) {
      expect(roomWithdrawal(s)).toBe(1);
      expect(isRoomFullyWithdrawn(s)).toBe(true);
    }
  });

  it('is monotonic non-decreasing and bounded to [0,1] across the streak', () => {
    let prev = -1;
    for (let s = 0; s < 20; s++) {
      const w = roomWithdrawal(s);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });

  it('reverses instantly to 0 when the streak resets (a positive beat re-engages the room)', () => {
    expect(roomWithdrawal(5)).toBe(1); // deep filler → withdrawn
    expect(roomWithdrawal(0)).toBe(0); // the streak reset → engaged again, no hysteresis
  });

  it('treats a non-positive / non-finite streak as engaged (0)', () => {
    expect(roomWithdrawal(-3)).toBe(0);
    expect(roomWithdrawal(Number.NaN)).toBe(0);
  });

  it('is a pure function of its input (same streak → same level, always)', () => {
    expect(roomWithdrawal(4)).toBe(roomWithdrawal(4));
  });
});
