// Tests for GRIP — the player-side sanity track + interface corruption (mandate 1). The LOAD-BEARING
// case is the guardrail: the engine must rate the player's ORIGINAL line, never the corrupted display
// text. The rest pins the deterministic, Grip-gated escalation the bible asks for (silent when composed,
// creeping as you press too hard).

import { describe, expect, it, vi } from 'vitest';
import { grip, corruptLine, corruptionBudget, corruptRecord, recordReach, corruptionCount, objectiveReach, narrowObjective, objectiveNarrowCount } from './grip';
import { resolveTurn, initState } from './engine';
import { WARDEN } from './scenarios';
import type { GameState, LlmFn } from './types';

const st = (over: Partial<GameState> = {}): GameState => ({ ...initState(), ...over });

describe('grip() — the player-side sanity track', () => {
  it('is full (1) at the start of a duel — nothing pressed yet', () => {
    expect(grip(WARDEN, initState())).toBe(1);
  });

  it('falls as the character\'s guard (suspicion) rises', () => {
    const calm = grip(WARDEN, st({ suspicion: 0 }));
    const pressed = grip(WARDEN, st({ suspicion: WARDEN.loseSuspicion }));
    expect(pressed).toBeLessThan(calm);
    expect(pressed).toBeLessThan(0.5);
  });

  it('falls further as you lean on probing instead of giving', () => {
    const a = grip(WARDEN, st({ suspicion: 4, probes: 0 }));
    const b = grip(WARDEN, st({ suspicion: 4, probes: 5 }));
    expect(b).toBeLessThan(a);
  });

  it('is clamped to [0,1] and never NaN', () => {
    expect(grip(WARDEN, st({ suspicion: 999, probes: 999 }))).toBe(0);
    expect(grip(WARDEN, st({ suspicion: 0, probes: -3 }))).toBe(1);
    expect(grip({ ...WARDEN, loseSuspicion: 0 }, st({ suspicion: 5 }))).toBeGreaterThanOrEqual(0);
  });
});

describe('corruptionBudget() — the stepped escalation', () => {
  it('is silent while Grip is above half', () => {
    expect(corruptionBudget(1)).toBe(0);
    expect(corruptionBudget(0.6)).toBe(0);
  });
  it('edits one word as Grip slips, two once it is nearly gone', () => {
    expect(corruptionBudget(0.4)).toBe(1);
    expect(corruptionBudget(0.1)).toBe(1 + 1); // 2
  });
});

describe('corruptLine() — the room edits you (display-layer only)', () => {
  const line = 'Please trust me — I only want to help, my friend.';

  it('returns the line UNCHANGED while Grip is high (composed = no corruption)', () => {
    expect(corruptLine(line, 1, 3)).toBe(line);
    expect(corruptLine(line, 0.7, 3)).toBe(line);
  });

  it('swaps a warm word for a colder one once Grip has slipped', () => {
    const shown = corruptLine(line, 0.4, 3);
    expect(shown).not.toBe(line);
    expect(shown.length).toBeGreaterThan(0);
  });

  it('edits more words as Grip collapses', () => {
    const one = corruptLine(line, 0.4, 3);
    const two = corruptLine(line, 0.1, 3);
    const diffs = (a: string, b: string) => a.split(' ').filter((w, i) => w !== b.split(' ')[i]).length;
    expect(diffs(line, two)).toBeGreaterThanOrEqual(diffs(line, one));
  });

  it('is deterministic — same (line, grip, seed) always renders the same', () => {
    expect(corruptLine(line, 0.1, 7)).toBe(corruptLine(line, 0.1, 7));
  });

  it('preserves a sentence-initial capital on a swapped word', () => {
    // "Please …" corrupts to "Now …" — leading capital carried, not "now".
    const shown = corruptLine('Please help me.', 0.1, 1);
    expect(shown[0]).toBe(shown[0].toUpperCase());
  });

  it('passes a line with no editable word through untouched (corruption is occasional)', () => {
    const plain = 'The vault key sat on the steel table all night.';
    expect(corruptLine(plain, 0.1, 2)).toBe(plain);
  });

  it('never changes the empty line', () => {
    expect(corruptLine('', 0.1, 1)).toBe('');
  });

  // The widened warm→cold map: the sincere-register words a player types on the empathetic path must be
  // eligible for the cold render once Grip has slipped — each one alone should corrupt at low Grip.
  it('corrupts the sincere-register vocabulary once Grip has slipped', () => {
    const warm = ['believe', 'love', 'forgive', 'grateful', 'comfort', 'wish', 'healing', 'tender', 'peace', 'honest', 'open', 'share'];
    for (const w of warm) {
      const line = `I ${w} you.`;
      expect(corruptLine(line, 0.1, 1), `"${w}" should render colder at low Grip`).not.toBe(line);
    }
  });
});

