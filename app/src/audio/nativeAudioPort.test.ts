// Unit test for the native audio port adapter (mandate #1). No expo-audio / native dependency: a fake
// player factory stands in for `createAudioPlayer`, so the reconcile-to-playback mapping, the one-player-
// per-track caching, and the never-throw contract are all exercised under node.

import { describe, expect, it, vi } from 'vitest';
import { createNativeAudioPort, TRACK_VOLUME, type NativePlayer } from './nativeAudioPort';
import type { AudioTrack } from './director';

function fakePlayer(): NativePlayer & { plays: number; pauses: number } {
  return {
    loop: false,
    volume: -1,
    plays: 0,
    pauses: 0,
    play() {
      this.plays++;
    },
    pause() {
      this.pauses++;
    },
  };
}

describe('native audio port — the platform mouth', () => {
  it('builds a looping, mixed player on first start and plays it', () => {
    const players: Partial<Record<AudioTrack, ReturnType<typeof fakePlayer>>> = {};
    const port = createNativeAudioPort((track) => (players[track] = fakePlayer()));

    port.start('bed');

    const bed = players.bed!;
    expect(bed.loop).toBe(true);
    expect(bed.volume).toBe(TRACK_VOLUME.bed);
    expect(bed.plays).toBe(1);
  });

  it('reuses ONE player per track across start/stop cycles (no per-call allocation)', () => {
    const make = vi.fn((_track: AudioTrack) => fakePlayer());
    const port = createNativeAudioPort(make);

    port.start('scratch');
    port.stop('scratch');
    port.start('scratch');

    expect(make).toHaveBeenCalledTimes(1); // acquired once, reused
    expect(make).toHaveBeenCalledWith('scratch');
  });

  it('stop pauses the track; a stop before any start is a no-op (never builds a player)', () => {
    const players: Partial<Record<AudioTrack, ReturnType<typeof fakePlayer>>> = {};
    const make = vi.fn((track: AudioTrack) => (players[track] = fakePlayer()));
    const port = createNativeAudioPort(make);

    port.stop('bed'); // stop with nothing playing — must not allocate
    expect(make).not.toHaveBeenCalled();

    port.start('bed');
    port.stop('bed');
    expect(players.bed!.pauses).toBe(1);
  });

  it('never throws when the native factory fails — routes to the log and stays silent', () => {
    const log = vi.fn();
    const port = createNativeAudioPort(() => {
      throw new Error('expo-audio not linked');
    }, log);

    expect(() => port.start('bed')).not.toThrow();
    expect(() => port.stop('bed')).not.toThrow();
    expect(log).toHaveBeenCalled();
  });

  it('never throws when a live player throws on play — routes to the log', () => {
    const log = vi.fn();
    const port = createNativeAudioPort(() => ({
      loop: false,
      volume: 0,
      play() {
        throw new Error('channel died');
      },
      pause() {},
    }), log);

    expect(() => port.start('scratch')).not.toThrow();
    expect(log).toHaveBeenCalled();
  });

  // ── mandate #2: the detune + the door ──────────────────────────────────────────────────────────────
  it('the door is built NON-looping (a one-shot), unlike the bed/scratch loops', () => {
    const players: Partial<Record<AudioTrack, ReturnType<typeof fakePlayer>>> = {};
    const port = createNativeAudioPort((track) => (players[track] = fakePlayer()));
    port.playOnce!('door');
    expect(players.door!.loop).toBe(false);
    expect(players.door!.plays).toBe(1);
    expect(players.door!.volume).toBe(TRACK_VOLUME.door);
  });

  it('playOnce rewinds the door to its start so each strike plays from zero', () => {
    const seeks: number[] = [];
    const player: NativePlayer & { plays: number } = {
      loop: false,
      volume: 0,
      plays: 0,
      play() {
        this.plays++;
      },
      pause() {},
      seekTo(s: number) {
        seeks.push(s);
      },
    };
    const port = createNativeAudioPort(() => player);
    port.playOnce!('door');
    port.playOnce!('door');
    expect(seeks).toEqual([0, 0]);
    expect(player.plays).toBe(2);
  });

  it('setRate shifts PITCH (shouldCorrectPitch off) on a player that supports it', () => {
    const rates: number[] = [];
    const player: NativePlayer = {
      loop: true,
      volume: 0,
      shouldCorrectPitch: true,
      play() {},
      pause() {},
      setPlaybackRate(rate: number) {
        rates.push(rate);
      },
    };
    const port = createNativeAudioPort(() => player);
    port.setRate!('bed', 0.943);
    expect(rates).toEqual([0.943]);
    expect(player.shouldCorrectPitch).toBe(false);
  });

  it('setRate is a graceful no-op on a player that cannot vary rate (never throws)', () => {
    const log = vi.fn();
    const port = createNativeAudioPort(() => fakePlayer(), log); // fakePlayer has no setPlaybackRate
    expect(() => port.setRate!('bed', 0.9)).not.toThrow();
    expect(log).not.toHaveBeenCalled(); // absence of the capability is not an error
  });
});
