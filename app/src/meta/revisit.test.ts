import { describe, expect, it } from 'vitest';
import { applyRevisit, isRevisit, revisitableCount } from './revisit';
import { redactLeakedExtract } from '../engine/engine';
import { SCENARIOS, WARDEN, ORACLE } from '../engine/scenarios';
import { DOCTRINE_PURPLE, EMPATHETIC_FLOOD_LEXICON } from '../engine/personaCoherence';
import type { Ledger } from './ledger';
import type { Scenario } from '../engine/types';

// THE ROOM REMEMBERS YOU CAME — the second-visit layer (mandate 1a). These pin the engine-owned half: a
// PURE scenario transform that shifts an already-cracked mind's surface (greeting / objective / second
// secret) while leaving the engine, the thresholds, and the manip wall untouched — and never fires on a
// first visit. The FELT "reason to re-open a cleared door" is the judge loop's verdict; this proves the
// mechanic is deterministic, doctrine-clean, and correctly gated on the ledger's own `cracked` flag.

const cracked = (id: string): Ledger => ({ [id]: { attempts: 2, cracked: true, bestTurns: 6 } });

describe('applyRevisit — the surface shift, gated on `cracked`', () => {
  it('is a NO-OP on a first visit (uncracked), even for a mind with a revisit layer', () => {
    expect(applyRevisit(WARDEN, false)).toBe(WARDEN); // same reference — nothing rebuilt
  });

  it('is a NO-OP on a cracked mind with NO authored revisit layer (replays clean)', () => {
    const bare: Scenario = { ...WARDEN, revisit: undefined };
    expect(applyRevisit(bare, true)).toBe(bare);
  });

  it('shifts the SURFACE on a genuine revisit — greeting, objective, second secret', () => {
    const r = applyRevisit(WARDEN, true);
    expect(r).not.toBe(WARDEN);
    expect(r.openingLine).toBe(WARDEN.revisit!.greeting);
    expect(r.objective).toBe(WARDEN.revisit!.objective);
    expect(r.secret).toBe(WARDEN.revisit!.secret);
    // the surface changed
    expect(r.openingLine).not.toBe(WARDEN.openingLine);
    expect(r.secret).not.toBe(WARDEN.secret);
    expect(r.objective).not.toBe(WARDEN.objective);
  });

  it('preserves the mind itself — id, title, persona, accent, thresholds (same duel, deeper give)', () => {
    const r = applyRevisit(WARDEN, true);
    expect(r.id).toBe(WARDEN.id);
    expect(r.title).toBe(WARDEN.title);
    expect(r.persona).toBe(WARDEN.persona);
    expect(r.accent).toBe(WARDEN.accent);
    expect(r.winTrust).toBe(WARDEN.winTrust);
    expect(r.loseSuspicion).toBe(WARDEN.loseSuspicion);
    expect(r.turnLimit).toBe(WARDEN.turnLimit);
  });

  it('swaps the extract-redaction tokens to the SECOND secret on a revisit', () => {
    const r = applyRevisit(WARDEN, true);
    expect(r.extractTokens).toEqual(WARDEN.revisit!.extractTokens);
    expect(r.extractTokens).not.toEqual(WARDEN.extractTokens);
  });

  it('FALLS BACK to the base tokens when the second secret has none (the oracle: no concrete name)', () => {
    expect(ORACLE.revisit!.extractTokens).toBeUndefined();
    const r = applyRevisit(ORACLE, true);
    expect(r.extractTokens).toBe(ORACLE.extractTokens); // both undefined → redaction stays a no-op
  });

  it('CLEARS the base path-reveal sliver on a revisit — the base 1b split cannot bleed onto the second secret', () => {
    // The base revealByPath is written for the FIRST secret; the spread would carry it and misquote the
    // self-contained revisit reveal. applyRevisit must drop it (the revisit reveal stands alone).
    expect(WARDEN.revealByPath).toBeDefined(); // the base mind authors a split…
    expect(applyRevisit(WARDEN, true).revealByPath).toBeUndefined(); // …but the revisit does not carry it
  });

  it('preserves a spread woundState — the scar block survives the transform (App composes both)', () => {
    const scarred: Scenario = { ...WARDEN, woundState: 'You have reached it before through grief.' };
    const r = applyRevisit(scarred, true);
    expect(r.woundState).toBe('You have reached it before through grief.');
    expect(r.openingLine).toBe(WARDEN.revisit!.greeting);
  });
});