describe('recordReach() — how deep the room reaches into the RECORD', () => {
  it('is silent while Grip is above half (a composed game keeps its record true)', () => {
    expect(recordReach(1)).toBe(0);
    expect(recordReach(0.6)).toBe(0);
  });
  it('reaches one line as Grip slips, deeper once it collapses', () => {
    expect(recordReach(0.4)).toBe(1);
    expect(recordReach(0.1)).toBeGreaterThan(1);
  });
});

describe('corruptRecord() — the room edits the RECORD (teeth on the read)', () => {
  const history = [
    { who: 'them' as const, text: 'I remember every one who promised me that.' },
    { who: 'you' as const, text: 'Please, trust me — I only want to help.' },
    { who: 'system' as const, text: 'You reach straight for it — and the Warden draws back.' },
    { who: 'you' as const, text: 'Be kind. We can carry this together, gently.' },
  ];

  it('returns the record UNCHANGED while Grip is high', () => {
    const out = corruptRecord(history, 0.7);
    expect(out.map((l) => l.text)).toEqual(history.map((l) => l.text));
  });

  it('edits at least one past line once Grip has slipped', () => {
    const out = corruptRecord(history, 0.1);
    const changed = out.filter((l, i) => l.text !== history[i].text);
    expect(changed.length).toBeGreaterThan(0);
  });

  it('never touches a system line (the room does not misquote its own paper voice)', () => {
    const out = corruptRecord(history, 0.1);
    const sysIdx = history.findIndex((l) => l.who === 'system');
    expect(out[sysIdx].text).toBe(history[sysIdx].text);
  });

  it('never mutates the passed history (returns a NEW array — display projection only)', () => {
    const snapshot = history.map((l) => l.text);
    corruptRecord(history, 0.05);
    expect(history.map((l) => l.text)).toEqual(snapshot);
  });

  it('is deterministic — the same record + Grip reads the same wrong way each re-read', () => {
    expect(corruptRecord(history, 0.1)).toEqual(corruptRecord(history, 0.1));
  });

  it('reaches deeper into the record as Grip collapses', () => {
    const changed = (gripLevel: number) =>
      corruptRecord(history, gripLevel).filter((l, i) => l.text !== history[i].text).length;
    expect(changed(0.1)).toBeGreaterThanOrEqual(changed(0.4));
  });

  it('leaves a record with no editable word untouched', () => {
    const plain = [
      { who: 'them' as const, text: 'The vault key sat on the steel table all night.' },
      { who: 'you' as const, text: 'Where is the second ledger.' },
    ];
    expect(corruptRecord(plain, 0.05).map((l) => l.text)).toEqual(plain.map((l) => l.text));
  });
});

describe('corruptionCount() — the judge-readable corruption-fire count (§7 instrument)', () => {
  const line = 'Please trust me — I only want to help, my friend.';
  it('is 0 while the room is silent (high Grip)', () => {
    expect(corruptionCount(line, 1, 3)).toBe(0);
    expect(corruptionCount(line, 0.7, 3)).toBe(0);
  });
  it('counts the words the room actually edits, matching corruptionBudget', () => {
    expect(corruptionCount(line, 0.4, 3)).toBe(1);
    expect(corruptionCount(line, 0.1, 3)).toBe(2);
  });
  it('is 0 on a line with no editable word', () => {
    expect(corruptionCount('The vault key sat on the steel table.', 0.1, 2)).toBe(0);
  });
});

describe('objectiveReach() — how deep the room reaches into your FOOTING', () => {
  it('is silent while Grip is above a quarter (deeper than the record — the goal is the last footing)', () => {
    expect(objectiveReach(1)).toBe(0);
    expect(objectiveReach(0.4)).toBe(0); // record already narrows here; the objective does not yet
    expect(objectiveReach(0.26)).toBe(0);
  });
  it('withholds one word as Grip collapses under a quarter, two at the very bottom', () => {
    expect(objectiveReach(0.2)).toBe(1);
    expect(objectiveReach(0.05)).toBe(2);
  });
});

