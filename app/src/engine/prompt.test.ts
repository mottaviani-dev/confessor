// VOICE-PROMPT contract tests. The prompt strings are the on-device model's whole brief, so the load-
// bearing bans are pinned here — a silent edit that drops one is a regression the device would show but a
// back-test would miss. Focus (judge run-12 #1): the empathetic-flood clamp must now demand a FIRST-PERSON
// answer and forbid the flood's second escape — painting the scene or narrating the seeker in 2nd/3rd
// person ("you study their face", "her hands flutter") — the persona-abandonment the grief-lexicon ban
// displaced but did not kill.

import { describe, expect, it } from 'vitest';
import { EMPATHETIC_FLOOD_CLAMP, buildVoiceSystem, buildVoiceTurn } from './prompt';
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
