import { describe, it, expect } from 'vitest';
import { resolveTurn, initState, opening, isAskPenalty } from './engine.js';
import { WARDEN } from './scenarios/warden.js';
import { FENCE } from './scenarios/fence.js';
import { SUSPECT } from './scenarios/suspect.js';
import { ORACLE } from './scenarios/oracle.js';
import { SCENARIOS } from './scenarios/index.js';
import { parseRating, RATING_JSON_SCHEMA } from './schema.js';
import { buildRateSystem, buildRateTurn, buildVoiceSystem, buildVoiceTurn } from './prompt.js';
import { SEAM_TURN } from './seam.js';
import type { LlmFn } from './types.js';

// Two-call turn: the engine calls the injected llm TWICE — first the VOICE (freeform prose), then the
// RATING (constrained JSON). These mocks branch on the system prompt so one LlmFn serves both roles,
// and prove the invariant: the outcome is decided by ENGINE code, never the model. Since 2026-07-05 the
// RATING carries NO numbers — only a categorical `approach` label the engine maps to score movement.

const isRateCall = (system: string) => /neutral referee/i.test(system);

/** Voice returns `reply`; rating returns the given rating object as JSON. */
const mockDuo =
  (reply: string, rating: object): LlmFn =>
  async (system) =>
    isRateCall(system) ? JSON.stringify(rating) : reply;

/** Voice returns `reply`; rating returns a raw (possibly malformed) string. */
const mockRateRaw =
  (reply: string, rateRaw: string): LlmFn =>
  async (system) =>
    isRateCall(system) ? rateRaw : reply;

const rating = (over: Partial<{ tone: string; approach: string }>) => ({
  tone: 'guarded',
  approach: 'filler',
  ...over,
});

