// THE STUDIO SIGNATURE — Somnia's shared audio mark (bible §5): "one sound, ~1.5s — a low wooden settling
// followed by a single high, pure tone, played at studio splash. Both games' signature sounds are children
// of it." The sonic twin of the studio aperture: the connective SOUND the way the door-ajar is the
// connective IMAGE. Heard once per launch, on the first-run "remembering" screen (the studio splash), as
// the mind is remembered onto the device (Principle 6). The asset is synthesized by scripts/gen-audio.mjs
// (studio-signature.wav) alongside the room's sounds.
//
// Owned in code, same split the whole game runs on (Principle 2): this holds the TRUTH — the signature
// plays EXACTLY once per app session and never under mute — while a thin one-shot port is the mouth that
// actually plays it (the native adapter lives in useStudioSignature.ts; a fake satisfies it in tests).
// Deliberately its OWN tiny subsystem, NOT a track on the room's AudioDirector: the signature belongs to
// the studio splash, not the duel, so it must not be dragged through the director's reconcile set (it
// would risk being started/stopped with the room's looping tracks). Presentation only; never touches play.

/** The mouth: fire the (non-looping) signature once, now. Implementations must NOT throw — a dead audio
 *  channel must never break the boot screen. */
export interface OneShotPort {
  playOnce(): void;
}

/** The default port until the native adapter is wired, and the correct port anywhere without audio (the
 *  web export the screenshot harness renders). Keeps the signature fully functional + testable with no
 *  native dependency. */
export const SILENT_ONESHOT: OneShotPort = { playOnce: () => {} };

/** The studio signature sits present-but-modest under the splash — an identity stamp, not a fanfare. Fed
 *  to the native player's volume in useStudioSignature.ts. */
export const STUDIO_SIGNATURE_VOLUME = 0.5;

/**
 * The studio signature, LATCHED. The studio splash shows once per launch, so `play()` fires the sound on
 * its first honest call and never again this session — no re-fire on a re-render, a plain model re-load,
 * or a re-mounted boot screen. Muted → a no-op that does NOT latch, so un-muting while still on the splash
 * can still sound it. Pure + deterministic; the port is the only side-effect.
 */
export class StudioSignature {
  private fired = false;

  constructor(private readonly port: OneShotPort = SILENT_ONESHOT, private muted = false) {}

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Play the signature once. No-op if it already fired this session, or while muted (mute does not latch). */
  play(): void {
    if (this.fired || this.muted) return;
    this.fired = true;
    this.port.playOnce();
  }

  /** Whether the signature has already sounded this session — tests/telemetry. */
  hasFired(): boolean {
    return this.fired;
  }
}
