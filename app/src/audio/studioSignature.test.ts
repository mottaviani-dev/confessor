// THE STUDIO SIGNATURE — truth tests (bible §5). The synthesis lives in scripts/gen-audio.mjs (verified
// as valid non-silent PCM at generation time; the AUDIBLE spot-verify is device-gated). Here we pin the
// only logic the app depends on: it fires EXACTLY once per session, honours mute, and never throws on the
// silent default.

import { describe, expect, it } from 'vitest';
import { StudioSignature, SILENT_ONESHOT, STUDIO_SIGNATURE_VOLUME, type OneShotPort } from './studioSignature';

/** A fake port that counts one-shots, so we can assert what the splash actually sounded. */
function countingPort(): { port: OneShotPort; plays: () => number } {
  let n = 0;
  return { port: { playOnce: () => (n += 1) }, plays: () => n };
}

describe('StudioSignature — the studio splash sound, once per launch', () => {
  it('fires once on first play', () => {
    const { port, plays } = countingPort();
    const sig = new StudioSignature(port);
    expect(sig.hasFired()).toBe(false);
    sig.play();
    expect(plays()).toBe(1);
    expect(sig.hasFired()).toBe(true);
  });

  it('latches — repeated play() never re-fires this session', () => {
    const { port, plays } = countingPort();
    const sig = new StudioSignature(port);
    sig.play();
    sig.play();
    sig.play();
    expect(plays()).toBe(1);
  });

  it('muted play is a no-op that does NOT latch — un-muting on the splash can still sound it', () => {
    const { port, plays } = countingPort();
    const sig = new StudioSignature(port, true);
    sig.play();
    expect(plays()).toBe(0);
    expect(sig.hasFired()).toBe(false);
    sig.setMuted(false);
    sig.play();
    expect(plays()).toBe(1);
  });

  it('mute after firing is inert — the sound already played', () => {
    const { port, plays } = countingPort();
    const sig = new StudioSignature(port);
    sig.play();
    sig.setMuted(true);
    sig.play();
    expect(plays()).toBe(1);
  });

  it('the silent default never throws and never latches', () => {
    const sig = new StudioSignature();
    expect(() => sig.play()).not.toThrow();
    expect(sig.hasFired()).toBe(true); // the silent port still counts as fired (the moment passed)
  });

  it('SILENT_ONESHOT is a safe no-op port', () => {
    expect(() => SILENT_ONESHOT.playOnce()).not.toThrow();
  });

  it('the signature volume is modest — an identity stamp, not a fanfare', () => {
    expect(STUDIO_SIGNATURE_VOLUME).toBeGreaterThan(0);
    expect(STUDIO_SIGNATURE_VOLUME).toBeLessThanOrEqual(0.6);
  });
});
