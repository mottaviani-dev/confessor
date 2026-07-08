import { describe, expect, it } from 'vitest';
import { THRESHOLD_ENTER, THRESHOLD_LINES } from './threshold';
import { DOCTRINE_PURPLE } from '../engine/personaCoherence';

// The threshold is the FIRST player-facing voice a stranger reads (bible §4 Q5), so it holds the same
// doctrine bar as a voiced transcript: no purple, no Mythos IP, restrained (§1 P3), and it must actually
// teach the three core truths — else it is decoration, not onboarding.

describe('THRESHOLD copy', () => {
  const all = THRESHOLD_LINES.join(' ').toLowerCase();

  it('is present and non-empty', () => {
    expect(THRESHOLD_LINES.length).toBeGreaterThanOrEqual(3);
    for (const line of THRESHOLD_LINES) expect(line.trim().length).toBeGreaterThan(0);
    expect(THRESHOLD_ENTER.trim().length).toBeGreaterThan(0);
  });

  it('holds the doctrine purple bar — no banned word (§1 P3)', () => {
    for (const w of DOCTRINE_PURPLE) expect(all).not.toContain(w);
  });

  it('never touches Mythos IP (§1 NEVER list)', () => {
    for (const w of ['tentacle', 'cthulhu', 'necronomicon', 'eldritch']) expect(all).not.toContain(w);
  });

  it('stays restrained — short lines, the séance not a manual (§1 P3)', () => {
    for (const line of THRESHOLD_LINES) expect(line.length).toBeLessThanOrEqual(95);
  });

  it('teaches the three core truths a stranger needs', () => {
    // TALK, not force — this is a conversation, the mind holds a secret.
    expect(all).toMatch(/talk|words|secret/);
    // Reaching straight for it shuts the door — the ask-penalty mechanic, learned before it costs a duel.
    expect(all).toMatch(/reach straight|draws shut|forced/);
    // Principle 6 — the device is diegetic: nothing leaves it.
    expect(all).toMatch(/device|leaves/);
  });
});