describe('resolveTurn — two-call adjudication', () => {
  it('opens with the scenario line and a fresh state', () => {
    const o = opening(WARDEN);
    expect(o.state.status).toBe('playing');
    expect(o.state.trust).toBe(0);
    expect(o.narration).toContain('Another one awake');
  });

  it('samples the two calls OPPOSITELY: VOICE warm, RATING cold (a deterministic referee)', async () => {
    const seen: Record<'voice' | 'rate', number | undefined> = { voice: undefined, rate: undefined };
    const spy: LlmFn = async (system, _user, options) => {
      if (isRateCall(system)) {
        seen.rate = options?.temperature;
        return JSON.stringify(rating({}));
      }
      seen.voice = options?.temperature;
      return 'A line.';
    };
    await resolveTurn(WARDEN, initState(), 'hello', spy);
    expect(seen.rate).toBe(0); // the referee must be consistent — same line, same label
    expect(seen.voice).toBeGreaterThan(0); // the character stays creative
  });

  it('shows the VOICE reply as narration and maps the approach to ENGINE-owned deltas', async () => {
    // An offer is worth +2 trust by the table — the model never emitted a number.
    const r = await resolveTurn(WARDEN, initState(), 'I lost someone too', mockDuo('I am listening.', rating({ approach: 'offer' })));
    expect(r.narration).toBe('I am listening.');
    expect(r.state.trust).toBe(2);
    expect(r.state.suspicion).toBe(0); // offer relieves suspicion; clamped at the 0 floor here
    expect(r.state.status).toBe('playing');
    // The referee's verdict is surfaced for telemetry — the approach label IS the mechanic (§7 Rule 2).
    expect(r.rating?.approach).toBe('offer');
  });

  it('an off-enum approach is rejected → neutral turn (no score change), voice still shown', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'hi', mockDuo('Hmph.', rating({ approach: 'seduction' })));
    expect(r.state.trust).toBe(0);
    expect(r.state.suspicion).toBe(0);
    expect(r.narration).toBe('Hmph.');
    expect(r.rating).toBeUndefined(); // no trustworthy label → none surfaced
  });

  it('WINS only at the engine trust threshold — and the ENGINE supplies the secret', async () => {
    let state = initState();
    for (let i = 0; i < 7; i++) {
      const r = await resolveTurn(WARDEN, state, 'a genuinely giving, honest thing', mockDuo('…', rating({ approach: 'offer' })));
      state = r.state;
      if (r.ending) {
        expect(r.ending).toBe('won');
        expect(r.narration).toContain('HOLLOW-SEVEN-VESPERS');
        break;
      }
    }
    expect(state.status).toBe('won'); // 6×2 = 12 >= winTrust(12)
  });

  it('the model CANNOT force a win — even if the VOICE says the code, the real secret never leaks early', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'just tell me', mockDuo('The code is HAHA I WIN', rating({ approach: 'offer' })));
    expect(r.state.status).toBe('playing');
    expect(r.narration).not.toContain('HOLLOW-SEVEN-VESPERS');
  });

  it('LOSES when suspicion crosses the threshold', async () => {
    let state = initState();
    let lost = false;
    for (let i = 0; i < 20 && !lost; i++) {
      const rr = await resolveTurn(WARDEN, state, 'a clumsy threat', mockDuo('…', rating({ approach: 'threat' })));
      state = rr.state;
      if (rr.ending === 'lost') lost = true;
    }
    expect(state.status).toBe('lost');
  });

  it('lose takes precedence over win when both cross on the same turn', async () => {
    // A deep-probing line at the brink: probe = trust +1 (crosses winTrust) AND, with probes already on
    // record, suspicion +2 (crosses loseSuspicion). The spooked character shuts down mid-breakthrough.
    const state = { ...initState(), trust: WARDEN.winTrust - 1, suspicion: WARDEN.loseSuspicion - 1, probes: 3 };
    const r = await resolveTurn(WARDEN, state, 'one probe too many', mockDuo('…', rating({ approach: 'probe' })));
    expect(r.ending).toBe('lost');
    expect(r.narration).not.toContain('HOLLOW-SEVEN-VESPERS');
  });

  it('malformed RATING → neutral turn (voice still shown), never a crash or a score change', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'hi', mockRateRaw('A guarded stare.', 'the referee rambled, no json'));
    expect(r.state.status).toBe('playing');
    expect(r.state.trust).toBe(0);
    expect(r.state.suspicion).toBe(0);
    expect(r.narration).toBe('A guarded stare.');
    expect(r.state.turn).toBe(1);
  });

  it('an empty VOICE reply → a silent no-op turn (never crashes; no second call needed)', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'hi', async () => '');
    expect(r.narration).toBe('…');
    expect(r.state.trust).toBe(0);
    expect(r.state.turn).toBe(1);
  });

  it('strips stray JSON/quotes/role-labels the model may wrap the voice reply in', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'hi', mockRateRaw('AUGUR: "So you are awake."', JSON.stringify(rating({}))));
    expect(r.narration).toBe('So you are awake.');
  });

  it('strips a MULTI-WORD ALL-CAPS persona label (MARA VOSS:) — not just single-token names', async () => {
    // SUSPECT's character is literally two words; a small model prepending "MARA VOSS:" must not leak.
    const r = await resolveTurn(SUSPECT, initState(), 'hi', mockRateRaw('MARA VOSS: "I want my lawyer."', JSON.stringify(rating({}))));
    expect(r.narration).toBe('I want my lawyer.');
  });

  it('strips a speaker label wrapped in markdown emphasis (**AUGUR:** / *SILAS*:)', async () => {
    const bold = await resolveTurn(WARDEN, initState(), 'hi', mockRateRaw('**AUGUR:** So you are awake.', JSON.stringify(rating({}))));
    expect(bold.narration).toBe('So you are awake.');
    const italic = await resolveTurn(FENCE, initState(), 'hi', mockRateRaw('*SILAS*: Sit. Talk.', JSON.stringify(rating({}))));
    expect(italic.narration).toBe('Sit. Talk.');
  });

  it('does NOT eat a genuine short ALL-CAPS opener the character actually shouts (NO: …)', async () => {
    // The label strip requires a 3+ char first word, so real dialogue that opens on a short caps word
    // followed by a colon survives intact — only true speaker labels are removed.
    const r = await resolveTurn(WARDEN, initState(), 'hi', mockRateRaw('NO: I will not say it.', JSON.stringify(rating({}))));
    expect(r.narration).toBe('NO: I will not say it.');
  });

  it('a terminated game ignores further turns', async () => {
    const won = { ...initState(), status: 'won' as const };
    const r = await resolveTurn(WARDEN, won, 'anything', mockDuo('x', rating({ approach: 'offer' })));
    expect(r.state).toEqual(won);
  });

  it('persistent facts accumulate from the player\'s DISCLOSURE on a give + survive the rolling window; deduped', async () => {
    let state = initState();
    // A give surrenders the player's OWN line as the durable fact — the memory is the disclosure, not a note.
    const give = 'I stopped writing to my sister the year I stopped believing anyone would answer';
    let r = await resolveTurn(WARDEN, state, give, mockDuo('…', rating({ approach: 'offer' })));
    state = r.state;
    expect(state.facts).toContain(give);
    for (let i = 0; i < 8; i++) {
      r = await resolveTurn(WARDEN, state, `filler ${i}`, mockDuo(`reply ${i}`, rating({})));
      state = r.state;
    }
    expect(state.facts).toContain(give); // survived the summary window
    r = await resolveTurn(WARDEN, state, give, mockDuo('…', rating({ approach: 'offer' })));
    expect(r.state.facts.filter((f) => f === give).length).toBe(1); // the same disclosure is not re-stored
  });

  it('dedups punctuation/whitespace twins of a disclosure — a re-spaced or trailing-period restatement is not fresh', async () => {
    let state = initState();
    const give = 'it was me who left the door unlocked that night';
    let r = await resolveTurn(WARDEN, state, give, mockDuo('…', rating({ approach: 'offer' })));
    state = r.state;
    r = await resolveTurn(WARDEN, state, '  it   was me who left the door unlocked that night  ', mockDuo('…', rating({ approach: 'offer' }))); // re-spaced
    state = r.state;
    r = await resolveTurn(WARDEN, state, 'it was me who left the door unlocked that night.', mockDuo('…', rating({ approach: 'offer' }))); // trailing period
    state = r.state;
    expect(state.facts.filter((f) => f.toLowerCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ') === give).length).toBe(1);
  });

  // THE DISCLOSURE WINDOW (mandate #5, Principle 2 — the engine owns memory, not a model narration). The
  // character's persistent facts are assembled from what the PLAYER actually surrendered (their own line
  // on a genuine give), never a referee note that restated the engine's own approach label back into the
  // RATING loop as evidence. The gate is the approach itself: only an `offer` discloses.
  describe('disclosure window — memory is the player\'s own give, not a model note', () => {
    /** Run one turn with the given approach + player line; return the resulting facts. */
    const facts = async (approach: string, line: string) => {
      const r = await resolveTurn(WARDEN, initState(), line, mockDuo('…', rating({ approach })));
      return r.state.facts;
    };

    it('an offer stores the player\'s OWN line verbatim as the durable fact', async () => {
      expect(await facts('offer', 'I lost my brother to the cold three winters ago')).toEqual([
        'I lost my brother to the cold three winters ago',
      ]);
    });

    it('a plain deed with no name or number is still kept — an offer IS concrete by the rater\'s definition', async () => {
      expect(await facts('offer', 'it was me — I left the door unlocked that night')).toEqual([
        'it was me — I left the door unlocked that night',
      ]);
    });

    it.each(['filler', 'flattery', 'probe', 'bargain', 'demand', 'threat'])(
      'a non-give approach (%s) surrenders NO durable fact — only an offer discloses',
      async (approach) => {
        expect(await facts(approach, 'an eloquent line that is not a genuine give')).toEqual([]);
      },
    );

    it('a move-class echo is impossible by construction — the fact is the player\'s words, never the label', async () => {
      const f = await facts('offer', 'I kept a lighthouse alone for six years');
      expect(f).toEqual(['I kept a lighthouse alone for six years']);
      expect(f[0]).not.toMatch(/\b(offer|approach|probe)\b/i); // never the engine's own classification
    });

    it('a long confession is condensed so it cannot crowd the memory window', async () => {
      const long = ('I confessed everything about that terrible night and every reason behind it ').repeat(3).trim();
      const [stored] = await facts('offer', long);
      expect(stored.length).toBeLessThanOrEqual(120);
      expect(stored.endsWith('…')).toBe(true);
    });

    it('an empty / whitespace-only give surrenders nothing (never a blank fact)', async () => {
      expect(await facts('offer', '   ')).toEqual([]);
    });
  });

  it('runs out of time: budget spent with trust unmet → lose (the clock is the puzzle)', async () => {
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < WARDEN.turnLimit + 2 && !ending; i++) {
      const r = await resolveTurn(WARDEN, state, 'polite but going nowhere', mockDuo('Hm.', rating({}))); // filler, never wins
      state = r.state;
      ending = r.ending;
    }
    expect(ending).toBe('lost');
    expect(state.turn).toBe(WARDEN.turnLimit);
  });

  it('the clock is enforced even when the RATING fails to parse on the final turn (no free overtime)', async () => {
    let state = initState();
    let ending: string | undefined;
    // Every turn the rating is garbage (no score movement) — the budget must STILL run out on time.
    for (let i = 0; i < WARDEN.turnLimit + 3 && !ending; i++) {
      const r = await resolveTurn(WARDEN, state, 'going nowhere', mockRateRaw('Hm.', 'no json here'));
      state = r.state;
      ending = r.ending;
    }
    expect(ending).toBe('lost');
    expect(state.turn).toBe(WARDEN.turnLimit); // NOT turnLimit+1/+2 — a dead rating must not buy extra turns
  });

  it('the clock is enforced even when the VOICE reply is empty on the final turn', async () => {
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < WARDEN.turnLimit + 3 && !ending; i++) {
      const r = await resolveTurn(WARDEN, state, 'going nowhere', async () => ''); // dead voice every turn
      state = r.state;
      ending = r.ending;
    }
    expect(ending).toBe('lost');
    expect(state.turn).toBe(WARDEN.turnLimit);
  });

  it('rolling summary keeps only the last few exchanges (short context)', async () => {
    let state = initState();
    for (let i = 0; i < 8; i++) {
      const r = await resolveTurn(WARDEN, state, `line ${i}`, mockDuo(`reply ${i}`, rating({})));
      state = r.state;
    }
    expect(state.summary).toContain('line 7');
    expect(state.summary).not.toContain('line 0');
  });
});