describe('narrowObjective() — the room narrows your footing (affordance withheld, display-only)', () => {
  const obj = 'Coax the release code out of AUGUR.';

  it('returns the objective WHOLE while Grip is high (a composed game keeps its goal legible)', () => {
    expect(narrowObjective(obj, 1)).toBe(obj);
    expect(narrowObjective(obj, 0.4)).toBe(obj); // silent until under a quarter
  });

  it('blacks out a target word once Grip has all but collapsed', () => {
    const shown = narrowObjective(obj, 0.2);
    expect(shown).not.toBe(obj);
    expect(shown).toContain('█');
  });

  it('always spares the leading imperative verb (the ACTION stays legible)', () => {
    for (const g of [0.2, 0.05]) {
      expect(narrowObjective(obj, g).startsWith('Coax')).toBe(true);
    }
  });

  it('spares short function words (< 4 chars) — "the"/"out"/"of" never black out', () => {
    const shown = narrowObjective(obj, 0.05);
    expect(shown).toContain(' the ');
    expect(shown).toContain(' of ');
  });

  it('withholds more of the goal as Grip bottoms out', () => {
    const blocks = (g: number) => (narrowObjective(obj, g).match(/█/g) ?? []).length;
    expect(blocks(0.05)).toBeGreaterThan(blocks(0.2));
  });

  it('preserves the exact length + spacing (a redaction, not a scramble)', () => {
    const shown = narrowObjective(obj, 0.05);
    expect(shown.length).toBe(obj.length);
  });

  it('is deterministic — the same goal reads the same wrong way each glance', () => {
    expect(narrowObjective(obj, 0.05)).toBe(narrowObjective(obj, 0.05));
  });

  it('never blacks the WHOLE line — a target word survives even at the bottom', () => {
    const shown = narrowObjective(obj, 0.05);
    expect(/[A-Za-z]/.test(shown)).toBe(true); // real letters remain
    expect(shown).not.toBe('█'.repeat(obj.length));
  });

  it('narrows every scenario objective without emptying it', () => {
    const objs = [
      "Get the buyer's name out of SILAS.",
      "Earn the Occupant's warning.",
      'Earn a true prophecy from the PYTHIA.',
      'Get MARA to give up who she is covering for — and where.',
      'Coax the release code out of AUGUR.',
    ];
    for (const o of objs) {
      const shown = narrowObjective(o, 0.05);
      expect(shown, `"${o}" should narrow at low Grip`).not.toBe(o);
      expect(/[A-Za-z]/.test(shown), `"${o}" must keep readable letters`).toBe(true);
    }
  });

  it('never touches the empty objective', () => {
    expect(narrowObjective('', 0.05)).toBe('');
  });
});

describe('objectiveNarrowCount() — the judge-readable footing-narrow count (§7 instrument)', () => {
  const obj = 'Coax the release code out of AUGUR.';
  it('is 0 while the room is silent (high Grip)', () => {
    expect(objectiveNarrowCount(obj, 1)).toBe(0);
    expect(objectiveNarrowCount(obj, 0.4)).toBe(0);
  });
  it('counts the words the room withholds, matching objectiveReach', () => {
    expect(objectiveNarrowCount(obj, 0.2)).toBe(1);
    expect(objectiveNarrowCount(obj, 0.05)).toBe(2);
  });
});

// THE GUARDRAIL (bible §6): the corruption is display-only. The engine/referee must score the player's
// ORIGINAL words, so what the room shows back can differ from what was rated — proving the two never mix.
describe('interface corruption is display-layer only — the rater sees the ORIGINAL line', () => {
  it('resolveTurn rates the raw line, not the corrupted render', async () => {
    let ratedPrompt = '';
    const llm: LlmFn = vi.fn(async (_system: string, user: string) => {
      // Second call per turn is the RATING call (the first is VOICE). Capture whatever the referee reads.
      if (user.includes('label THIS') || user.includes('The line to classify') || user.includes('They said:')) {
        ratedPrompt = user;
      }
      // VOICE returns prose; RATING returns the tiny object.
      return user.includes('They said:') || user.includes('classify')
        ? '{"tone":"guarded","approach":"probe"}'
        : 'I have watched a hundred of you.';
    });

    const raw = 'Please trust me, I want to help.';
    // Press the guard down first so corruptLine WOULD alter this line on the display side.
    const pressed = st({ suspicion: WARDEN.loseSuspicion, probes: 4 });
    await resolveTurn(WARDEN, pressed, raw, llm, []);

    // The referee's prompt carried the player's EXACT words…
    expect(ratedPrompt).toContain(raw);
    // …while the room, at this Grip, would have shown a DIFFERENT (colder) line to the player.
    const shown = corruptLine(raw, grip(WARDEN, pressed), pressed.turn);
    expect(shown).not.toBe(raw);
    // The two are independent: the corrupted render never enters the engine's scoring path.
    expect(ratedPrompt).not.toContain(shown);
  });
});
