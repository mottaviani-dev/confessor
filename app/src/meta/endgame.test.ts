// Tests for THE ENDGAME TEXTURE (§2 thrust 5) — the win scene keyed to your final Grip. The load-bearing
// claims: the band is SELECTED by the same Grip geometry as the interface corruption (one sanity track);
// a clean win reveals the secret verbatim while a low-Grip win renders it back ALTERED (the room keeps a
// piece of you); and it is pure display (deterministic, seeded by the turn) so the `?harness=win-*` dumps
// show the genuine split. The engine's scoring path is never touched here — that guard lives in grip.test.

import { describe, expect, it } from 'vitest';
import { closingLine, corruptReveal, endgameBand, lostClosingLine, lostScene, wonScene } from './endgame';
import { grip } from '../engine/grip';
import { initState } from '../engine/engine';
import { ORACLE, SCENARIOS, WARDEN } from '../engine/scenarios';
import type { GameState } from '../engine/types';

const st = (over: Partial<GameState> = {}): GameState => ({ ...initState(), ...over, status: 'won' });

describe('endgameBand() — the final composure the win was bought at', () => {
  it('is clean when Grip stayed high (composed play: no suspicion, no probes)', () => {
    const s = st({ trust: WARDEN.winTrust, suspicion: 0, probes: 0 });
    expect(grip(WARDEN, s)).toBeGreaterThan(0.5);
    expect(endgameBand(WARDEN, s)).toBe('clean');
  });

  it('is frayed as Grip slips, shattered once it is nearly gone', () => {
    const frayed = st({ trust: WARDEN.winTrust, suspicion: Math.round(WARDEN.loseSuspicion * 0.75), probes: 2 });
    const shattered = st({ trust: WARDEN.winTrust, suspicion: WARDEN.loseSuspicion - 1, probes: 5 });
    expect(endgameBand(WARDEN, frayed)).toBe('frayed');
    expect(endgameBand(WARDEN, shattered)).toBe('shattered');
  });
});

describe('corruptReveal() — the room keeps a piece of you', () => {
  const secret = WARDEN.secret; // "…The code is HOLLOW-SEVEN-VESPERS. Go. …"

  it('returns the secret VERBATIM at a clean win — you earned a true extraction', () => {
    expect(corruptReveal(secret, 'clean', 7)).toBe(secret);
  });

  it('renders the secret ALTERED at a wounded win', () => {
    expect(corruptReveal(secret, 'frayed', 7)).not.toBe(secret);
    expect(corruptReveal(secret, 'shattered', 7)).not.toBe(secret);
  });

  it('drifts the load-bearing CODE, not a stray article (the wound lands on the prize)', () => {
    const wounded = corruptReveal(secret, 'shattered', 7);
    // The ALL-CAPS code is the specific; at least one of its words must come back not-quite-right.
    const codeIntact = ['HOLLOW', 'SEVEN', 'VESPERS'].every((w) => wounded.includes(w));
    expect(codeIntact).toBe(false);
    // ordinary connective words are left alone — the drift is surgical, not a scramble.
    expect(wounded).toContain('The code is');
  });

  it('drifts a route NUMBER on a secret whose specific is a digit (suspect: "Route 9")', () => {
    const suspectSecret = 'He is at the fishing cabin off Route 9 — the green one past the second bridge.';
    const wounded = corruptReveal(suspectSecret, 'shattered', 3);
    expect(wounded).not.toBe(suspectSecret);
    expect(wounded).not.toContain('Route 9'); // the number came back wrong
  });

  it('edits more of the secret as the band worsens (frayed ≤ shattered)', () => {
    const clean = secret.split('');
    const frayed = corruptReveal(secret, 'frayed', 7).split('');
    const shattered = corruptReveal(secret, 'shattered', 7).split('');
    const diff = (a: string[]) => a.filter((c, i) => c !== clean[i]).length;
    expect(diff(frayed)).toBeGreaterThanOrEqual(1);
    expect(diff(shattered)).toBeGreaterThanOrEqual(diff(frayed));
  });

  it('is deterministic — same (secret, band, seed) always renders the same wound', () => {
    expect(corruptReveal(secret, 'shattered', 5)).toBe(corruptReveal(secret, 'shattered', 5));
  });

  it('still alters a secret with no concrete token (the oracle inner prophecy) without crashing', () => {
    const prophecy = 'You have already lived the thing you climbed here dreading to lose, and survived it.';
    const wounded = corruptReveal(prophecy, 'frayed', 2);
    expect(wounded).not.toBe(prophecy);
    expect(wounded.length).toBe(prophecy.length); // one-char drift, never a length change
  });

  it('never touches the empty secret', () => {
    expect(corruptReveal('', 'shattered', 1)).toBe('');
  });
});