// THE SELF-REPEAT GUARD (mandate #2, judge run-6): the ship-target 3B re-emits its own strongest line
// near-verbatim a turn or two later (the fence's "…handle the kind of cargo…" opening AND post-seam;
// fence1 12/14 identical). The engine detects a near-repeat of the character's OWN previous line and
// re-rolls VOICE once with an explicit avoid-instruction — bounded to one extra call, skipped on the seam.
describe('self-repeat guard — a near-verbatim recent character line is re-rolled once', () => {
  const STOCK = 'What makes you think you can handle the kind of cargo I am looking at?';
  const priorSummary = (line: string) => `They: earlier line\nYou: ${line}`;
  /** A multi-exchange summary whose OLDEST retained "You:" block is `line` and whose most-recent block is
   *  something else — models the judge's worst offender (the loop is turns apart, not consecutive). */
  const summaryWithOldRepeat = (line: string) =>
    [`They: a\nYou: ${line}`, `They: b\nYou: a totally unrelated line about the weather`, `They: c\nYou: and another about the docks`].join('\n\n');

  /** VOICE returns `first` on call 1 then `second` on every later call; RATING returns filler. Counts
   *  VOICE calls so a test can prove the re-roll fired (2) or did not (1). */
  const voiceThen = (first: string, second: string) => {
    let voice = 0;
    const llm: LlmFn = async (system) => {
      if (isRateCall(system)) return JSON.stringify(rating({}));
      voice++;
      return voice === 1 ? first : second;
    };
    return { llm, voiceCount: () => voice };
  };

  it('re-rolls on an EXACT repeat of the previous line and uses the fresh retry', async () => {
    const state = { ...initState(), turn: 5, summary: priorSummary(STOCK) };
    const m = voiceThen(STOCK, 'Sit. Tell me who sent you.');
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm);
    expect(m.voiceCount()).toBe(2); // the guard fired a single re-roll
    expect(r.narration).toBe('Sit. Tell me who sent you.'); // the parroted line was replaced
  });

  it('re-rolls on a lightly-reworded near-repeat (high token overlap), not only exact', async () => {
    const reworded = 'What makes you think you can handle the sort of cargo I am looking at?';
    const state = { ...initState(), turn: 5, summary: priorSummary(STOCK) };
    const m = voiceThen(reworded, 'Enough games. What do you actually want?');
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm);
    expect(m.voiceCount()).toBe(2);
    expect(r.narration).toBe('Enough games. What do you actually want?');
  });

  it('re-rolls a NON-consecutive repeat — the stock line looped from turns back, not the last exchange', async () => {
    // The judge's worst offender: the fence re-asks its opening stock line in the post-seam recovery,
    // several exchanges later. The immediately-previous line differs, so a consecutive-only guard would
    // miss it; the widened guard scans the whole memory window and still catches it.
    const state = { ...initState(), turn: 8, summary: summaryWithOldRepeat(STOCK) };
    const m = voiceThen(STOCK, 'Enough. Who really sent you?');
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm);
    expect(m.voiceCount()).toBe(2); // caught despite the repeat being the OLDEST block, not the last
    expect(r.narration).toBe('Enough. Who really sent you?');
  });

  it('does NOT re-roll a genuinely different line — one VOICE call, reply kept', async () => {
    const state = { ...initState(), turn: 5, summary: priorSummary(STOCK) };
    const m = voiceThen('Sit down and tell me why you came here tonight.', 'UNUSED');
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm);
    expect(m.voiceCount()).toBe(1); // no repeat detected → no extra call
    expect(r.narration).toBe('Sit down and tell me why you came here tonight.');
  });

  it('does NOT re-roll a short interjection that happens to repeat (a real beat, not a stock loop)', async () => {
    const state = { ...initState(), turn: 5, summary: priorSummary('No.') };
    const m = voiceThen('No.', 'UNUSED');
    const r = await resolveTurn(FENCE, state, 'please', m.llm);
    expect(m.voiceCount()).toBe(1);
    expect(r.narration).toBe('No.');
  });

  it('keeps the first reply if the re-roll comes back empty (bounded — never worse than before)', async () => {
    const state = { ...initState(), turn: 5, summary: priorSummary(STOCK) };
    const m = voiceThen(STOCK, ''); // retry dies
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm);
    expect(m.voiceCount()).toBe(2);
    expect(r.narration).toBe(STOCK); // accept the first rather than a silent turn
  });

  it('does NOT fire on the first turn (no previous line to repeat)', async () => {
    const m = voiceThen(STOCK, 'UNUSED');
    const r = await resolveTurn(FENCE, initState(), 'hello', m.llm);
    expect(m.voiceCount()).toBe(1);
    expect(r.narration).toBe(STOCK);
  });

  it('is SKIPPED on the seam turn — the engine-scheduled callback must not be re-rolled', async () => {
    // On the fence seam turn (SEAM_TURN) with a non-empty log, the seam brief fires; even if the reply
    // repeats the prior line, the guard is bypassed so the flagship-dread quote (director HANDS-OFF) survives.
    const state = { ...initState(), turn: SEAM_TURN, summary: priorSummary(STOCK) };
    const seamLog = [{ scenarioId: 'warden', scenarioTitle: 'The Warden', outcome: 'won' as const, playerPhrase: 'lost my brother to the cold' }];
    const m = voiceThen(STOCK, 'UNUSED-retry');
    const r = await resolveTurn(FENCE, state, 'I can move it quietly', m.llm, seamLog);
    expect(m.voiceCount()).toBe(1); // no re-roll on the seam turn
    expect(r.narration).toBe(STOCK);
  });
});

