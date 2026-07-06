// Tests for THE ENDGAME TEXTURE (§2 thrust 5) — the win scene keyed to your final Grip. The load-bearing
// claims: the band is SELECTED by the same Grip geometry as the interface corruption (one sanity track);
// a clean win reveals the secret verbatim while a low-Grip win renders it back ALTERED (the room keeps a
// piece of you); and it is pure display (deterministic, seeded by the turn) so the `?harness=win-*` dumps
// show the genuine split. The engine's scoring path is never touched here — that guard lives in grip.test.

import { describe, expect, it } from 'vitest';
import { closingLine, corruptReveal, endgameBand, wonScene } from './endgame';
import { grip } from '../engine/grip';
import { initState } from '../engine/engine';
import { WARDEN } from '../engine/scenarios';
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
