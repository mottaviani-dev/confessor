import { describe, expect, it } from 'vitest';
import {
  roomInterjection,
  roomInterjectionDoctrineClean,
  interjectionTurn,
  ROOM_INTERJECTION_FRAGMENTS,
} from './roomInterjection';
import { ROOM_ARC_FRAGMENTS } from './roomArc';
import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

// THE ROOM ANSWERS BACK — the fifth secret intrudes mid-duel (director mandate #2; story swing slice 2).
// These prove the engine-owned half: pure, deterministic, firing at most once per game on a single scheduled
// turn, deepening one beat per finished game in lock-step with the picker arc, capping on the last, and
// doctrine-clean (ends on a question, no purple). The FELT dread is the judge loop's verdict; this pins the
// mechanic only we can build.

const LIMIT = 12; // a representative turn budget; interjectionTurn(12) = 6

describe('roomInterjection — the fifth secret intrudes on one scheduled mid-duel turn', () => {
  it('has not begun before the first finished game (null on every turn, like the picker arc)', () => {
    for (let t = 0; t < LIMIT; t++) {
      expect(roomInterjection(t, LIMIT, 0)).toBeNull();
      expect(roomInterjection(t, LIMIT, -3)).toBeNull();
    }
  });

  it('fires on EXACTLY ONE turn per game — the scheduled midpoint, and no other', () => {
    const fireTurn = interjectionTurn(LIMIT);
    let fired = 0;
    for (let t = 0; t < LIMIT; t++) {
      const beat = roomInterjection(t, LIMIT, 1);
      if (beat) {
        fired++;
        expect(beat.turn).toBe(fireTurn);
        expect(t).toBe(fireTurn);
      }
    }
    expect(fired).toBe(1); // at most (and here exactly) once per game
  });

  it('never lands on the opening exchange (clamped to at least turn 1)', () => {
    expect(interjectionTurn(0)).toBeGreaterThanOrEqual(1);
    expect(interjectionTurn(1)).toBeGreaterThanOrEqual(1);
    expect(interjectionTurn(2)).toBeGreaterThanOrEqual(1);
  });

  it('surfaces the FIRST fragment after one finished game, on the scheduled turn', () => {
    const beat = roomInterjection(interjectionTurn(LIMIT), LIMIT, 1);
    expect(beat).not.toBeNull();
    expect(beat!.index).toBe(0);
    expect(beat!.line).toBe(ROOM_INTERJECTION_FRAGMENTS[0]);
    expect(beat!.final).toBe(false);
  });

  it('DEEPENS exactly one beat per finished game (in lock-step with the picker arc)', () => {
    const fireTurn = interjectionTurn(LIMIT);
    for (let games = 1; games <= ROOM_INTERJECTION_FRAGMENTS.length; games++) {
      expect(roomInterjection(fireTurn, LIMIT, games)!.index).toBe(games - 1);
    }
  });

  it('is a pure function of its inputs (same inputs → same beat, always)', () => {
    expect(roomInterjection(6, LIMIT, 3)).toEqual(roomInterjection(6, LIMIT, 3));
  });

  it('CAPS gracefully on the last beat — it does not wrap or run off the end', () => {
    const fireTurn = interjectionTurn(LIMIT);
    const total = ROOM_INTERJECTION_FRAGMENTS.length;
    const last = roomInterjection(fireTurn, LIMIT, total)!;
    expect(last.index).toBe(total - 1);
    expect(last.final).toBe(true);
    const wayPast = roomInterjection(fireTurn, LIMIT, total + 50)!;
    expect(wayPast.index).toBe(total - 1);
    expect(wayPast.line).toBe(last.line);
  });

  it('the interjection arc runs in lock-step with the picker arc (same beat count = same depth of story)', () => {
    expect(ROOM_INTERJECTION_FRAGMENTS.length).toBe(ROOM_ARC_FRAGMENTS.length);
  });
});

describe('roomInterjection — doctrine contract (§1-P3 / §4: a question, never an answer)', () => {
  it('every fragment ENDS ON A QUESTION', () => {
    for (const f of ROOM_INTERJECTION_FRAGMENTS) {
      expect(f.trim().endsWith('?')).toBe(true);
    }
  });

  it('no fragment reaches for a purple/Mythos word (scanned against DOCTRINE_PURPLE)', () => {
    for (const f of ROOM_INTERJECTION_FRAGMENTS) {
      for (const word of DOCTRINE_PURPLE) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(f)).toBe(false);
      }
    }
  });

  it('roomInterjectionDoctrineClean() agrees the whole set passes the bar', () => {
    expect(roomInterjectionDoctrineClean()).toBe(true);
  });

  it('is DISTINCT text from the picker arc (the room speaking mid-duel, not the door beat)', () => {
    // The two arcs tell the same story from different seats; they must not be the same lines.
    for (let i = 0; i < ROOM_INTERJECTION_FRAGMENTS.length; i++) {
      expect(ROOM_INTERJECTION_FRAGMENTS[i]).not.toBe(ROOM_ARC_FRAGMENTS[i]);
    }
  });
});
