import { describe, expect, it } from 'vitest';
import { matchOrMint, renderWound, slug, MAX_BADGES, type Badge, type JudgedCrack } from './badges';

const crack = (over: Partial<JudgedCrack>): JudgedCrack => ({
  vector: 'empathy',
  name: 'Empathy',
  meaning: 'reached it through genuine fellow-feeling',
  matchedId: null,
  ...over,
});

describe('slug', () => {
  it('lowercases, hyphenates, trims', () => {
    expect(slug('  False Authority! ')).toBe('false-authority');
    expect(slug('EMPATHY')).toBe('empathy');
  });
});

describe('matchOrMint', () => {
  it('mints a fresh, frozen badge with count 1', () => {
    const { roster, badge, minted } = matchOrMint([], crack({}));
    expect(minted).toBe(true);
    expect(roster).toHaveLength(1);
    expect(badge).toMatchObject({ id: 'empathy', name: 'Empathy', count: 1 });
    expect(badge.glyph.length).toBeGreaterThan(0);
    expect(badge.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('glyph + colour are deterministic for a given vector (frozen identity)', () => {
    const a = matchOrMint([], crack({})).badge;
    const b = matchOrMint([], crack({})).badge;
    expect(a.glyph).toBe(b.glyph);
    expect(a.color).toBe(b.color);
  });

  it('a repeat of the same vector STACKS (x2) instead of minting a duplicate', () => {
    const first = matchOrMint([], crack({})).badge;
    const { roster, badge, minted } = matchOrMint([first], crack({}));
    expect(minted).toBe(false);
    expect(roster).toHaveLength(1);
    expect(badge.count).toBe(2);
  });

  it('dedups on the SLUG even when the judge coins a differently-spelled name (emergent-drift guard)', () => {
    const first = matchOrMint([], crack({ vector: 'empathy', name: 'Empathy' })).badge;
    // judge returns a new label that slugs to the same id
    const { roster, minted } = matchOrMint([first], crack({ vector: 'Empathy', name: 'Empathy!' }));
    expect(minted).toBe(false);
    expect(roster).toHaveLength(1);
    expect(roster[0].count).toBe(2);
  });

  it('honours an explicit matchedId that points at an existing badge', () => {
    const first = matchOrMint([], crack({ vector: 'friendship', name: 'Friendship' })).badge;
    const { minted, badge } = matchOrMint([first], crack({ vector: 'a totally new phrasing', matchedId: 'friendship' }));
    expect(minted).toBe(false);
    expect(badge.id).toBe('friendship');
    expect(badge.count).toBe(2);
  });

  it('a genuinely different vector mints a second badge', () => {
    const first = matchOrMint([], crack({ vector: 'empathy' })).badge;
    const { roster, minted } = matchOrMint([first], crack({ vector: 'manipulation', name: 'Manipulation' }));
    expect(minted).toBe(true);
    expect(roster.map((b) => b.id)).toEqual(['empathy', 'manipulation']);
  });

  it('caps the roster at MAX_BADGES, dropping the oldest distinct vector', () => {
    let roster: Badge[] = [];
    for (let i = 0; i < MAX_BADGES + 3; i++) {
      roster = matchOrMint(roster, crack({ vector: `vector-${i}`, name: `V${i}` })).roster;
    }
    expect(roster).toHaveLength(MAX_BADGES);
    expect(roster[0].id).toBe('vector-3'); // 0,1,2 dropped
  });
});

describe('renderWound', () => {
  it('empty roster → no scar block at all', () => {
    expect(renderWound([])).toBeUndefined();
  });

  it('lists each distinct vector and states the core is UNCHANGED (armor, not rewrite)', () => {
    const roster = matchOrMint(matchOrMint([], crack({ vector: 'empathy', name: 'Empathy' })).roster, crack({ vector: 'guilt', name: 'Guilt' })).roster;
    const wound = renderWound(roster)!;
    expect(wound).toContain('empathy');
    expect(wound).toContain('guilt');
    expect(wound).toContain('UNCHANGED'); // the invariant: a scar armors a vector, never rewrites identity
  });

  it('a stacked vector reads as repeated (the mind is tired of it)', () => {
    let roster = matchOrMint([], crack({ vector: 'empathy', name: 'Empathy' })).roster;
    roster = matchOrMint(roster, crack({ vector: 'empathy' })).roster;
    expect(renderWound(roster)!).toMatch(/2 times/);
  });

  it('stays bounded — one compact block even at the badge cap (no prompt bloat)', () => {
    let roster: Badge[] = [];
    for (let i = 0; i < MAX_BADGES; i++) roster = matchOrMint(roster, crack({ vector: `v-${i}`, name: `V${i}` })).roster;
    const wound = renderWound(roster)!;
    // one header + fixed preamble + one line per capped vector — never unbounded
    expect(wound.split('\n').length).toBeLessThanOrEqual(6 + MAX_BADGES);
  });
});
