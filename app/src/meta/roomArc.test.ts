import { describe, expect, it } from 'vitest';
import { roomArc, roomArcDoctrineClean, ROOM_ARC_FRAGMENTS } from './roomArc';
import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

// THE ROOM META-ARC — the fifth secret drip-fed across sessions (director mandate #1). These prove the
// engine-owned half: pure, deterministic, advancing one beat per finished game, never repeating a spent
// beat out of order, capping on the last, and doctrine-clean (ends on a question, no purple). The FELT
// dread of the beat is the judge loop's verdict; this pins the mechanic only we can build.

describe('roomArc — the fifth secret, one beat per finished game', () => {
  it('has not begun before the first finished game (null, like homecoming\'s clean case)', () => {
    expect(roomArc(0)).toBeNull();
    expect(roomArc(-3)).toBeNull();
  });

  it('surfaces the FIRST fragment after one finished game', () => {
    const beat = roomArc(1);
    expect(beat).not.toBeNull();
    expect(beat!.index).toBe(0);
    expect(beat!.line).toBe(ROOM_ARC_FRAGMENTS[0]);
    expect(beat!.final).toBe(false);
  });

  it('advances EXACTLY ONE beat per finished game (deterministic — scheduled, not rolled)', () => {
    for (let games = 1; games <= ROOM_ARC_FRAGMENTS.length; games++) {
      expect(roomArc(games)!.index).toBe(games - 1);
    }
  });

  it('is a pure function of the count (same count → same beat, always)', () => {
    expect(roomArc(3)).toEqual(roomArc(3));
  });

  it('never surfaces a beat the arc has not reached, and never repeats out of order', () => {
    // Each finished game reveals a strictly later fragment — the arc only ever moves forward.
    const seen = [1, 2, 3, 4].map((g) => roomArc(g)!.index);
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(new Set(seen).size).toBe(seen.length); // no repeat
  });

  it('CAPS gracefully on the last beat — it does not wrap or run off the end', () => {
    const total = ROOM_ARC_FRAGMENTS.length;
    const last = roomArc(total)!;
    expect(last.index).toBe(total - 1);
    expect(last.final).toBe(true);
    // Well past the end, the arc stays on the final beat (no wrap, no crash).
    const wayPast = roomArc(total + 50)!;
    expect(wayPast.index).toBe(total - 1);
    expect(wayPast.final).toBe(true);
    expect(wayPast.line).toBe(last.line);
  });

  it('reports the total for a diegetic "how far in" read', () => {
    expect(roomArc(1)!.total).toBe(ROOM_ARC_FRAGMENTS.length);
  });
});

describe('roomArc — doctrine contract (§1-P3 / §4: a question, never an answer)', () => {
  it('every fragment ENDS ON A QUESTION', () => {
    for (const f of ROOM_ARC_FRAGMENTS) {
      expect(f.trim().endsWith('?')).toBe(true);
    }
  });

  it('no fragment reaches for a purple/Mythos word (scanned against DOCTRINE_PURPLE)', () => {
    for (const f of ROOM_ARC_FRAGMENTS) {
      for (const word of DOCTRINE_PURPLE) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(f)).toBe(false);
      }
    }
  });

  it('roomArcDoctrineClean() agrees the whole set passes the bar', () => {
    expect(roomArcDoctrineClean()).toBe(true);
  });

  it('has at least the authored fragments and holds a stable ordered story', () => {
    expect(ROOM_ARC_FRAGMENTS.length).toBeGreaterThanOrEqual(5);
  });
});
