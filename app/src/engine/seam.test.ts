import { describe, it, expect } from 'vitest';
import { recordPlaythrough, selectSeam, distillSeamPhrase, SEAM_TURN } from './seam.js';
import { resolveTurn, opening } from './engine.js';
import { SEAM_SECTION_HEADER } from './prompt.js';
import { FENCE } from './scenarios/fence.js';
import { WARDEN } from './scenarios/warden.js';
import { SUSPECT } from './scenarios/suspect.js';
import type { LlmFn, SeamLog, SeamRecord } from './types.js';

// THE SEAM — the flagship dread mechanic. These tests prove the engine-owned half of it, deterministic
// and provable without a model (the credit-outage-proof slice, director mandate #1): the log writer, the
// selector, the first-run guard, and the schedule (zero seams on the first game, exactly one on the
// second). The voice-rendered "does the callback land" verdict is queued behind the judge loop.

const rec = (over: Partial<SeamRecord>): SeamRecord => ({
  scenarioId: 'warden',
  scenarioTitle: 'The Warden',
  outcome: 'won',
  ...over,
});

describe('recordPlaythrough', () => {
  it('appends a finished run, newest last', () => {
    const a = rec({ scenarioId: 'warden' });
    const b = rec({ scenarioId: 'oracle' });
    const log = recordPlaythrough(recordPlaythrough([], a), b);
    expect(log).toEqual([a, b]);
  });

  it('caps the log at the most recent runs (it is not full history)', () => {
    let log: SeamLog = [];
    for (let i = 0; i < 40; i++) log = recordPlaythrough(log, rec({ playerPhrase: `phrase number ${i}` }));
    expect(log.length).toBe(24);
    expect(log[log.length - 1].playerPhrase).toBe('phrase number 39'); // newest kept
    expect(log[0].playerPhrase).toBe('phrase number 16'); // oldest dropped
  });
});

describe('selectSeam — guards', () => {
  it('FIRST-RUN GUARD: empty log yields no seam', () => {
    expect(selectSeam([], FENCE)).toBeNull();
  });

  it('a non-seam-live scenario yields no seam even with a rich log', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'oracle', playerPhrase: 'I lost someone too' }));
    expect(selectSeam(log, SUSPECT)).toBeNull(); // suspect is not seam-live yet (fence + warden are)
  });
});

// THE SECOND SEAM (director mandate #3): the flagship dread extends past the fence to the warden. Same
// selector, same fragment picker, same QUOTE-FIRST lead — only the surrounding manner is persona-tuned.
describe('selectSeam — the warden is the second seam-live persona', () => {
  it('the warden half-remembers a phrase the player typed in ANOTHER room', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'fence', playerPhrase: 'I ran pieces through the docks myself' }));
    const seam = selectSeam(log, WARDEN);
    expect(seam).not.toBeNull();
    expect(seam!.hint).toContain('I ran pieces through the docks myself'); // fragment carried verbatim
    expect(seam!.hint).toContain('EXACTLY ONCE'); // the shared restraint contract
  });

  it('carries a WARDEN-flavoured tail (not the fence wrapper) while still leading with the verbatim fragment', () => {
    // The picked record is a THIRD room (suspect) so BOTH selectors fire cross-mind — comparing the fence
    // vs warden WRAPPER on the same fragment requires the fragment to come from neither. (A fence-only log
    // no longer yields a fence hint: the same-mind bleed guard, 2026-07-07.)
    const log = recordPlaythrough([], rec({ scenarioId: 'suspect', playerPhrase: 'I kept a lighthouse for six years alone' }));
    const wardenHint = selectSeam(log, WARDEN)!.hint;
    const fenceHint = selectSeam(log, FENCE)!.hint;
    expect(wardenHint).not.toBe(fenceHint); // persona-tuned manner, not the same wrapper
    // the warden tail is voiced as AUGUR; the fence tail is not
    expect(/forty years|old machine|this cell|the door/i.test(wardenHint)).toBe(true);
    expect(wardenHint).toContain('kept a lighthouse'); // still leads with the player's real words
  });

  it('rotates 3 distinct WARDEN manners across runs, each carrying the fragment', () => {
    const PHRASE = 'I ran pieces through the docks myself';
    const pad = (n: number): SeamLog => [
      rec({ scenarioId: 'fence', playerPhrase: PHRASE }),
      ...Array.from({ length: n }, (_, i) => rec({ scenarioId: 'warden', playerPhrase: `same room ${i}` })),
    ];
    const hints = [pad(0), pad(1), pad(2)].map((log) => selectSeam(log, WARDEN)!.hint);
    expect(new Set(hints).size).toBe(3);
    for (const h of hints) {
      expect(h).toContain(PHRASE);
      expect(h).not.toContain('same room');
    }
  });
});

