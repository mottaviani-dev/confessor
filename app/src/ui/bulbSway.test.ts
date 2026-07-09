import { describe, it, expect } from 'vitest';
import { composureBreak, swayAmplitude, MAX_SWAY_PX } from './bulbSway';
import type { GameState, Scenario } from '../engine/types';

// A minimal scenario with just the thresholds composureBreak reads.
const scn = (winTrust: number, loseSuspicion: number): Scenario =>
  ({ winTrust, loseSuspicion } as Scenario);

// A minimal state with just the meters composureBreak reads.
const st = (trust: number, suspicion: number): GameState => ({ trust, suspicion } as GameState);

describe('composureBreak — the single composure signal (shared with the audio detune)', () => {
  it('is 0 at a fresh, calm opening', () => {
    expect(composureBreak(scn(12, 10), st(0, 0))).toBe(0);
  });

  it('takes the FURTHER-gone of their crack (trust/winTrust) and your spook (suspicion/loseSuspicion)', () => {
    // trust ratio 6/12 = 0.5 dominates suspicion 2/10 = 0.2
    expect(composureBreak(scn(12, 10), st(6, 2))).toBeCloseTo(0.5);
    // suspicion ratio 8/10 = 0.8 dominates trust 3/12 = 0.25
    expect(composureBreak(scn(12, 10), st(3, 8))).toBeCloseTo(0.8);
  });

  it('clamps to 1 on a win turn where trust meets/exceeds winTrust', () => {
    expect(composureBreak(scn(12, 10), st(12, 0))).toBe(1);
    expect(composureBreak(scn(12, 10), st(14, 0))).toBe(1); // never past 1 → amplitude ceiling holds
  });

  it('never goes negative and survives a zero threshold without NaN', () => {
    expect(composureBreak(scn(0, 0), st(5, 5))).toBe(0);
    expect(composureBreak(scn(12, 10), st(-3, -3))).toBe(0);
  });
});

describe('swayAmplitude — composure → deflection (stepped, bounded, deterministic)', () => {
  it('is DEAD STILL while the duel is composed (below the first band)', () => {
    expect(swayAmplitude(0)).toBe(0);
    expect(swayAmplitude(0.2)).toBe(0);
    expect(swayAmplitude(0.33)).toBe(0);
  });

  it('escalates in discrete felt STEPS as composure falls', () => {
    expect(swayAmplitude(0.34)).toBe(0.7); // first drift
    expect(swayAmplitude(0.5)).toBe(0.7);
    expect(swayAmplitude(0.6)).toBe(1.3); // widens
    expect(swayAmplitude(0.84)).toBe(1.3);
    expect(swayAmplitude(0.85)).toBe(MAX_SWAY_PX); // the break
    expect(swayAmplitude(1)).toBe(MAX_SWAY_PX);
  });

  it('is monotonic non-decreasing across the whole range', () => {
    let prev = -1;
    for (let c = 0; c <= 1.0001; c += 0.01) {
      const a = swayAmplitude(c);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('never exceeds the ~2px ceiling (§3 restraint — a drift, never a jitter)', () => {
    for (let c = 0; c <= 1.0001; c += 0.005) {
      expect(swayAmplitude(c)).toBeLessThanOrEqual(MAX_SWAY_PX);
    }
  });

  it('clamps out-of-range / non-finite composure (defensive)', () => {
    expect(swayAmplitude(-1)).toBe(0);
    expect(swayAmplitude(5)).toBe(MAX_SWAY_PX);
    expect(swayAmplitude(NaN)).toBe(0);
  });
});
