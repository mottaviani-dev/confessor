import { describe, expect, it } from 'vitest';
import { crackedCount, emptyLedger, parseLedger, recordResult, serializeLedger, unlockedIds } from './ledger';

const PATH = ['warden', 'fence', 'suspect', 'oracle'] as const;

describe('unlockedIds', () => {
  it('fresh ledger opens only the first mind', () => {
    expect([...unlockedIds(emptyLedger(), PATH)]).toEqual(['warden']);
  });
  it('cracking a mind opens exactly the next one', () => {
    const l = recordResult(emptyLedger(), 'warden', 'won', 9);
    expect([...unlockedIds(l, PATH)]).toEqual(['warden', 'fence']);
  });
  it('losses open nothing', () => {
    const l = recordResult(emptyLedger(), 'warden', 'lost', 14);
    expect([...unlockedIds(l, PATH)]).toEqual(['warden']);
  });
  it('a gap seals the rest of the chain even if a later mind was somehow cracked', () => {
    const l = recordResult(emptyLedger(), 'suspect', 'won', 8);
    expect([...unlockedIds(l, PATH)]).toEqual(['warden']);
  });
  it('full chain', () => {
    let l = emptyLedger();
    for (const id of PATH) l = recordResult(l, id, 'won', 10);
    expect([...unlockedIds(l, PATH)]).toEqual([...PATH]);
  });
});

describe('recordResult', () => {
  it('counts attempts on a loss, stays uncracked', () => {
    const l = recordResult(emptyLedger(), 'warden', 'lost', 14);
    expect(l.warden).toEqual({ attempts: 1, cracked: false, bestTurns: null });
  });

  it('a win cracks and sets best', () => {
    const l = recordResult(emptyLedger(), 'warden', 'won', 9);
    expect(l.warden).toEqual({ attempts: 1, cracked: true, bestTurns: 9 });
  });

  it('best only improves downward', () => {
    let l = recordResult(emptyLedger(), 'warden', 'won', 9);
    l = recordResult(l, 'warden', 'won', 11);
    expect(l.warden.bestTurns).toBe(9);
    l = recordResult(l, 'warden', 'won', 7);
    expect(l.warden.bestTurns).toBe(7);
    expect(l.warden.attempts).toBe(3);
  });

  it('a later loss never un-cracks', () => {
    let l = recordResult(emptyLedger(), 'warden', 'won', 9);
    l = recordResult(l, 'warden', 'lost', 14);
    expect(l.warden.cracked).toBe(true);
    expect(l.warden.bestTurns).toBe(9);
  });
});

describe('crackedCount', () => {
  it('counts cracked scenarios only', () => {
    let l = recordResult(emptyLedger(), 'warden', 'won', 9);
    l = recordResult(l, 'fence', 'lost', 14);
    expect(crackedCount(l)).toBe(1);
  });
});

describe('parseLedger', () => {
  it('round-trips', () => {
    const l = recordResult(emptyLedger(), 'oracle', 'won', 10);
    expect(parseLedger(serializeLedger(l))).toEqual(l);
  });
  it('garbage and nulls become an empty ledger, never a throw', () => {
    expect(parseLedger('not json')).toEqual({});
    expect(parseLedger(null)).toEqual({});
    expect(parseLedger('{"warden":{"attempts":"nope"}}')).toEqual({});
  });
});