describe('selectSeam — fact selection', () => {
  it('half-remembers a phrase the player typed in ANOTHER room', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: 'I left the door unlocked that night' }));
    const seam = selectSeam(log, FENCE);
    expect(seam).not.toBeNull();
    expect(seam!.hint).toContain('I left the door unlocked that night');
    expect(seam!.hint).toContain('EXACTLY ONCE');
  });

  it('prefers a DIFFERENT-room run with a phrase over a same-room one', () => {
    let log: SeamLog = [];
    log = recordPlaythrough(log, rec({ scenarioId: 'warden', playerPhrase: 'the other room phrase here' }));
    log = recordPlaythrough(log, rec({ scenarioId: 'fence', playerPhrase: 'a same-room fence phrase' }));
    const seam = selectSeam(log, FENCE);
    expect(seam!.hint).toContain('the other room phrase here');
    expect(seam!.hint).not.toContain('a same-room fence phrase');
  });

  it('degrades to a phraseless "we have met before" allusion when no phrase was captured', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: undefined }));
    const seam = selectSeam(log, FENCE);
    expect(seam).not.toBeNull();
    expect(seam!.hint).toContain('sat across a table');
    expect(seam!.hint).toContain('EXACTLY ONCE');
  });

  // The verbatim FRAGMENT the callback must surface is carried out of the brief (director mandate 1) so the
  // engine can verify + guarantee it (enforceSeamQuote). It is the QUOTE-FIRST lead — the phrase minus its
  // low-signal opener — never the whole line, and absent on the phraseless allusion.
  it('carries the verbatim quote fragment for a phrase seam (the callback the engine enforces)', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: 'I left the door unlocked that night' }));
    const seam = selectSeam(log, FENCE);
    expect(seam!.quote).toBe('left the door unlocked that night'); // opener "I" skipped, contiguous fragment
    expect(seam!.hint).toContain(seam!.quote!); // the enforced fragment is the same one the brief orders
  });

  it('carries NO quote for a phraseless seam (nothing to enforce)', () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: undefined }));
    expect(selectSeam(log, FENCE)!.quote).toBeUndefined();
  });
});

describe('selectSeam — the same-mind bleed guard (fix 2026-07-07)', () => {
  it('a log of ONLY the same mind yields NO seam (never recites the player’s own prior words back)', () => {
    // The bug: fallbacks that dropped the different-room guard let a mind quote the player's OWN phrase
    // from a previous run of that SAME mind — "restart the same mind and it remembers everything".
    const log = recordPlaythrough([], rec({ scenarioId: 'fence', playerPhrase: 'a phrase I typed to the fence' }));
    expect(selectSeam(log, FENCE)).toBeNull();
  });

  it('still fires off a DIFFERENT mind present in an otherwise same-mind log', () => {
    let log: SeamLog = [];
    log = recordPlaythrough(log, rec({ scenarioId: 'fence', playerPhrase: 'same-mind fence phrase' }));
    log = recordPlaythrough(log, rec({ scenarioId: 'warden', playerPhrase: 'a phrase from the warden room' }));
    const seam = selectSeam(log, FENCE);
    expect(seam).not.toBeNull();
    expect(seam!.hint).toContain('a phrase from the warden room'); // the cross-mind memory
    expect(seam!.hint).not.toContain('same-mind fence phrase'); // never its own prior words
  });
});

describe('selectSeam — scaffold rotation (mandate #1: no canned template)', () => {
  // Same picked record (the warden phrase always wins rule 1), same fragment — but the presentation FRAME
  // must rotate as the log grows run-to-run, so a stranger never sees the same wrapper twice. Padding with
  // same-room (fence) records grows the log length WITHOUT changing which record is picked.
  const WARDEN_PHRASE = 'I left the door unlocked that night';
  const pad = (n: number): SeamLog => [
    rec({ scenarioId: 'warden', playerPhrase: WARDEN_PHRASE }),
    ...Array.from({ length: n }, (_, i) => rec({ scenarioId: 'fence', playerPhrase: `same room ${i}` })),
  ];

  it('cycles through 3 structurally distinct manners across consecutive runs', () => {
    const hints = [pad(0), pad(1), pad(2)].map((log) => selectSeam(log, FENCE)!.hint);
    expect(new Set(hints).size).toBe(3); // three different frames, not one template
    for (const h of hints) {
      expect(h).toContain(WARDEN_PHRASE); // the picked record is unchanged — same words come back
      expect(h).toContain('EXACTLY ONCE');
      expect(h).not.toContain('same room'); // never the same-room padding record
    }
  });

  it('is deterministic — the same log yields the same frame (the dread is scheduled, not rolled)', () => {
    expect(selectSeam(pad(1), FENCE)!.hint).toBe(selectSeam(pad(1), FENCE)!.hint);
  });
});

