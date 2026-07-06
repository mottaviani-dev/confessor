import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './scenarios';

// The per-scenario accent (bible §2 art / §5 "one accent per context") is a data invariant, not a vibe —
// so it gets a measured claim (§7 Rule 1). Every room MUST carry a valid, DISTINCT accent, or two minds
// render chromatically identical (the exact break the director caught: four minds, one teal chrome).
describe('scenario accents (§2 / §5 one-accent-per-room)', () => {
  it('every scenario declares a #rrggbb hex accent', () => {
    for (const s of SCENARIOS) {
      expect(s.accent, `${s.id} accent`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('no two rooms share an accent — each mind reads distinct', () => {
    const accents = SCENARIOS.map((s) => s.accent.toLowerCase());
    expect(new Set(accents).size).toBe(SCENARIOS.length);
  });
});
