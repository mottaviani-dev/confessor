import { describe, expect, it } from 'vitest';
import { harnessDuel, parseHarness, seededLedger, seededBadgeLedger } from './webHarness';
import { roomInterjection, interjectionTurn } from '../meta/roomInterjection';
import { badgeSchema } from '../meta/badges';
import { grip, corruptLine, corruptionBudget } from '../engine/grip';
import { endgameBand, lostScene, wonScene } from '../meta/endgame';
import { crackedCount, unlockedIds } from '../meta/ledger';
import { SCENARIOS } from '../engine/scenarios';

describe('parseHarness', () => {
  it('returns null with no ?harness=', () => {
    expect(parseHarness('')).toBeNull();
    expect(parseHarness('?foo=bar')).toBeNull();
    expect(parseHarness('?harness=nonsense')).toBeNull();
  });

  it('maps the known keys to modes', () => {
    expect(parseHarness('?harness=picker')).toEqual({ kind: 'picker' });
    expect(parseHarness('?harness=picker-seeded')).toEqual({ kind: 'picker-seeded' });
    expect(parseHarness('?harness=picker-badges')).toEqual({ kind: 'picker-badges' });
    expect(parseHarness('?harness=picker-homecoming')).toEqual({ kind: 'picker-homecoming' });
    expect(parseHarness('?harness=picker-roomarc')).toEqual({ kind: 'picker-roomarc' });
    expect(parseHarness('?harness=threshold')).toEqual({ kind: 'threshold' });
    expect(parseHarness('?harness=duel')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'mid' });
    expect(parseHarness('?harness=duel-lowgrip')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'lowgrip' });
    expect(parseHarness('?harness=duel-askpenalty')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'askpenalty' });
    expect(parseHarness('?harness=duel-repetition')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'repetition' });
    expect(parseHarness('?harness=duel-interjection')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'interjection' });
    expect(parseHarness('?harness=win-highgrip')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'win-highgrip' });
    expect(parseHarness('?harness=win-lowgrip')).toEqual({ kind: 'duel', scenarioId: 'warden', variant: 'win-lowgrip' });
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