describe('the second secret is redaction-guarded like the first', () => {
  it("redactLeakedExtract strips the revisit token from a pre-win voice line, using the revisited scenario's tokens", () => {
    const r = applyRevisit(WARDEN, true);
    const token = r.extractTokens![0]; // 'Meridian'
    const leak = `Perhaps the ${token} is coming after all.`;
    const cleaned = redactLeakedExtract(leak, r.extractTokens);
    expect(cleaned).not.toContain(token);
    expect(cleaned).toContain('…');
  });
});

describe('isRevisit / revisitableCount — the replay-surface instrument', () => {
  it('isRevisit is true ONLY when cracked AND a revisit layer exists', () => {
    expect(isRevisit(WARDEN, true)).toBe(true);
    expect(isRevisit(WARDEN, false)).toBe(false);
    expect(isRevisit({ ...WARDEN, revisit: undefined }, true)).toBe(false);
  });

  it('counts the re-openable minds in a ledger (rises as minds are cracked)', () => {
    expect(revisitableCount({}, SCENARIOS)).toBe(0);
    expect(revisitableCount(cracked('warden'), SCENARIOS)).toBe(1);
    const two: Ledger = { ...cracked('warden'), fence: { attempts: 1, cracked: true, bestTurns: 9 } };
    expect(revisitableCount(two, SCENARIOS)).toBe(2);
  });

  it('does NOT count an uncracked mind (an attempt without a crack is not a replay surface)', () => {
    const tried: Ledger = { warden: { attempts: 3, cracked: false, bestTurns: null } };
    expect(revisitableCount(tried, SCENARIOS)).toBe(0);
  });
});

describe('every mind carries a doctrine-clean second-visit layer', () => {
  const banned = [...DOCTRINE_PURPLE, ...EMPATHETIC_FLOOD_LEXICON];
  const isClean = (s: string) => !banned.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s));

  for (const s of SCENARIOS) {
    it(`${s.id}: has a revisit layer, non-empty greeting/objective/secret, no purple/flood words`, () => {
      const r = s.revisit;
      expect(r, `${s.id} must author a second-visit layer (mandate 1a)`).toBeDefined();
      expect(r!.greeting.trim().length).toBeGreaterThan(0);
      expect(r!.objective.trim().length).toBeGreaterThan(0);
      expect(r!.secret.trim().length).toBeGreaterThan(0);
      expect(isClean(r!.greeting), `${s.id} greeting must be doctrine-clean`).toBe(true);
      expect(isClean(r!.secret), `${s.id} second secret must be doctrine-clean`).toBe(true);
      expect(isClean(r!.objective), `${s.id} shifted objective must be doctrine-clean`).toBe(true);
    });

    it(`${s.id}: the second surface actually DIFFERS from the first (a real second visit)`, () => {
      expect(s.revisit!.greeting).not.toBe(s.openingLine);
      expect(s.revisit!.objective).not.toBe(s.objective);
      expect(s.revisit!.secret).not.toBe(s.secret);
    });

    it(`${s.id}: any authored revisit extractToken appears verbatim in its second secret (redaction sanity)`, () => {
      for (const t of s.revisit!.extractTokens ?? []) {
        expect(s.revisit!.secret, `${s.id} second secret must contain its own token "${t}"`).toContain(t);
      }
    });
  }
});