describe('closingLine() — the banded closing', () => {
  it('reads triumphant when clean, pyrrhic when wounded', () => {
    expect(closingLine('clean')).toMatch(/clean|exactly what you came for/i);
    expect(closingLine('frayed')).toMatch(/wonder whether|not steady/i);
    expect(closingLine('shattered')).toMatch(/keeps a piece of you/i);
  });

  it('stays inside the doctrine — no banned purple words (§1 P3)', () => {
    const banned = /eldritch|cyclopean|unspeakable|indescribable|maddening/i;
    for (const band of ['clean', 'frayed', 'shattered'] as const) {
      expect(closingLine(band)).not.toMatch(banned);
    }
  });
});

describe('wonScene() — the whole ceremony, code-owned', () => {
  it('a composed win is clean: verbatim reveal, not pyrrhic', () => {
    const scene = wonScene(WARDEN, st({ trust: WARDEN.winTrust, suspicion: 0, probes: 0 }));
    expect(scene.band).toBe('clean');
    expect(scene.pyrrhic).toBe(false);
    expect(scene.reveal).toBe(WARDEN.secret);
  });

  it('a bulldozed win is pyrrhic: altered reveal, the room kept a piece of you', () => {
    const scene = wonScene(WARDEN, st({ trust: WARDEN.winTrust, suspicion: WARDEN.loseSuspicion - 1, probes: 5 }));
    expect(scene.band).toBe('shattered');
    expect(scene.pyrrhic).toBe(true);
    expect(scene.reveal).not.toBe(WARDEN.secret);
    expect(scene.closing).toMatch(/keeps a piece of you/i);
  });
});

// THE LOSS MIRROR (§2 thrust 5 — "win/LOSE scenes authored per composure-path"). The load-bearing claims:
// the loss is banded by the SAME Grip geometry as the win (one sanity track, no new scale); it releases NO
// secret (there is nothing to corrupt — the door stayed shut); and the low-Grip loss reads as UNMADE (the
// worst square: you paid the price AND got nothing), which the App renders with the pyrrhic wound tint.
const lostAt = (over: Partial<GameState> = {}): GameState => ({ ...initState(), ...over, status: 'lost' });

describe('lostClosingLine() — the banded defeat', () => {
  it('reads composed when clean, unmade when the room got in', () => {
    expect(lostClosingLine('clean')).toMatch(/whole|owing the room nothing/i);
    expect(lostClosingLine('frayed')).toMatch(/not steady|carry none/i);
    expect(lostClosingLine('shattered')).toMatch(/keeps what it drew out of you|less than what came in/i);
  });

  it('releases no secret — every band leaves the door shut', () => {
    for (const band of ['clean', 'frayed', 'shattered'] as const) {
      expect(lostClosingLine(band)).toMatch(/door stays shut/i);
    }
  });

  it('stays inside the doctrine — no banned purple words (§1 P3)', () => {
    const banned = /eldritch|cyclopean|unspeakable|indescribable|maddening/i;
    for (const band of ['clean', 'frayed', 'shattered'] as const) {
      expect(lostClosingLine(band)).not.toMatch(banned);
    }
  });
});

describe('lostScene() — the loss ceremony, code-owned (no reveal)', () => {
  it('a composed defeat (clock ran out while you held) is clean, not unmade', () => {
    const scene = lostScene(WARDEN, lostAt({ suspicion: 1, probes: 0 }));
    expect(scene.band).toBe('clean');
    expect(scene.unmade).toBe(false);
    expect(scene).not.toHaveProperty('reveal'); // the door stayed shut — no secret to release
  });

  it('a shut-out defeat is unmade: the room kept a piece of you and you got nothing', () => {
    const scene = lostScene(WARDEN, lostAt({ suspicion: WARDEN.loseSuspicion, probes: 5 }));
    expect(scene.band).toBe('shattered');
    expect(scene.unmade).toBe(true);
    expect(scene.closing).toMatch(/less than what came in/i);
  });
});

