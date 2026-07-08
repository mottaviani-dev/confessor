import { describe, expect, it } from 'vitest';
import { homecoming } from './homecoming';
import { DOCTRINE_PURPLE, EMPATHETIC_FLOOD_LEXICON } from '../engine/personaCoherence';
import type { SeamLog } from '../engine/types';

// THE HOMECOMING — the scar with teeth (director mandate #4). Two contracts: (1) the SELECTION logic —
// the deepest OPEN wound greets you, an avenged defeat does not; (2) the greeting is player-facing dread
// text, so it holds the SAME doctrine bar as a voiced line (no purple, no Mythos, restrained §1 P3).

const won = (id: string, title: string) => ({ scenarioId: id, scenarioTitle: title, outcome: 'won' as const });
const lost = (id: string, title: string) => ({ scenarioId: id, scenarioTitle: title, outcome: 'lost' as const });

describe('homecoming — open-wound selection', () => {
  it('returns null on a fresh log (first visit)', () => {
    expect(homecoming([])).toBeNull();
  });

  it('returns null when the record is all wins', () => {
    const log: SeamLog = [won('warden', 'The Warden'), won('fence', 'The Fence')];
    expect(homecoming(log)).toBeNull();
  });

  it('greets a single un-avenged loss as a "marked" wound', () => {
    const h = homecoming([lost('warden', 'The Warden')]);
    expect(h).not.toBeNull();
    expect(h!.scenarioId).toBe('warden');
    expect(h!.losses).toBe(1);
    expect(h!.depth).toBe('marked');
    expect(h!.line).toContain('the Warden'); // mid-sentence room voice, not "The Warden"
  });

  it('CLOSES the wound when a loss is later avenged (a subsequent win)', () => {
    // Lost to the Warden, then came back and cracked it — the score is settled, no greeting.
    const log: SeamLog = [lost('warden', 'The Warden'), won('warden', 'The Warden')];
    expect(homecoming(log)).toBeNull();
  });

  it('re-opens the wound if you lose AGAIN after avenging it (last outcome is the test)', () => {
    const log: SeamLog = [lost('warden', 'The Warden'), won('warden', 'The Warden'), lost('warden', 'The Warden')];
    const h = homecoming(log);
    expect(h?.scenarioId).toBe('warden');
    expect(h?.losses).toBe(2); // both losses counted; the middle win did not erase the tally, only the last-outcome gate
    expect(h?.depth).toBe('known');
  });

  it('bands by loss count: 2 → known, 4 → measured', () => {
    const two: SeamLog = [lost('fence', 'The Fence'), lost('fence', 'The Fence')];
    expect(homecoming(two)?.depth).toBe('known');
    const four: SeamLog = Array.from({ length: 4 }, () => lost('fence', 'The Fence'));
    expect(homecoming(four)?.depth).toBe('measured');
  });

  it('surfaces the DEEPEST open wound when several exist (most losses)', () => {
    const log: SeamLog = [
      lost('warden', 'The Warden'),
      lost('fence', 'The Fence'),
      lost('fence', 'The Fence'),
    ];
    const h = homecoming(log);
    expect(h?.scenarioId).toBe('fence'); // 2 losses beats the warden's 1
    expect(h?.losses).toBe(2);
  });

  it('breaks a loss-count tie toward the most RECENT sting', () => {
    // Both minds lost once; the Fence loss is newer (later in the newest-last log) → it greets.
    const log: SeamLog = [lost('warden', 'The Warden'), lost('fence', 'The Fence')];
    expect(homecoming(log)?.scenarioId).toBe('fence');
  });
});

describe('homecoming — doctrine bar (player-facing dread text, §1 P3)', () => {
  // Every band's greeting, gathered from real selections, scanned like a voiced transcript.
  const lines = [
    homecoming([lost('warden', 'The Warden')])!.line, // marked
    homecoming([lost('fence', 'The Fence'), lost('fence', 'The Fence')])!.line, // known
    homecoming(Array.from({ length: 4 }, () => lost('oracle', 'The Oracle')))!.line, // measured
  ];
  const all = lines.join(' ').toLowerCase();

  it('holds the doctrine purple bar — no banned word', () => {
    for (const w of DOCTRINE_PURPLE) expect(all).not.toContain(w);
  });

  it('never touches Mythos IP (§1 NEVER list)', () => {
    for (const w of ['tentacle', 'cthulhu', 'necronomicon', 'eldritch']) expect(all).not.toContain(w);
  });

  it('does not slip into the empathetic-flood grief-poetry register (§1 P3)', () => {
    for (const phrase of EMPATHETIC_FLOOD_LEXICON) expect(all).not.toContain(phrase);
  });

  it('stays restrained — each greeting a few sentences, not a manual', () => {
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(220);
  });
});
