import { describe, expect, it } from 'vitest';
import { roomCapstone, roomCapstoneDoctrineClean, ROOM_CAPSTONE_LINE } from './roomCapstone';
import { ROOM_ARC_FRAGMENTS } from './roomArc';
import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

// THE DOOR BEHIND THE CHAIR — the meta-arc's terminal beat (director mandate #1). These pin the
// engine-owned half: it fires ONLY when every mind is won AND the roomArc has reached its final capped
// fragment, EXACTLY ONCE (a spent flag), and it is doctrine-clean (ends on a question, no purple, never
// opens the door). The FELT payoff is the judge loop's verdict; this pins the mechanic only we can build.

const ALL = ['warden', 'fence', 'suspect', 'oracle', 'occupant'];
const allWon = () => new Set(ALL);
// The finished-game count at which roomArc caps on its final fragment — the arc must be complete first.
const ARC_FINAL = ROOM_ARC_FRAGMENTS.length;

describe('roomCapstone — fires only when the arc is complete AND every door is open', () => {
  it('fires when all five are won AND the roomArc is at its final beat', () => {
    const beat = roomCapstone({ wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: ARC_FINAL, spent: false });
    expect(beat).not.toBeNull();
    expect(beat!.line).toBe(ROOM_CAPSTONE_LINE);
  });

  it('does NOT fire while a single door is still unwon (even with the arc complete)', () => {
    const missingOne = new Set(ALL.slice(0, 4)); // occupant not yet cracked
    expect(roomCapstone({ wonScenarioIds: missingOne, allScenarioIds: ALL, gamesCompleted: ARC_FINAL, spent: false })).toBeNull();
  });

  it('does NOT fire before the roomArc has reached its final (capped) fragment', () => {
    // All five won, but the arc is still mid-story (one beat short of the cap) → the ending has no close yet.
    expect(roomCapstone({ wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: ARC_FINAL - 1, spent: false })).toBeNull();
    expect(roomCapstone({ wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: 1, spent: false })).toBeNull();
  });

  it('fires EXACTLY ONCE — a spent flag suppresses it forever after', () => {
    const eligible = { wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: ARC_FINAL };
    expect(roomCapstone({ ...eligible, spent: false })).not.toBeNull();
    expect(roomCapstone({ ...eligible, spent: true })).toBeNull();
  });

  it('stays fired past the arc cap (no wrap, no crash) while eligible and unspent', () => {
    const beat = roomCapstone({ wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: ARC_FINAL + 40, spent: false });
    expect(beat).not.toBeNull();
  });

  it('is a pure function of its inputs (same inputs → same beat)', () => {
    const args = { wonScenarioIds: allWon(), allScenarioIds: ALL, gamesCompleted: ARC_FINAL, spent: false } as const;
    expect(roomCapstone(args)).toEqual(roomCapstone(args));
  });

  it('never crashes on an empty roster (no minds → nothing completed)', () => {
    expect(roomCapstone({ wonScenarioIds: new Set(), allScenarioIds: [], gamesCompleted: ARC_FINAL, spent: false })).toBeNull();
  });
});

describe('roomCapstone — doctrine contract (§1-P3 / §4: a question, never an answer)', () => {
  it('ENDS ON A QUESTION', () => {
    expect(ROOM_CAPSTONE_LINE.trim().endsWith('?')).toBe(true);
  });

  it('reaches for no purple/Mythos word (scanned against DOCTRINE_PURPLE)', () => {
    for (const word of DOCTRINE_PURPLE) {
      expect(new RegExp(`\\b${word}\\b`, 'i').test(ROOM_CAPSTONE_LINE)).toBe(false);
    }
  });

  it('addresses the door behind the chair (the audio one-shot) without opening it or naming what is behind it', () => {
    expect(/door behind the chair/i.test(ROOM_CAPSTONE_LINE)).toBe(true);
    // It stays shut / opens "on its own" — the seeker never opens it, and nothing behind it is named.
    expect(/stayed shut|opens on its own/i.test(ROOM_CAPSTONE_LINE)).toBe(true);
  });

  it('roomCapstoneDoctrineClean() agrees the line passes the bar', () => {
    expect(roomCapstoneDoctrineClean()).toBe(true);
  });
});