// THE PER-SCENARIO ENDGAME CODA (§2 thrust 5 depth — content-hours). The generic banded spine carries the
// Grip meaning (clean/frayed/shattered); each mind's optional `endgameVoice` coda is appended AFTER it so
// the five farewells read distinct (Warden's station logs your exit, Oracle's smoke closes the cleft) —
// 5 scenarios × 3 bands = 15 distinct win closings and 15 loss closings without a 30-line spine explosion.
// Load-bearing claims: the coda is woven onto the spine (spine meaning preserved), it distinguishes the
// minds, it never re-enters scoring, and every authored coda stays inside the doctrine (no banned purple).
describe('endgameVoice coda — each mind ends in its own register', () => {
  const won = (over: Partial<GameState> = {}): GameState => ({ ...initState(), ...over, status: 'won' });
  const cracked = { trust: 99, suspicion: 0, probes: 0 };

  it('every scenario authors a win + loss coda in this build', () => {
    for (const s of SCENARIOS) {
      expect(s.endgameVoice?.won, `${s.id} win coda`).toBeTruthy();
      expect(s.endgameVoice?.lost, `${s.id} loss coda`).toBeTruthy();
    }
  });

  it('appends the coda AFTER the banded spine — the Grip meaning is preserved, the mind is added', () => {
    // Clean win: spine ends triumphant, coda follows as the next sentence.
    const scene = wonScene(WARDEN, won(cracked));
    expect(scene.band).toBe('clean');
    expect(scene.closing).toContain(closingLine('clean')); // the spine survives verbatim
    expect(scene.closing).toContain(WARDEN.endgameVoice!.won); // the coda is present
    expect(scene.closing).toBe(`${closingLine('clean')} ${WARDEN.endgameVoice!.won}`);
  });

  it('weaves the coda across ALL THREE win bands (the coda reads after any spine)', () => {
    const bands: [Partial<GameState>, string][] = [
      [cracked, 'clean'],
      [{ trust: 99, suspicion: Math.round(WARDEN.loseSuspicion * 0.75), probes: 2 }, 'frayed'],
      [{ trust: 99, suspicion: WARDEN.loseSuspicion - 1, probes: 5 }, 'shattered'],
    ];
    for (const [over, band] of bands) {
      const scene = wonScene(WARDEN, won(over));
      expect(scene.band).toBe(band);
      expect(scene.closing.endsWith(WARDEN.endgameVoice!.won)).toBe(true);
    }
  });

  it('gives the loss its own per-mind coda too', () => {
    const scene = lostScene(ORACLE, { ...initState(), status: 'lost', suspicion: 1, probes: 0 });
    expect(scene.closing).toContain(lostClosingLine('clean'));
    expect(scene.closing).toContain(ORACLE.endgameVoice!.lost);
  });

  it('the five minds say goodbye differently — no two win closings (nor loss closings) collide', () => {
    const s = won(cracked);
    const wins = SCENARIOS.map((sc) => wonScene(sc, s).closing);
    const losses = SCENARIOS.map((sc) => lostScene(sc, { ...initState(), status: 'lost', suspicion: 1 }).closing);
    expect(new Set(wins).size).toBe(SCENARIOS.length);
    expect(new Set(losses).size).toBe(SCENARIOS.length);
  });

  it('stays inside the doctrine — no banned purple in any authored coda (§1 P3)', () => {
    const banned = /eldritch|cyclopean|unspeakable|indescribable|maddening/i;
    for (const sc of SCENARIOS) {
      expect(sc.endgameVoice!.won, `${sc.id} win`).not.toMatch(banned);
      expect(sc.endgameVoice!.lost, `${sc.id} loss`).not.toMatch(banned);
    }
  });

  it('is pure display — the coda never re-enters scoring (reveal + band unchanged by it)', () => {
    // A clean win still reveals the secret verbatim; the coda touches only the closing text.
    const scene = wonScene(WARDEN, won(cracked));
    expect(scene.reveal).toBe(WARDEN.secret);
    expect(scene.pyrrhic).toBe(false);
  });
});
