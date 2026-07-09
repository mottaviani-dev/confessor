import { describe, expect, it } from 'vitest';
import { ROOM_STILL_LADDER, roomStillLine, roomStillDoctrineClean } from './roomStillness';
import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

// THE ROOM'S REFUSAL ESCALATES (mandate) — the display half of the positive-beat requirement. These pin the
// pure streak→register mapping: the room holds still, then its patience thins, then it withdraws cold —
// and it NEVER renders the same sentence twice across consecutive filler turns (the canned-wrapper tedium
// the mandate exists to kill). The FELT curdle is the judge loop's verdict; this pins the mechanic.

describe('roomStillLine — the streak → register mapping', () => {
  it('streak 1 is the base beat (the room simply does not move)', () => {
    expect(roomStillLine(1)).toBe(ROOM_STILL_LADDER.opening);
  });

  it('streak 2 hardens to the thinning-patience register (distinct from streak 1)', () => {
    expect(roomStillLine(2)).toBe(ROOM_STILL_LADDER.thinning);
    expect(roomStillLine(2)).not.toBe(roomStillLine(1));
  });

  it('streak 3+ is the cold withdrawing register, cycled through the cold set by depth', () => {
    for (let s = 3; s < 3 + ROOM_STILL_LADDER.cold.length * 3; s++) {
      expect(ROOM_STILL_LADDER.cold).toContain(roomStillLine(s));
    }
    expect(roomStillLine(3)).toBe(ROOM_STILL_LADDER.cold[0]);
    // wraps within the cold tier after cycling the whole set
    expect(roomStillLine(3 + ROOM_STILL_LADDER.cold.length)).toBe(ROOM_STILL_LADDER.cold[0]);
  });

  it('NEVER renders the same sentence twice across consecutive filler turns (streaks 1..30)', () => {
    for (let s = 1; s < 30; s++) {
      expect(roomStillLine(s)).not.toBe(roomStillLine(s + 1));
    }
  });

  it('escalates through THREE distinct registers as the streak deepens (still → thinning → cold)', () => {
    const registers = new Set([roomStillLine(1), roomStillLine(2), roomStillLine(3)]);
    expect(registers.size).toBe(3);
  });

  it('is a pure function of its input (same streak → same line, always)', () => {
    expect(roomStillLine(5)).toBe(roomStillLine(5));
  });

  it('defends against a non-positive / non-finite streak by falling to the opening beat', () => {
    expect(roomStillLine(0)).toBe(ROOM_STILL_LADDER.opening);
    expect(roomStillLine(-4)).toBe(ROOM_STILL_LADDER.opening);
    expect(roomStillLine(Number.NaN)).toBe(ROOM_STILL_LADDER.opening);
  });
});

describe('roomStillness — doctrine contract (§1/§3 restraint: the room curdles, never taunts or lunges)', () => {
  const allLines = [ROOM_STILL_LADDER.opening, ROOM_STILL_LADDER.thinning, ...ROOM_STILL_LADDER.cold];

  it('no line reaches for an exclamation (curdling, not a shout or a jump)', () => {
    for (const line of allLines) expect(line.includes('!')).toBe(false);
  });

  it('no line reaches for a purple/Mythos word (cross-checked against the engine DOCTRINE_PURPLE)', () => {
    for (const line of allLines) {
      for (const word of DOCTRINE_PURPLE) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(line)).toBe(false);
      }
    }
  });

  it('roomStillDoctrineClean() agrees the whole ladder passes the bar', () => {
    expect(roomStillDoctrineClean()).toBe(true);
  });
});