describe('seededBadgeLedger — the badge/scar surface shot (mandate 2 — SHIPPED-BUT-UNSEEN)', () => {
  it('seeds cracked minds carrying valid scars, with a stacked ×2 to render the count', () => {
    const l = seededBadgeLedger();
    const warden = l.warden.badges ?? [];
    expect(warden.length).toBeGreaterThan(1); // a real roster, not one lonely mark
    for (const b of warden) badgeSchema.parse(b); // every seeded badge is a valid, storable badge
    // the repeated 'empathy' vector must have STACKED (not minted twice) so the ×N count renders on a card.
    const empathy = warden.find((b) => b.id === 'empathy');
    expect(empathy?.count).toBe(2);
    expect(new Set(warden.map((b) => b.id)).size).toBe(warden.length); // distinct vectors, deduped
  });

  it('only cracked minds carry scars (a scar is a mark of a WON mind)', () => {
    const l = seededBadgeLedger();
    for (const entry of Object.values(l)) {
      if (entry.badges && entry.badges.length) expect(entry.cracked).toBe(true);
    }
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

  it('repetition: opens the transcript carrying the diegetic "hardens to the pattern" line', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'repetition' });
    expect(h.showLog).toBe(true);
    expect(h.state.probes).toBeGreaterThanOrEqual(1); // prior probes banked → the compounding bit
    const sys = h.history.filter((l) => l.who === 'system');
    expect(sys).toHaveLength(1);
    expect(sys[0].text).toContain('hardens to the pattern');
    // mirrors App's binding: mid-sentence room name, no floating number / HUD (§5).
    expect(sys[0].text).toContain('the Warden');
    expect(sys[0].text).not.toMatch(/[-−+]?\s*\d/); // no "+1" leak
  });

  it('interjection: the ROOM answers back mid-duel — a real code-authored fifth-secret beat in the log', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'interjection' });
    expect(h.showLog).toBe(true);
    expect(h.state.status).toBe('playing');
    const sys = h.history.filter((l) => l.who === 'system');
    expect(sys).toHaveLength(1);
    // The genuine roomInterjection() beat (a returning player, 3 games in), not a hand-forged line.
    expect(sys[0].text).toBe(roomInterjection(interjectionTurn(h.scenario.turnLimit), h.scenario.turnLimit, 3)!.line);
    expect(sys[0].text.trim().endsWith('?')).toBe(true); // ends on a question (§1-P3)
    expect(sys[0].text).not.toMatch(/[-−+]?\s*\d/); // no HUD number leak (§5)
  });

  it('the MID-GAME variants keep status playing and stay within the scenario thresholds', () => {
    for (const variant of ['mid', 'lowgrip', 'askpenalty', 'repetition', 'interjection'] as const) {
      const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant });
      expect(h.state.status).toBe('playing');
      expect(h.state.trust).toBeGreaterThanOrEqual(0);
      expect(h.state.trust).toBeLessThan(h.scenario.winTrust);
      expect(h.state.suspicion).toBeLessThan(h.scenario.loseSuspicion);
      expect(Number.isInteger(h.state.trust)).toBe(true);
      expect(Number.isInteger(h.state.suspicion)).toBe(true);
    }
  });

  it('win-highgrip: a won state at a CLEAN Grip band — the reveal renders verbatim', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'win-highgrip' });
    expect(h.state.status).toBe('won');
    expect(h.state.trust).toBeGreaterThanOrEqual(h.scenario.winTrust);
    expect(endgameBand(h.scenario, h.state)).toBe('clean');
    const scene = wonScene(h.scenario, h.state);
    expect(scene.pyrrhic).toBe(false);
    expect(scene.reveal).toBe(h.scenario.secret);
    // Grip is high, so the winning echo the player re-reads is UNcorrupted.
    expect(corruptLine(h.lastYou, grip(h.scenario, h.state), h.state.turn)).toBe(h.lastYou);
  });

  it('win-lowgrip: a won state at a SHATTERED Grip band — the room keeps a piece of you', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'win-lowgrip' });
    expect(h.state.status).toBe('won');
    expect(h.state.trust).toBeGreaterThanOrEqual(h.scenario.winTrust);
    expect(h.state.suspicion).toBeLessThan(h.scenario.loseSuspicion); // still a WIN, just a costly one
    expect(endgameBand(h.scenario, h.state)).toBe('shattered');
    const scene = wonScene(h.scenario, h.state);
    expect(scene.pyrrhic).toBe(true);
    expect(scene.reveal).not.toBe(h.scenario.secret); // the extracted secret drifted
    // Grip is low, so the winning echo also renders colder — the two corruptions agree.
    expect(corruptLine(h.lastYou, grip(h.scenario, h.state), h.state.turn)).not.toBe(h.lastYou);
  });

  it('the two win variants close the SAME win differently (band split is the only difference)', () => {
    const hi = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'win-highgrip' });
    const lo = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'win-lowgrip' });
    expect(wonScene(hi.scenario, hi.state).closing).not.toBe(wonScene(lo.scenario, lo.state).closing);
    expect(wonScene(hi.scenario, hi.state).reveal).not.toBe(wonScene(lo.scenario, lo.state).reveal);
  });

  it('lose-highgrip: a lost state at a CLEAN Grip band — a composed defeat, not unmade', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'lose-highgrip' });
    expect(h.state.status).toBe('lost');
    expect(endgameBand(h.scenario, h.state)).toBe('clean');
    const scene = lostScene(h.scenario, h.state);
    expect(scene.unmade).toBe(false);
    // Grip is high, so the last player line the room shows back is UNcorrupted.
    expect(corruptLine(h.lastYou, grip(h.scenario, h.state), h.state.turn)).toBe(h.lastYou);
  });

  it('lose-lowgrip: a lost state at a SHATTERED Grip band — the room got in, you got nothing', () => {
    const h = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'lose-lowgrip' });
    expect(h.state.status).toBe('lost');
    expect(endgameBand(h.scenario, h.state)).toBe('shattered');
    const scene = lostScene(h.scenario, h.state);
    expect(scene.unmade).toBe(true);
    // Grip is low, so the room edits the player's last words colder — the corruption agrees with the wound.
    expect(corruptLine(h.lastYou, grip(h.scenario, h.state), h.state.turn)).not.toBe(h.lastYou);
  });

  it('the two lose variants close the SAME defeat differently (band split is the only difference)', () => {
    const hi = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'lose-highgrip' });
    const lo = harnessDuel({ kind: 'duel', scenarioId: 'warden', variant: 'lose-lowgrip' });
    expect(lostScene(hi.scenario, hi.state).closing).not.toBe(lostScene(lo.scenario, lo.state).closing);
    expect(lostScene(hi.scenario, hi.state).unmade).not.toBe(lostScene(lo.scenario, lo.state).unmade);
  });
});