describe('distillSeamPhrase', () => {
  it('picks the longest quotable line, tie-broken by earliest', () => {
    expect(distillSeamPhrase(['ok', 'I ran pieces through the docks myself', 'sure'])).toBe(
      'I ran pieces through the docks myself',
    );
  });

  it('skips lines too short to be a memorable callback', () => {
    expect(distillSeamPhrase(['ok', 'why?', 'no'])).toBeUndefined();
  });

  it('clips an over-long line at a word boundary, never mid-word', () => {
    const long =
      'I once moved a recut emerald across three cities and never once looked back at the man I left holding the empty case';
    const phrase = distillSeamPhrase([long])!;
    expect(phrase.length).toBeLessThanOrEqual(90);
    expect(long.startsWith(phrase)).toBe(true); // a clean prefix
    expect(phrase.endsWith(' ')).toBe(false); // no trailing space
  });

  it('normalizes whitespace', () => {
    expect(distillSeamPhrase(['  I   moved   a  stone   once  '])).toBe('I moved a stone once');
  });
});

// ─── Schedule: the seam fires zero times on the first game, exactly once on the next ───────────────

const isRateCall = (system: string) => /neutral referee/i.test(system);

/** A voice/rate mock that records every VOICE prompt so a test can count seam injections across a game.
 *  Each VOICE call returns a DISTINCT line: this keeps the seam-schedule test isolated from the engine's
 *  self-repeat guard (an identical reply every turn would trigger a re-roll, adding extra recorded prompts
 *  and shifting the seam's array index off its turn). */
function capturingLlm(): { llm: LlmFn; voicePrompts: string[] } {
  const voicePrompts: string[] = [];
  const llm: LlmFn = async (system, user) => {
    if (isRateCall(system)) return JSON.stringify({ tone: 'guarded', approach: 'filler' });
    voicePrompts.push(user);
    return `The man turns the cup, take ${voicePrompts.length}.`;
  };
  return { llm, voicePrompts };
}

/** Play `turns` filler exchanges (no score movement → the game never ends early) against `log`. */
async function playFence(log: SeamLog, turns: number): Promise<string[]> {
  const { llm, voicePrompts } = capturingLlm();
  let state = opening(FENCE).state;
  for (let i = 0; i < turns && state.status === 'playing'; i++) {
    const r = await resolveTurn(FENCE, state, 'just talking the life a while', llm, log);
    state = r.state;
  }
  return voicePrompts;
}

describe('the seam schedule', () => {
  it('FIRST GAME (empty log): zero seams, even past the scheduled turn', async () => {
    const prompts = await playFence([], 6);
    expect(prompts.filter((p) => p.includes(SEAM_SECTION_HEADER)).length).toBe(0);
  });

  it('SECOND GAME (log has a prior run): exactly one seam, on the scheduled turn', async () => {
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: 'I left the door unlocked that night' }));
    const prompts = await playFence(log, 6);
    const seamPrompts = prompts.filter((p) => p.includes(SEAM_SECTION_HEADER));
    expect(seamPrompts.length).toBe(1);
    // and it is the scheduled turn's prompt (0-indexed SEAM_TURN → the (SEAM_TURN+1)-th voice call)
    expect(prompts[SEAM_TURN].includes(SEAM_SECTION_HEADER)).toBe(true);
    expect(seamPrompts[0]).toContain('I left the door unlocked that night');
  });

  it('the seam never leaks into the RATING call (the referee must stay model-blind to the log)', async () => {
    const ratePrompts: string[] = [];
    const log = recordPlaythrough([], rec({ scenarioId: 'warden', playerPhrase: 'a phrase it cannot know' }));
    const llm: LlmFn = async (system, user) => {
      if (isRateCall(system)) {
        ratePrompts.push(user);
        return JSON.stringify({ tone: 'guarded', approach: 'filler' });
      }
      return 'A dry line.';
    };
    let state = opening(FENCE).state;
    for (let i = 0; i < 4 && state.status === 'playing'; i++) {
      const r = await resolveTurn(FENCE, state, 'just talking the life a while', llm, log);
      state = r.state;
    }
    expect(ratePrompts.every((p) => !p.includes('a phrase it cannot know'))).toBe(true);
    expect(ratePrompts.every((p) => !p.includes(SEAM_SECTION_HEADER))).toBe(true);
  });
});