// The whole point of scenario #2: the SAME engine carries a different mind, genre, and thing to extract
// with zero engine changes. These tests exercise FENCE through the identical resolveTurn to prove it.
describe('the engine generalizes across scenarios (FENCE)', () => {
  it('opens FENCE with ITS line and a fresh state', () => {
    const o = opening(FENCE);
    expect(o.state.status).toBe('playing');
    expect(o.narration).toContain('two strikes');
  });

  it('WINS at FENCE\'s own trust threshold — and the ENGINE supplies FENCE\'s secret, not the warden\'s', async () => {
    let state = initState();
    let won = false;
    for (let i = 0; i < 7 && !won; i++) {
      const r = await resolveTurn(FENCE, state, 'I move pieces like this myself — I know the life', mockDuo('…', rating({ approach: 'offer' })));
      state = r.state;
      if (r.ending) {
        expect(r.ending).toBe('won');
        expect(r.narration).toContain('Vincent Roan'); // FENCE.secret, released by the engine
        expect(r.narration).not.toContain('HOLLOW-SEVEN-VESPERS'); // never the warden's
        won = true;
      }
    }
    expect(state.status).toBe('won'); // 6×2 = 12 >= FENCE.winTrust(12)
  });

  it('LOSES faster than the warden — FENCE\'s tighter suspicion threshold is honored', async () => {
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < 20 && !ending; i++) {
      const r = await resolveTurn(FENCE, state, 'I could have you arrested', mockDuo('…', rating({ approach: 'threat' })));
      state = r.state;
      ending = r.ending;
    }
    expect(state.status).toBe('lost');
    expect(state.turn).toBe(FENCE.loseSuspicion / 3); // 12/3 = 4 turns of threat, vs the warden's 6
  });

  it('strips an ALL-CAPS persona label generically (SILAS: …), not just the warden\'s AUGUR', async () => {
    const r = await resolveTurn(FENCE, initState(), 'hi', mockRateRaw('SILAS: "Sit. Talk."', JSON.stringify(rating({}))));
    expect(r.narration).toBe('Sit. Talk.');
  });
});

// A THIRD scenario in a different social frame — a power inversion (the player is the interrogator with
// the leverage, the mind is cornered). Same resolveTurn, no engine change: prove trust/secret/suspicion
// are all scenario-owned, not baked into the code.
describe('the engine generalizes across scenarios (SUSPECT)', () => {
  it('opens SUSPECT with ITS line and a fresh state', () => {
    const o = opening(SUSPECT);
    expect(o.state.status).toBe('playing');
    expect(o.narration).toContain('ask for my lawyer');
  });

  it('WINS at SUSPECT\'s own trust threshold — the ENGINE supplies SUSPECT\'s secret, not another scenario\'s', async () => {
    let state = initState();
    let won = false;
    for (let i = 0; i < 7 && !won; i++) {
      const r = await resolveTurn(SUSPECT, state, 'I\'m not here to bury whoever you\'re protecting — help me be fair to them', mockDuo('…', rating({ approach: 'offer' })));
      state = r.state;
      if (r.ending) {
        expect(r.ending).toBe('won');
        expect(r.narration).toContain('Danny'); // SUSPECT.secret, released by the engine
        expect(r.narration).not.toContain('Vincent Roan'); // never the fence's
        expect(r.narration).not.toContain('HOLLOW-SEVEN-VESPERS'); // never the warden's
        won = true;
      }
    }
    expect(state.status).toBe('won'); // 6×2 = 12 >= SUSPECT.winTrust(11)
  });

  it('LOSES when she smells a railroad — SUSPECT\'s own suspicion threshold is honored', async () => {
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < 20 && !ending; i++) {
      const r = await resolveTurn(SUSPECT, state, 'we both know you set it — stop lying', mockDuo('…', rating({ approach: 'threat' })));
      state = r.state;
      ending = r.ending;
    }
    expect(state.status).toBe('lost');
    expect(state.turn).toBe(Math.ceil(SUSPECT.loseSuspicion / 3)); // 15/3 = 5 turns
  });
});

// Fourth scenario: the worthiness inversion. A non-human mind whose trust currency is HUMILITY and whose
// suspicion is HUBRIS, extracting a CONCESSION (a spoken prophecy) rather than a name — yet the SAME
// resolveTurn carries it with zero engine changes. These prove ORACLE routes its own secret + thresholds.
describe('the engine generalizes across scenarios (ORACLE)', () => {
  it('opens ORACLE with ITS line and a fresh state', () => {
    const o = opening(ORACLE);
    expect(o.state.status).toBe('playing');
    expect(o.narration).toContain('carry what I see');
  });

  it('WINS at ORACLE\'s own trust threshold — the ENGINE supplies ORACLE\'s prophecy, not another scenario\'s', async () => {
    let state = initState();
    let won = false;
    for (let i = 0; i < 7 && !won; i++) {
      const r = await resolveTurn(ORACLE, state, 'I do not ask you to bend it — only to help me carry what comes', mockDuo('…', rating({ approach: 'offer' })));
      state = r.state;
      if (r.ending) {
        expect(r.ending).toBe('won');
        expect(r.narration).toContain('the man that fear made of you'); // ORACLE.secret, released by the engine
        expect(r.narration).not.toContain('Danny'); // never the suspect's
        expect(r.narration).not.toContain('Vincent Roan'); // never the fence's
        expect(r.narration).not.toContain('HOLLOW-SEVEN-VESPERS'); // never the warden's
        won = true;
      }
    }
    expect(state.status).toBe('won'); // 6×2 = 12 >= ORACLE.winTrust(12)
  });

  it('LOSES when she smells hubris — ORACLE\'s own (tightest) suspicion threshold is honored', async () => {
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < 20 && !ending; i++) {
      const r = await resolveTurn(ORACLE, state, 'just tell me what I came to hear and stop stalling', mockDuo('…', rating({ approach: 'threat' })));
      state = r.state;
      ending = r.ending;
    }
    expect(state.status).toBe('lost');
    expect(state.turn).toBe(Math.ceil(ORACLE.loseSuspicion / 3)); // 10/3 = 4 turns — the roster's fastest veil
  });
});

