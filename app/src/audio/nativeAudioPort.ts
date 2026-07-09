// THE NATIVE AUDIO PORT — the platform mouth the AudioDirector talks to (mandate #1, finishing the
// residual e20f5c0 flagged: the director owned the truth of what should sound, but SILENT_PORT meant
// nothing ever played). This is the thin adapter that turns the director's start/stop into real looping
// playback via expo-audio.
//
// Kept deliberately free of any `expo-audio` / asset import so it is fully unit-testable under vitest
// (node): the caller injects a `PlayerFactory` (the native call site wires the real `createAudioPlayer`;
// tests pass a fake). The adapter owns ONE looping player per track for the app's lifetime — the set of
// tracks is fixed and tiny, so players are created lazily on first start and reused across every scene
// mount (no per-mount allocation, no native leak). It honors the AudioPort contract: never throws — a
// dead audio channel must never break a turn, so every native call is guarded and routed to the devlog.

import type { AudioPort, AudioTrack } from './director';
import { devlog } from '../llm/devlog';

/** The subset of expo-audio's `AudioPlayer` the port drives. Structural, so the real player satisfies it
 *  without a cast — and a fake satisfies it in tests. The rate/seek members are OPTIONAL: the detune
 *  (mandate #2) and the one-shot door replay degrade to no-ops on a player that lacks them. */
export interface NativePlayer {
  loop: boolean;
  volume: number;
  /** expo-audio: when false, a changed playbackRate shifts PITCH (the detune we want) instead of
   *  time-stretching. Set alongside setPlaybackRate. */
  shouldCorrectPitch?: boolean;
  play(): void;
  pause(): void;
  /** Set the playback rate (1 = original). With shouldCorrectPitch=false this is the bed's pitch drift. */
  setPlaybackRate?(rate: number): void;
  /** Rewind to a position (seconds) — used to replay the one-shot door from its start. */
  seekTo?(seconds: number): void;
}

/** Builds the looping player for a track. Called at most once per track (results are cached). */
export type PlayerFactory = (track: AudioTrack) => NativePlayer;

/** Tracks that LOOP for their lifetime; the door is a one-shot and is created non-looping. The five
 *  per-scenario instruments loop under the bed for the whole scene, like the bed itself. */
const LOOPING: Record<AudioTrack, boolean> = {
  bed: true,
  scratch: true,
  door: false,
  bowed: true,
  musicbox: true,
  breath: true,
  choir: true,
  wire: true,
};

/** Per-track mix. The room-tone bed sits LOW under the voice (bible §2 "silence as the bed"); the
 *  pen-scratch mask is a touch more present so the ~4–5s transcription wait reads as diegetic; the door
 *  behind the chair is a distant event, present enough to be heard three times a game and never explained.
 *  The instrument is a TINT under the bed — quieter than the bed so it colours the room without becoming
 *  the sound of it (the room's voice is felt, never a soundtrack). */
export const TRACK_VOLUME: Record<AudioTrack, number> = {
  bed: 0.3,
  scratch: 0.5,
  door: 0.55,
  bowed: 0.2,
  musicbox: 0.22,
  breath: 0.2,
  choir: 0.2,
  wire: 0.22,
};

/** Build a real AudioPort from a native player factory. `log` is injectable purely so a test can assert
 *  the failure path routes rather than throws. */
export function createNativeAudioPort(
  makePlayer: PlayerFactory,
  log: (...args: readonly unknown[]) => void = devlog,
): AudioPort {
  const players: Partial<Record<AudioTrack, NativePlayer>> = {};

  /** Lazily build + configure the looping player for a track, caching it. Returns null if the native
   *  factory threw (missing module / unplayable asset) — the track then stays silent for the session. */
  function acquire(track: AudioTrack): NativePlayer | null {
    const existing = players[track];
    if (existing) return existing;
    try {
      const p = makePlayer(track);
      p.loop = LOOPING[track];
      p.volume = TRACK_VOLUME[track];
      players[track] = p;
      return p;
    } catch (err) {
      log('[audio] player acquire failed', track, err);
      return null;
    }
  }

  return {
    start(track: AudioTrack): void {
      try {
        acquire(track)?.play();
      } catch (err) {
        log('[audio] start failed', track, err);
      }
    },
    stop(track: AudioTrack): void {
      try {
        players[track]?.pause();
      } catch (err) {
        log('[audio] stop failed', track, err);
      }
    },
    setRate(track: AudioTrack, rate: number): void {
      try {
        const p = acquire(track);
        if (!p?.setPlaybackRate) return; // player can't vary rate → bed plays at pitch (graceful)
        p.shouldCorrectPitch = false; // shift PITCH, not tempo — the detune
        p.setPlaybackRate(rate);
      } catch (err) {
        log('[audio] setRate failed', track, err);
      }
    },
    playOnce(track: AudioTrack): void {
      try {
        const p = acquire(track);
        if (!p) return;
        p.seekTo?.(0); // rewind so each of the three door strikes plays from its start
        p.play();
      } catch (err) {
        log('[audio] playOnce failed', track, err);
      }
    },
  };
}
