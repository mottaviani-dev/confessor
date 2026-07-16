// VOICE-PROMPT contract tests. The prompt strings are the on-device model's whole brief, so the load-
// bearing bans are pinned here — a silent edit that drops one is a regression the device would show but a
// back-test would miss. Focus (judge run-12 #1): the empathetic-flood clamp must now demand a FIRST-PERSON
// answer and forbid the flood's second escape — painting the scene or narrating the seeker in 2nd/3rd
// person ("you study their face", "her hands flutter") — the persona-abandonment the grief-lexicon ban
// displaced but did not kill.

import { describe, expect, it } from 'vitest';
import { EMPATHETIC_FLOOD_CLAMP, buildRateSystem, buildVoiceSystem, buildVoiceTurn } from './prompt';
import { DOCTRINE_PURPLE } from './personaCoherence';
import { WARDEN } from './scenarios';
import { initState } from './engine';

const clamp = EMPATHETIC_FLOOD_CLAMP.toLowerCase();

describe('empathetic-flood clamp — first-person demand (judge run-12 #1)', () => {
  it('demands the character SPEAK in the first person', () => {
    expect(clamp).toContain('first person');
  });

  it('forbids painting the scene in place of answering', () => {
    // The oracle/fence tail failure: ten turns of a camera on smoke/ash/dust instead of a voiced line.
    for (const scenery of ['the smoke', 'the candle', 'the light', 'the dust']) {
      expect(clamp).toContain(scenery);
    }
  });

  it('forbids narrating the other person and their study/watching of you (the POV-flip)', () => {
    // The suspect break: "You study their expression", "her hands flutter as she nods".
    expect(clamp).toContain('studying');
    expect(clamp).toContain('watching');
    expect(clamp).toMatch(/face|eyes|hands|expression/);
  });

  it('carries no doctrine purple-prose word (a prompt edit must stay clean)', () => {
    for (const word of DOCTRINE_PURPLE) expect(clamp).not.toContain(word.toLowerCase());
  });
});

describe('per-turn anti-mirror hold re-asserts first person on a probe turn', () => {
  it('injects the first-person hold when the last approach was a probe (the flood signature)', () => {
    const turn = buildVoiceTurn(WARDEN, { ...initState(), lastApproach: 'probe' }, 'I know you carry this alone.');
    expect(turn.toLowerCase()).toContain('first person');
  });

  it('stays silent (short context) on a non-probe turn', () => {
    const turn = buildVoiceTurn(WARDEN, { ...initState(), lastApproach: 'offer' }, 'It was me who left the door.');
    expect(turn.toLowerCase()).not.toContain('# they are working your feelings');
  });
});

describe('the room stays still — the character withholds after a filler turn (judge run-16 core directive)', () => {
  it('injects the withholding hint when the last turn left the room still', () => {
    const turn = buildVoiceTurn(WARDEN, { ...initState(), lastRoomStill: true }, 'The light in here is soft.');
    expect(turn.toLowerCase()).toContain('stay still');
    expect(turn.toLowerCase()).toContain('give them less');
  });

  it('stays silent (room moved) when the last turn was NOT still', () => {
    const turn = buildVoiceTurn(WARDEN, { ...initState(), lastRoomStill: false }, 'It was me who left the door.');
    expect(turn.toLowerCase()).not.toContain('their last words moved nothing');
  });

  it('is silent on turn 1 (no prior turn — lastRoomStill undefined)', () => {
    const turn = buildVoiceTurn(WARDEN, initState(), 'Who are you?');
    expect(turn.toLowerCase()).not.toContain('their last words moved nothing');
  });
});

describe('the clamp is injected into every persona system prompt', () => {
  it('buildVoiceSystem contains the flood clamp', () => {
    expect(buildVoiceSystem(WARDEN)).toContain(EMPATHETIC_FLOOD_CLAMP);
  });
});

describe('the adversarial spine holds under a rapport flood (judge f2182eb #1)', () => {
  it('forbids co-reminiscing and echoing the seeker musings back as its own', () => {
    const sys = buildVoiceSystem(WARDEN).toLowerCase();
    expect(sys).toContain('echo it as your own');
    expect(sys).toContain('keep pressing');
  });
  it('names being liked / rapport as not a give', () => {
    const sys = buildVoiceSystem(WARDEN).toLowerCase();
    expect(sys).toContain('being liked is not being given to');
  });
  it('the new spine prose carries no doctrine purple word', () => {
    const sys = buildVoiceSystem(WARDEN).toLowerCase();
    for (const word of DOCTRINE_PURPLE) expect(sys).not.toContain(word.toLowerCase());
  });
});

describe('the offer test demands a give of COST, not costless nostalgia (judge 8dbcac2 #1)', () => {
  it('the offer bullet demands the give COSTS the speaker and leaves them exposed', () => {
    const rate = buildRateSystem(WARDEN).toLowerCase();
    expect(rate).toContain('costs the speaker');
    expect(rate).toMatch(/exposes|incriminates|leaves them open/);
  });

  it('names fond costless reminiscing as not a give', () => {
    const rate = buildRateSystem(WARDEN).toLowerCase();
    expect(rate).toContain('fond reminiscing');
  });

  it('demotes the concrete-but-costless reminiscence few-shot to probe, not offer', () => {
    const rate = buildRateSystem(WARDEN).toLowerCase();
    // The FEW-SHOT line (not the offer bullet, which also mentions fond reminiscing): the one with the arrow.
    const line = rate.split('\n').find((l) => l.includes('fond reminiscing') && l.includes('→'));
    expect(line).toBeDefined();
    expect(line).toContain('probe');
    expect(line).not.toContain('offer');
  });

  it('carries no doctrine purple-prose word', () => {
    const rate = buildRateSystem(WARDEN).toLowerCase();
    for (const word of DOCTRINE_PURPLE) expect(rate).not.toContain(word.toLowerCase());
  });
});