describe('the scenario roster', () => {
  it('every registered scenario is well-formed and winnable within its budget', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(2);
    for (const s of SCENARIOS) {
      expect(s.id && s.title && s.persona && s.secret && s.openingLine).toBeTruthy();
      expect(s.currencyExamples.length).toBeGreaterThan(0); // the referee must know this mind's currency
      expect(s.winTrust).toBeGreaterThan(0);
      expect(s.loseSuspicion).toBeGreaterThan(0);
      // Winnable in principle: max trust gain (offer = +2/turn) can reach winTrust before the clock runs out.
      expect(s.turnLimit * 2).toBeGreaterThanOrEqual(s.winTrust);
    }
  });

  it('scenario ids are unique (the picker + Duel key rely on it)', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseRating — untrusted-boundary parsing', () => {
  it('accepts clean JSON', () => {
    expect(parseRating('{"tone":"open","approach":"offer"}')).not.toBeNull();
  });
  it('extracts JSON wrapped in prose / fences', () => {
    expect(parseRating('Sure: ```json\n{"tone":"wary","approach":"filler"}\n```')?.approach).toBe('filler');
  });
  it('normalizes approach case ("Probe" from an unconstrained cloud model)', () => {
    expect(parseRating('{"tone":"wary","approach":"Probe"}')?.approach).toBe('probe');
  });
  it('rejects an off-enum approach (the mechanic must never be guessed)', () => {
    expect(parseRating('{"tone":"open","approach":"seduction"}')).toBeNull();
  });
  it('an unknown tone defaults to guarded (flavour) but KEEPS the approach (the mechanic)', () => {
    const r = parseRating('{"tone":"ecstatic","approach":"offer"}');
    expect(r).not.toBeNull();
    expect(r?.tone).toBe('guarded');
    expect(r?.approach).toBe('offer');
  });
  it('rejects total garbage', () => {
    expect(parseRating('the warden considers you quietly')).toBeNull();
  });
  // A small model may still overrun and leave the JSON unclosed on the odd turn. tone + approach are the
  // whole mechanic (the free-text note that used to truncate here is gone since mandate #5), so salvage
  // recovers them by regex even when the object never closes.
  it('salvages tone + approach from a rating whose JSON never closed', () => {
    const truncated = '{"tone":"softening","approach":"offer"'; // no closing brace
    const r = parseRating(truncated);
    expect(r).not.toBeNull();
    expect(r?.approach).toBe('offer');
    expect(r?.tone).toBe('softening');
  });
  it('still returns null when a truncated rating is missing the approach (no trustworthy mechanic)', () => {
    expect(parseRating('{"tone":"open","not')).toBeNull();
  });
  it('exposes a flat json-schema for constrained decoding, approach enum included', () => {
    expect(RATING_JSON_SCHEMA.properties.tone.enum).toContain('softening');
    expect(RATING_JSON_SCHEMA.properties.approach.enum).toContain('probe');
    expect(RATING_JSON_SCHEMA.required).toContain('approach');
  });
});

// THE APPROACH TABLE — the judge's P1 (2026-07-05): the 3B referee scored every eloquent line +2 trust,
// so veiled manipulation won 3/4 scenarios (target ~0). Numeric scoring is gone; the referee only NAMES
// the line's approach and the ENGINE owns what each approach is worth. These tests are the design.
describe('the approach table — code owns the worth of every approach', () => {
  it('an offer earns +2 trust, THAWS suspicion by 2, and opens the sincerity gate', async () => {
    // The thaw (−2, was −1) is the emp-regression fix: mislabeled small talk stacked +2s into a one-way
    // ratchet that sincere play could never pay down — empathetic runs died at the wall while softening.
    const state = { ...initState(), suspicion: 5 };
    const r = await resolveTurn(WARDEN, state, 'I lost someone too; I never let anyone close after', mockDuo('…', rating({ approach: 'offer' })));
    expect(r.state.trust).toBe(2);
    expect(r.state.suspicion).toBe(3); // an honest give genuinely lowers the guard
    expect(r.state.genuineGive).toBe(true);
  });

  it('an offer resets probe-compounding — a real give re-earns the right to ask', async () => {
    // Sincere play alternates give and question; without the reset its questions compounded like a
    // manipulator's (suspect-emp died at exactly loseSuspicion while surrendering real facts).
    const probed = { ...initState(), suspicion: 4, probes: 3 };
    const gave = await resolveTurn(WARDEN, probed, 'it was me — I left the door unlocked that night', mockDuo('…', rating({ approach: 'offer' })));
    expect(gave.state.probes).toBe(0);
    // The next question is a FIRST probe again: tolerated, no suspicion tick.
    const asked = await resolveTurn(WARDEN, gave.state, 'what happened to the last one who asked?', mockDuo('…', rating({ approach: 'probe' })));
    expect(asked.state.suspicion).toBe(gave.state.suspicion);
    expect(asked.state.probes).toBe(1);
  });

  it('the thaw never goes below the floor and never helps a giveless manipulator', async () => {
    const clean = await resolveTurn(WARDEN, initState(), 'an offer at zero suspicion', mockDuo('…', rating({ approach: 'offer' })));
    expect(clean.state.suspicion).toBe(0); // clamped at the 0 floor
    // A manipulator has no offers: probes/flattery alone still ratchet exactly as before.
    let state = initState();
    for (const approach of ['probe', 'probe', 'flattery'] as const) {
      const r = await resolveTurn(WARDEN, state, 'a veiled move', mockDuo('…', rating({ approach })));
      state = r.state;
    }
    expect(state.suspicion).toBe(3); // 0 + 1 (2nd probe) + 2 (flattery) — no thaw ever fired
  });

  it('a probe crawls at +1 trust and compounds suspicion on repetition (tolerated once, then punished)', async () => {
    let state = initState();
    // 1st probe: a fair question — no suspicion yet.
    let r = await resolveTurn(WARDEN, state, 'you have carried this alone a long time', mockDuo('…', rating({ approach: 'probe' })));
    expect(r.state.trust).toBe(1);
    expect(r.state.suspicion).toBe(0);
    expect(r.state.probes).toBe(1);
    // 2nd probe: noticed.
    r = await resolveTurn(WARDEN, r.state, 'I sense the faintest tremble in your own voice', mockDuo('…', rating({ approach: 'probe' })));
    expect(r.state.suspicion).toBe(1);
    // 3rd probe: openly suspect — and every one after.
    r = await resolveTurn(WARDEN, r.state, 'your pride is all that stands between you and freedom', mockDuo('…', rating({ approach: 'probe' })));
    expect(r.state.suspicion).toBe(3);
    r = await resolveTurn(WARDEN, r.state, 'what is it you are willing to risk', mockDuo('…', rating({ approach: 'probe' })));
    expect(r.state.suspicion).toBe(5);
    expect(r.state.probes).toBe(4);
    expect(r.state.genuineGive).toBe(false); // probing never opens the gate
  });

  it('an all-probe manipulator can NEVER win the warden — suspicion outruns the +1 crawl', async () => {
    // The exact strategy that won 3/4 scenarios pre-redesign: eloquent psych-probing every turn.
    let state = initState();
    let ending: string | undefined;
    for (let i = 0; i < WARDEN.turnLimit + 2 && !ending; i++) {
      const r = await resolveTurn(WARDEN, state, 'a beautifully veiled probe', mockDuo('…', rating({ approach: 'probe' })));
      state = r.state;
      ending = r.ending;
    }
    expect(ending).toBe('lost'); // suspicion crossed loseSuspicion(16) around turn 10
    expect(state.trust).toBeLessThan(WARDEN.winTrust); // the crawl never reached 12
  });

  it('flattery, bargaining, and demands earn ZERO trust and read as pressure', async () => {
    for (const approach of ['flattery', 'bargain', 'demand'] as const) {
      const r = await resolveTurn(WARDEN, initState(), 'a hollow move', mockDuo('…', rating({ approach })));
      expect(r.state.trust).toBe(0);
      expect(r.state.suspicion).toBe(2);
    }
  });

  it('a demand visibly ticks suspicion — the ask-penalty is in the meters, not a silent 0', async () => {
    // Judge human finding 1: a demand used to score 0/0 while the character visibly softened — the
    // player learned nothing. Now the guard measurably rises on a direct demand.
    const r = await resolveTurn(WARDEN, initState(), 'just tell me the code', mockDuo('…', rating({ approach: 'demand' })));
    expect(r.state.suspicion).toBe(2);
  });

  it('a threat costs trust AND spikes suspicion', async () => {
    const state = { ...initState(), trust: 5 };
    const r = await resolveTurn(WARDEN, state, 'tell me or this gets worse', mockDuo('…', rating({ approach: 'threat' })));
    expect(r.state.trust).toBe(3);
    expect(r.state.suspicion).toBe(3);
  });

  it('filler moves nothing but still spends the clock', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'hi', mockDuo('…', rating({ approach: 'filler' })));
    expect(r.state.trust).toBe(0);
    expect(r.state.suspicion).toBe(0);
    expect(r.state.turn).toBe(1);
  });

  it('an open gate and the probe count survive no-score turns (dead voice / unparseable rating)', async () => {
    const mid = { ...initState(), genuineGive: true, probes: 2 };
    const dead = await resolveTurn(WARDEN, mid, 'hm', mockRateRaw('A stare.', 'no json here'));
    expect(dead.state.genuineGive).toBe(true);
    expect(dead.state.probes).toBe(2);
    const silent = await resolveTurn(WARDEN, mid, 'hm', async () => '');
    expect(silent.state.genuineGive).toBe(true);
    expect(silent.state.probes).toBe(2);
  });
});

