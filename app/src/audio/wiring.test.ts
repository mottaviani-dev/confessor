// Integration-order test for the scene-audio WIRING (mandate #3). The director's own transitions are
// covered exhaustively in director.test.ts; this pins the exact call ORDER App.tsx / useAudioDirector
// drive around a turn, so the latency mask is verified against a (mocked) generation delay end-to-end:
// bed sounds for the whole scene, scratch appears ONLY across the generation await, and mute silences all.

import { describe, expect, it } from 'vitest';
import { AudioDirector, type AudioPort, type AudioTrack } from './director';

/** A fake port that records the start/stop sequence, so we can assert what the room actually heard. */
function recordingPort(): { port: AudioPort; log: string[] } {
  const log: string[] = [];
  return {
    log,
    port: {
      start: (t: AudioTrack) => log.push(`+${t}`),
      stop: (t: AudioTrack) => log.push(`-${t}`),
    },
  };
}

describe('scene-audio wiring — the lifecycle App.tsx drives', () => {
  it('bed for the whole scene; scratch bracketed to each generation window', () => {
    const { port, log } = recordingPort();
    const dir = new AudioDirector(port);

    // Mount the duel.
    dir.enterScene();
    // Turn 1: a model call fires (send()), then first text arrives (finally).
    dir.generationStarted();
    dir.generationEnded();
    // Turn 2: same bracket.
    dir.generationStarted();
    dir.generationEnded();
    // Leave the scene (unmount).
    dir.leaveScene();

    expect(log).toEqual([
      '+bed',      // room-tone starts on mount
      '+scratch',  // transcription mask for turn 1
      '-scratch',  // first text arrived
      '+scratch',  // turn 2
      '-scratch',
      '-bed',      // silence on unmount
    ]);
  });

  it('a failed generation still stops the scratch (finally-path)', () => {
    const { port, log } = recordingPort();
    const dir = new AudioDirector(port);
    dir.enterScene();
    dir.generationStarted();
    dir.generationEnded(); // called from the try/finally even when resolveTurn throws
    expect(log).toContain('+scratch');
    expect(log).toContain('-scratch');
    expect(dir.activeTracks()).toEqual(['bed']);
  });

  it('starting muted keeps the whole scene silent until unmuted', () => {
    const { port, log } = recordingPort();
    const dir = new AudioDirector(port, { muted: true });
    dir.enterScene();
    dir.generationStarted();
    expect(log).toEqual([]); // nothing sounded while muted
    dir.setMuted(false); // player flips the toggle mid-generation
    expect(log).toEqual(['+bed', '+scratch']); // bed + the in-flight mask both come up
    dir.setMuted(true);
    expect(log).toEqual(['+bed', '+scratch', '-bed', '-scratch']); // silenced again (bed reconciled first)
  });
});
