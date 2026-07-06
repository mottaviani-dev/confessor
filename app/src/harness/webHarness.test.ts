import { describe, expect, it } from 'vitest';
import { harnessDuel, parseHarness, seededLedger } from './webHarness';
import { grip, corruptLine, corruptionBudget } from '../engine/grip';
import { crackedCount, unlockedIds } from '../meta/ledger';
import { SCENARIOS } from '../engine/scenarios';

describe('parseHarness', () => {
  it('returns null with no ?harness=', () => {
    expect(parseHarness('')).toBeNull();
    expect(parseHarness('?foo=bar')).toBeNull();
    expect(parseHarness('?harness=nonsense')).toBeNull();
  });

  it('maps the known keys to modes', () => {
    expect(parseHarness('?harness=picker-seeded')).toEqual({ kind: 'picker-seeded' });
    expect(parseHarness('?harness=duel')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'mid' });
    expect(parseHarness('?harness=duel-lowgrip')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'lowgrip' });
    expect(parseHarness('?harness=duel-askpenalty')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'askpenalty' });
  });

  it('finds the param mid-query and url-decodes', () => {
    expect(parseHarness('?x=1&harness=duel')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'mid' });
  });

  it('maps duel-<scenarioId> to a neutral mid-game on that room, but only for a real scenario', () => {
    for (const id of ['fence', 'suspect', 'oracle']) {
      expect(parseHarness(`?harness=duel-${id}`)).toEqual({ kind: 'duel', scenarioId: id, variant: 'mid' });
    }
    expect(parseHarness('?harness=duel-nobody')).toBeNull();
  });
});

describe('seededLedger', () => {
  it('shows one cracked mind and opens the next door, keeping the rest sealed', () => {
    const l = seededLedger();
    expect(crackedCount(l)).toBe(1);
    const open = unlockedIds(l, SCENARIOS.map((s) => s.id));
    // warden cracked → warden + fence open; suspect + oracle stay sealed doors.
    expect(open.has('warden')).toBe(true);
    expect(open.has('fence')).toBe(true);
    expect(open.has('suspect')).toBe(false);
  });
});

describe('harnessDuel — injected states are internally valid', () => {
  it('mid: Grip stays high, so the echo does NOT corrupt', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'mid' });
    const g = grip(h.scenario, h.state);
    expect(g).toBeGreaterThan(0.5); // above the corruption threshold
    expect(corruptionBudget(g)).toBe(0);
    expect(corruptLine(h.lastYou, g, h.state.turn)).toBe(h.lastYou); // unchanged
  });

  it('lowgrip: Grip drops under the threshold, so the room edits the echo colder', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'lowgrip' });
    const g = grip(h.scenario, h.state);
    expect(g).toBeLessThanOrEqual(0.25);
    expect(corruptionBudget(g)).toBe(2);
    const shown = corruptLine(h.lastYou, g, h.state.turn);
    expect(shown).not.toBe(h.lastYou); // the line the player re-reads is genuinely altered
  });

  it('askpenalty: opens the transcript carrying the diegetic "draws back" line', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'askpenalty' });
    expect(h.showLog).toBe(true);
    const sys = h.history.filter((l) => l.who === 'system');
    expect(sys).toHaveLength(1);
    expect(sys[0].text).toContain('draws back');
    // mirrors App's binding: mid-sentence room name, no floating number / HUD (§5).
    expect(sys[0].text).toContain('the Warden');
    expect(sys[0].text).not.toMatch(/[-−]?\s*0/); // no "−0" leak
  });

  it('all variants keep status playing and stay within the scenario thresholds', () => {
    for (const variant of ['mid', 'lowgrip', 'askpenalty'] as const) {
      const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant });
      expect(h.state.status).toBe('playing');
      expect(h.state.trust).toBeGreaterThanOrEqual(0);
      expect(h.state.trust).toBeLessThan(h.scenario.winTrust);
      expect(h.state.suspicion).toBeLessThan(h.scenario.loseSuspicion);
      expect(Number.isInteger(h.state.trust)).toBe(true);
      expect(Number.isInteger(h.state.suspicion)).toBe(true);
    }
  });
});