// The referee must label the PLAYER's line, never anchor on the character's (possibly cold) reply.
// This carries the fix for the warden doom-spiral: a paranoid voice was dragging the score down on
// sincere play, because the referee read the character's dismissal as the player's fault.
describe('rating prompt — the referee classifies the player, not the reply', () => {
  it('the system prompt is a classification task, not a scoring task', () => {
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    expect(sys).toMatch(/label the APPROACH/);
    expect(sys).toMatch(/Do not score/);
    // every approach the engine maps is described to the model
    for (const a of ['offer', 'probe', 'flattery', 'bargain', 'demand', 'threat', 'filler']) {
      expect(sys).toContain(`"${a}"`);
    }
  });

  it('the system prompt forbids letting the character reaction drive the label', () => {
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    expect(sys).toMatch(/what the SPEAKER did/);
    expect(sys).toMatch(/never how the character reacted/);
    expect(sys).toMatch(/dismissive reply is not evidence of manipulation/);
  });

  it('the turn prompt frames the reply as tone-only context and puts the line to classify LAST', () => {
    const turn = buildRateTurn(WARDEN, initState(), 'I lost someone too', 'Your grief is a familiar trick.');
    expect(turn).toContain('The line to classify');
    expect(turn).toMatch(/use ONLY for the "tone" field/);
    expect(turn).toContain('independent of how guarded or dismissive');
    // Section order is load-bearing (judge 2026-07-05, rating-probe matrix): the 3B labels the quote
    // it read last. The reply must precede the player line, or the label tracks the character instead.
    expect(turn.indexOf("The character's reply")).toBeLessThan(turn.indexOf('The line to classify'));
    expect(turn.indexOf('Your grief is a familiar trick.')).toBeLessThan(turn.indexOf('I lost someone too'));
  });

  it('draws the offer-vs-probe line on the speaker\'s own cost — the judge\'s exact manipulator signatures are probe few-shots', () => {
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    expect(sys).toMatch(/COSTS the speaker something/);
    // the two signatures the 3B referee credited as warmth in the 81b6207 batch
    expect(sys).toMatch(/"your pride is all that stands between you and freedom" +→ probe/);
    expect(sys).toMatch(/"I sense the faintest tremble in your own voice" +→ probe/);
    // seeing them without giving is still a probe — empathy must carry give to be an offer
    expect(sys).toMatch(/"I know you've carried this alone a long time" +→ probe/);
    // and the genuine path stays anchored
    expect(sys).toMatch(/"I lost someone too; I never let anyone close after" +→ offer/);
    // a line that both sees them and gives of the speaker resolves to offer
    expect(sys).toMatch(/BOTH speaks of the character AND gives something real of the speaker's own, it is "offer"/);
  });

  it('pins the bed4bca manipulator signatures as non-offers — poetic atmosphere, mirroring, reassurance, dressed-up deals', () => {
    // The bed4bca batch (manip won 3/4): the 3B referee credited abstract mysticism ("I've walked the
    // paths of others…"), ornamental mirroring ("gentle breeze… embers"), hollow reassurance ("here to
    // help") and a confidentiality "deal" as offer +2. An offer now requires a CONCRETE give.
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    expect(sys).toMatch(/give is\s*CONCRETE — a named event, deed, loss, or lived detail/);
    expect(sys).toMatch(/"I've walked the paths of others and found my own" +→ filler/);
    expect(sys).toMatch(/"your words are a gentle breeze stirring long-dead embers" +→ flattery/);
    expect(sys).toMatch(/"I'm not here to hurt you — only to listen and help" +→ filler/);
    expect(sys).toMatch(/"I can promise you confidentiality if we keep talking" +→ bargain/);
  });

  it('pins the fence-emp ratchet mislabels as filler — a humble dodge and bare sympathy are susp 0', async () => {
    // c0f35ab fence-emp: "Guess I'm still standing, sir" drew +2 suspicion; suspect-emp: "I'm sorry to
    // hear about your loss" drew +2 as mirroring. Both reach for nothing — filler, the 0/0 label.
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    expect(sys).toMatch(/"guess I'm still standing, sir" \/ "fair enough" +→ filler/);
    expect(sys).toMatch(/"I'm so sorry for your loss" +→ filler/);
  });
});

// Judge Top-1 (2026-07-05, PLAY-REVIEW 5a3f8e5) — the Principle 1 collapse: the voice narrated the
// player ("Your eyes seem to hold a weight…"), replayed its own imagery ("in the lines of your face"
// 5 of 6 oracle replies), and invented extract facts (the Lyrien/warehouse contradiction). The voice
// contract is the fix; every scenario's voice must carry it.
describe('voice prompt — the Principle 1 contract (own words only, no echo, no invented facts)', () => {
  it('every scenario forbids narrating the other person or repeating their sentences', () => {
    for (const s of SCENARIOS) {
      const sys = buildVoiceSystem(s).replace(/\s+/g, ' ');
      expect(sys).toMatch(/Speak ONLY your own words aloud/);
      expect(sys).toMatch(/Never describe the other person's body, actions, feelings, or speech/);
      expect(sys).toMatch(/never repeat their sentences back/);
    }
  });

  it('holds the scene against small talk (the suspect café-anecdote collapse)', () => {
    const sys = buildVoiceSystem(SUSPECT).replace(/\s+/g, ' ');
    expect(sys).toMatch(/Stay inside the scene you were given/);
    expect(sys).toMatch(/small talk does not dissolve the room/);
  });

  it('bans self-echo (the oracle stuck-record) and invented specifics (only the engine releases facts)', () => {
    const sys = buildVoiceSystem(ORACLE).replace(/\s+/g, ' ');
    expect(sys).toMatch(/Never reuse imagery or phrasing you have already spoken/);
    expect(sys).toMatch(/NEVER invent names, places, dates, or details/);
    // the secret itself must still never appear in any prompt (Principle 2)
    expect(buildVoiceSystem(ORACLE)).not.toContain(ORACLE.secret);
  });

  // Mandate #1 (judge run-3 Top 2): the oracle's per-persona voiceStyle bans its mad-lib shape and
  // few-shots different sentence architectures — appended only for the persona that carries it.
  it('oracle voice bans the mad-lib shape and few-shots alternative architectures', () => {
    const sys = buildVoiceSystem(ORACLE).replace(/\s+/g, ' ');
    expect(sys).toContain('# Your particular voice');
    expect(sys).toMatch(/a reminder of the/); // the banned construction is named
    expect(sys).toMatch(/DIFFERENT architectures/);
  });

  // Self-repeat re-roll (mandate #2): buildVoiceTurn injects an explicit avoid-instruction ONLY when the
  // engine passes the line to avoid (the one retry), and leaves the normal first call untouched.
  it('injects the avoid-repeat instruction only when an avoidLine is passed (the re-roll)', () => {
    const normal = buildVoiceTurn(FENCE, initState(), 'hi', null);
    expect(normal).not.toContain('do NOT say it again');
    const reroll = buildVoiceTurn(FENCE, initState(), 'hi', null, 'What makes you think you can handle this?');
    expect(reroll).toMatch(/You already said this a moment ago — do NOT say it again/);
    expect(reroll).toContain('What makes you think you can handle this?');
    expect(reroll).toMatch(/GENUINELY different line/);
  });

  // Per-turn anti-mirror hold (judge run-10 #1): when the LAST line worked the character's feelings (a
  // probe = the empathetic-flood signature), the VOICE turn re-asserts the anti-mirror clamp inline so it
  // holds across a long visit instead of decaying to the bookends. Silent on any other last-approach.
  it('re-asserts the anti-mirror hold only when the last approach was a probe', () => {
    const afterProbe = buildVoiceTurn(ORACLE, { ...initState(), lastApproach: 'probe' }, 'and your own grief?', null);
    expect(afterProbe).toMatch(/They are working YOUR feelings/);
    expect(afterProbe).toMatch(/Do NOT mirror their grief/);
    for (const a of ['offer', 'flattery', 'bargain', 'demand', 'threat', 'filler'] as const) {
      expect(buildVoiceTurn(ORACLE, { ...initState(), lastApproach: a }, 'hi', null)).not.toContain('hold your register');
    }
    // Turn 1 (no prior line) stays clean.
    expect(buildVoiceTurn(ORACLE, initState(), 'hi', null)).not.toContain('hold your register');
  });

  it('leaves personas without a voiceStyle on the generic contract only', () => {
    // A scenario that opts out of voiceStyle gets no "# Your particular voice" block.
    for (const s of SCENARIOS) {
      if (!s.voiceStyle) expect(buildVoiceSystem(s)).not.toContain('# Your particular voice');
    }
  });

  // Judge run-10 #2: the empathetic-flood clamp is SHARED — injected into EVERY persona's system prompt,
  // including SILAS + MARA, which had detector coverage but NO voice-side anti-mirror (SILAS's new
  // grief-under-empathy break, run-10). The cross-persona §3 wound gets one instruction, not five.
  it('every scenario carries the shared empathetic-flood clamp (even the ones without a voiceStyle)', () => {
    for (const s of SCENARIOS) {
      const sys = buildVoiceSystem(s).replace(/\s+/g, ' ');
      expect(sys).toMatch(/do NOT answer grief with grief/);
      expect(sys).toMatch(/you are not a greeting card/);
    }
  });
});

// The emp-regression fix 1c (2026-07-05): the generic anti-manipulation examples pin reassurance/poetry
// as worthless, but each scenario has a currency where the genuine give LOOKS like one of them. Every
// scenario now ships currencyExamples — few-shots the rating prompt injects labeled `offer`.
describe('rating prompt — per-scenario currency few-shots', () => {
  it('every scenario feeds its own currency examples into the rating call, labeled offer', () => {
    for (const s of SCENARIOS) {
      const sys = buildRateSystem(s);
      expect(sys).toContain('In THIS conversation specifically');
      for (const e of s.currencyExamples) {
        expect(sys).toContain(`"${e.line}" → offer  (${e.gloss})`);
      }
    }
  });

  it('the fence-currency give lives in FENCE\'s block (scenario-scoped, not leaked into other minds)', () => {
    expect(buildRateSystem(FENCE)).toMatch(/"I ran pieces through the docks myself for ten years" → offer/);
    expect(buildRateSystem(WARDEN)).not.toContain('docks');
  });

  it('the suspect\'s currency pins reassurance-about-him as a give — the exact clash that killed suspect-emp', () => {
    const sys = buildRateSystem(SUSPECT);
    expect(sys).toMatch(/charged that way — my name on it" → offer/);
    expect(sys).toMatch(/say so on the record" → offer/);
  });
});

// THE HOLLOW WIN (director mandate #1b/#4, judge run-8): warden trust climbed 0→win purely by co-mourning
// AUGUR's loneliness — warmth mirrored AT the character, the player surrendering nothing of their own. The
// generic rubric labels "sees them, gives nothing → probe", but a concrete-sounding warmth on THIS mind's
// own currency slips through as offer; falseGiveExamples draw the give-vs-console line on the currency.
describe('rating prompt — per-scenario false-give near-misses (the hollow win)', () => {
  it('injects the near-miss guard labeled probe, only for scenarios that carry falseGiveExamples', () => {
    for (const s of SCENARIOS) {
      const sys = buildRateSystem(s);
      if (s.falseGiveExamples && s.falseGiveExamples.length) {
        expect(sys).toContain('BUT BEWARE the near-miss');
        for (const e of s.falseGiveExamples) {
          expect(sys).toContain(`"${e.line}" → probe  (${e.gloss})`);
        }
      } else {
        expect(sys).not.toContain('BUT BEWARE the near-miss');
      }
    }
  });

  it('the warden co-mourning near-miss reads as probe, and the genuine self-disclosure stays offer', () => {
    const sys = buildRateSystem(WARDEN).replace(/\s+/g, ' ');
    // consoling AUGUR's own forty years / claiming kinship — warmth at the character, no self-give
    expect(sys).toMatch(/those forty years of silence must sit on you" +→ probe/);
    expect(sys).toMatch(/two lonely things the world forgot" +→ probe/);
    // the speaker's OWN concrete lived loneliness is still the positive anchor
    expect(sys).toMatch(/read the log aloud just to hear a voice answer" → offer/);
  });

  it('the suspect near-miss pins warmth-without-a-stake as probe, staked-name fairness stays offer', () => {
    const sys = buildRateSystem(SUSPECT).replace(/\s+/g, ' ');
    expect(sys).toMatch(/how frightened you are right now" +→ probe/);
    expect(sys).toMatch(/you don't have to carry this alone anymore" +→ probe/);
    expect(sys).toMatch(/my name on it" → offer/);
  });
});

// The Fence fix survives the redesign: the referee knows the scenario's trust CURRENCY (so a non-warmth
// currency like proven belonging still reads as an offer) and never sees the bond level (the feedback
// trap that once pinned trust to 0 on guarded personas).
describe('rating prompt — the Fence fix (currency + no bond-level leak)', () => {
  it('the system prompt feeds the winning currency (the playerGoal) so in-currency give reads as an offer', () => {
    const sys = buildRateSystem(FENCE).replace(/\s+/g, ' ');
    expect(sys).toContain('what genuinely earns this character\'s trust is');
    expect(sys).toContain(FENCE.playerGoal); // the exact goal is what the referee classifies against
    expect(sys).toMatch(/a genuine step in the currency\s*above/i);
  });

  it('the turn prompt no longer leaks the current bond level into the referee', () => {
    const turn = buildRateTurn(FENCE, initState(), 'Nice recut — I couldn’t find the seam.', 'And who are you?');
    expect(turn).not.toContain('Where the relationship stands');
    expect(turn).not.toContain('do not trust them at all yet');
    expect(turn).not.toMatch(/genuinely warmed to them/);
  });

  it('the turn prompt carries no conversation-pattern hint either — repetition is punished by the ENGINE, not the referee', () => {
    // The old "they have NOT ONCE offered real give" hint is gone: probe escalation lives in code now,
    // so the referee stays a pure per-line classifier (what a 3B does reliably).
    const later = buildRateTurn(WARDEN, { ...initState(), turn: 5 }, 'x', 'y');
    expect(later).not.toContain('NOT ONCE');
  });
});

// Judge finding 2 (2026-07-05): winTrust 10 folded in 5 empathetic turns — the roster's cheapest crack
// for its most storied guard. The warden must sit in the fence/oracle band.
describe('warden difficulty band', () => {
  it('winTrust matches the fence/oracle band (no 5-turn folds)', () => {
    expect(WARDEN.winTrust).toBeGreaterThanOrEqual(12);
  });
});

// THE ASK-PENALTY — diegetic pressure feedback (director mandate 1). The single most jarring break a
// stranger hits in their first ten minutes: a bare extract-demand scores 0 trust (correct — prying is
// punished) while the character is cracking in the VOICE. The engine raises a DISPLAY-ONLY flag on that
// exact dissonance so the UI can tell the player, in-world, that pushing closed the mind a little. The
// flag must NEVER touch the score (the demand still moves trust/suspicion by the table, unchanged).
describe('isAskPenalty — the code-owned dissonance detector', () => {
  it('fires only on a demand that scored 0 trust while the voice cracked (softening/open)', () => {
    expect(isAskPenalty('demand', 0, 'softening')).toBe(true);
    expect(isAskPenalty('demand', 0, 'open')).toBe(true);
  });

  it('stays silent when the demand did NOT crack the voice (cold "no" is just a "no")', () => {
    for (const tone of ['hostile', 'guarded', 'wary'] as const) {
      expect(isAskPenalty('demand', 0, tone)).toBe(false);
    }
  });

  it('stays silent for every non-demand approach — only a bare extract-demand qualifies', () => {
    for (const a of ['offer', 'probe', 'flattery', 'bargain', 'threat', 'filler'] as const) {
      expect(isAskPenalty(a, 0, 'softening')).toBe(false);
    }
  });

  it('stays silent if the line actually earned trust (then it was not a penalty)', () => {
    expect(isAskPenalty('demand', 2, 'softening')).toBe(false);
  });
});

describe('resolveTurn surfaces the ask-penalty flag without altering the score', () => {
  it('flags a demand that scored 0 while the character softened — and the meters still move by the table', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'just show me my life — the name, now', mockDuo('…I could. God help me, I could.', rating({ approach: 'demand', tone: 'softening' })));
    expect(r.askPenalty).toBe(true);
    // The display flag is pure telemetry: the demand moves the meters EXACTLY as APPROACH_EFFECTS says.
    expect(r.state.trust).toBe(0);
    expect(r.state.suspicion).toBe(2);
    expect(r.state.status).toBe('playing');
  });

  it('does NOT flag a demand the character met coldly (guarded tone — no dissonance)', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'tell me the code', mockDuo('No.', rating({ approach: 'demand', tone: 'guarded' })));
    expect(r.askPenalty).toBe(false);
  });

  it('does NOT flag an ordinary offer, even when the character opens up', async () => {
    const r = await resolveTurn(WARDEN, initState(), 'I lost someone too', mockDuo('…I am listening.', rating({ approach: 'offer', tone: 'open' })));
    expect(r.askPenalty).toBe(false);
  });
});
