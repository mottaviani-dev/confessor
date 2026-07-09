import { describe, it, expect, beforeEach } from 'vitest';
import {
  AudioDirector,
  SILENT_PORT,
  MAX_DETUNE,
  doorSchedule,
  type AudioPort,
  type AudioTrack,
} from './director';

// A fake port that records every start/stop, so a test can assert both the CURRENT set of playing
// tracks and the exact call sequence (to prove idempotence — no double-start, no redundant stop).
function fakePort() {
  const calls: string[] = [];
  const port: AudioPort = {
    start: (t: AudioTrack) => calls.push(`start:${t}`),
    stop: (t: AudioTrack) => calls.push(`stop:${t}`),
  };
  return { port, calls };
}

describe('AudioDirector', () => {
  let calls: string[];
  let d: AudioDirector;
  beforeEach(() => {
    const f = fakePort();
    calls = f.calls;
    d = new AudioDirector(f.port);
  });

  it('starts nothing before a scene is entered', () => {
    expect(d.activeTracks()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('enterScene starts the bed only', () => {
    d.enterScene();
    expect(d.activeTracks()).toEqual(['bed']);
    expect(calls).toEqual(['start:bed']);
  });

  it('generationStarted adds the scratch on top of the bed', () => {
    d.enterScene();
    d.generationStarted();
    expect(new Set(d.activeTracks())).toEqual(new Set(['bed', 'scratch']));
    expect(calls).toEqual(['start:bed', 'start:scratch']);
  });

  it('generationEnded stops the scratch but leaves the bed', () => {
    d.enterScene();
    d.generationStarted();
    d.generationEnded();
    expect(d.activeTracks()).toEqual(['bed']);
    expect(calls).toEqual(['start:bed', 'start:scratch', 'stop:scratch']);
  });

  it('leaveScene stops everything', () => {
    d.enterScene();
    d.generationStarted();
    d.leaveScene();
    expect(d.activeTracks()).toEqual([]);
    expect(calls.slice(-2).sort()).toEqual(['stop:bed', 'stop:scratch']);
  });

  it('generationStarted with no active scene does nothing (guard)', () => {
    d.generationStarted();
    expect(d.activeTracks()).toEqual([]);
    expect(calls).toEqual([]);
  });

  // ── mute ──────────────────────────────────────────────────────────────────────────────────────
  it('muted from construction: entering a scene plays nothing', () => {
    const f = fakePort();
    const m = new AudioDirector(f.port, { muted: true });
    m.enterScene();
    m.generationStarted();
    expect(m.activeTracks()).toEqual([]);
    expect(f.calls).toEqual([]);
    expect(m.isMuted()).toBe(true);
  });

  it('setMuted(true) while both are playing stops both', () => {
    d.enterScene();
    d.generationStarted();
    d.setMuted(true);
    expect(d.activeTracks()).toEqual([]);
    expect(calls.slice(-2).sort()).toEqual(['stop:bed', 'stop:scratch']);
  });

  it('unmuting mid-scene resumes the bed, and the scratch if still generating', () => {
    d.enterScene();
    d.generationStarted();
    d.setMuted(true);
    calls.length = 0;
    d.setMuted(false);
    expect(new Set(d.activeTracks())).toEqual(new Set(['bed', 'scratch']));
    expect(calls.sort()).toEqual(['start:bed', 'start:scratch']);
  });

  it('unmuting mid-scene while NOT generating resumes only the bed', () => {
    d.enterScene();
    d.setMuted(true);
    calls.length = 0;
    d.setMuted(false);
    expect(d.activeTracks()).toEqual(['bed']);
    expect(calls).toEqual(['start:bed']);
  });

  it('generation toggles while muted stay silent, then surface correctly on unmute', () => {
    d.setMuted(true);
    d.enterScene();
    d.generationStarted();
    expect(calls).toEqual([]);
    d.generationEnded(); // ended before we ever unmuted
    d.setMuted(false);
    expect(d.activeTracks()).toEqual(['bed']); // no scratch — generation already ended
    expect(calls).toEqual(['start:bed']);
  });

  // ── idempotence ───────────────────────────────────────────────────────────────────────────────
  it('is idempotent: repeated identical transitions do not re-issue port calls', () => {
    d.enterScene();
    d.enterScene();
    d.generationStarted();
    d.generationStarted();
    d.generationEnded();
    d.generationEnded();
    expect(calls).toEqual(['start:bed', 'start:scratch', 'stop:scratch']);
  });

  it('SILENT_PORT never throws and the director still tracks state', () => {
    const s = new AudioDirector(SILENT_PORT);
    expect(() => {
      s.enterScene();
      s.generationStarted();
      s.generationEnded();
      s.leaveScene();
      s.setComposure(1);
      s.markTurn(4, 14);
    }).not.toThrow();
    expect(s.activeTracks()).toEqual([]);
  });
});

// ── mandate #2: audio becomes a dread mechanic ──────────────────────────────────────────────────────
// A richer port that also records setRate (the bed detune) and playOnce (the door behind the chair).
function dreadPort() {
  const rates: { track: AudioTrack; rate: number }[] = [];
  const doors: AudioTrack[] = [];
  const port: AudioPort = {
    start: () => {},
    stop: () => {},
    setRate: (track, rate) => rates.push({ track, rate }),
    playOnce: (track) => doors.push(track),
  };
  return { port, rates, doors };
}

describe('AudioDirector — composure detune (the bed sinks as the séance breaks)', () => {
  it('the bed plays at pitch (rate 1) when composure is calm', () => {
    const { port, rates } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene(); // composure 0
    expect(d.bedDetune()).toBe(1);
    expect(rates.at(-1)).toEqual({ track: 'bed', rate: 1 });
  });

  it('detunes the bed DOWN toward MAX_DETUNE as composure breaks', () => {
    const { port, rates } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene();
    d.setComposure(1);
    expect(d.bedDetune()).toBeCloseTo(1 - MAX_DETUNE, 6);
    expect(rates.at(-1)).toEqual({ track: 'bed', rate: 1 - MAX_DETUNE });
    d.setComposure(0.5);
    expect(d.bedDetune()).toBeCloseTo(1 - MAX_DETUNE / 2, 6);
  });

  it('clamps composure to [0,1] and ignores non-finite input', () => {
    const d = new AudioDirector(dreadPort().port);
    d.enterScene();
    d.setComposure(9);
    expect(d.bedDetune()).toBeCloseTo(1 - MAX_DETUNE, 6);
    d.setComposure(-3);
    expect(d.bedDetune()).toBe(1);
    d.setComposure(Number.NaN);
    expect(d.bedDetune()).toBe(1);
  });

  it('does not re-push an unchanged rate (idempotent detune)', () => {
    const { port, rates } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene();
    rates.length = 0;
    d.setComposure(0.5);
    d.setComposure(0.5); // same level → no new port call
    expect(rates).toHaveLength(1);
  });

  it('while muted the bed is silent and no rate is pushed; composure survives to unmute', () => {
    const { port, rates } = dreadPort();
    const d = new AudioDirector(port, { muted: true });
    d.enterScene();
    d.setComposure(1);
    expect(d.activeTracks()).toEqual([]);
    expect(rates).toEqual([]); // bed not playing → nothing to detune
    d.setMuted(false); // bed comes up already sunk to the standing composure
    expect(d.bedDetune()).toBeCloseTo(1 - MAX_DETUNE, 6);
  });

  it('leaveScene resets composure for the next game', () => {
    const d = new AudioDirector(dreadPort().port);
    d.enterScene();
    d.setComposure(1);
    d.leaveScene();
    d.enterScene();
    expect(d.bedDetune()).toBe(1);
  });
});

// ── the per-scenario instrument (bible §2 "Audio": one voice per mind, under the bed) ─────────────────
describe('AudioDirector — the per-scenario instrument', () => {
  it('bed-only when a scene has no instrument (the pre-instrument default)', () => {
    const { port, calls } = fakePort();
    const d = new AudioDirector(port);
    d.enterScene(); // no instrument passed
    expect(d.activeTracks()).toEqual(['bed']);
    expect(calls).toEqual(['start:bed']);
  });

  it('starts the mind’s instrument alongside the bed on enterScene', () => {
    const { port, calls } = fakePort();
    const d = new AudioDirector(port);
    d.enterScene('choir');
    expect(d.activeTracks()).toEqual(['bed', 'choir']);
    expect(calls).toEqual(['start:bed', 'start:choir']);
  });

  it('mute silences the instrument too, and unmute brings it back', () => {
    const { port, calls } = fakePort();
    const d = new AudioDirector(port, { muted: true });
    d.enterScene('bowed');
    expect(d.activeTracks()).toEqual([]); // muted → nothing sounds
    d.setMuted(false);
    expect(d.activeTracks()).toEqual(['bed', 'bowed']);
    d.setMuted(true);
    expect(calls).toEqual(['start:bed', 'start:bowed', 'stop:bed', 'stop:bowed']);
  });

  it('the scratch mask layers OVER the bed + instrument during generation, then lifts', () => {
    const { port } = fakePort();
    const d = new AudioDirector(port);
    d.enterScene('musicbox');
    d.generationStarted();
    expect([...d.activeTracks()].sort()).toEqual(['bed', 'musicbox', 'scratch']);
    d.generationEnded();
    expect(d.activeTracks()).toEqual(['bed', 'musicbox']); // instrument stays, only the mask lifts
  });

  it('leaveScene stops the instrument and clears it for the next mind (a re-pick)', () => {
    const { port, calls } = fakePort();
    const d = new AudioDirector(port);
    d.enterScene('breath');
    d.leaveScene();
    expect(d.activeTracks()).toEqual([]);
    expect(calls).toEqual(['start:bed', 'start:breath', 'stop:bed', 'stop:breath']);
    d.enterScene(); // next scene is bed-only
    expect(d.activeTracks()).toEqual(['bed']);
  });

  it('the instrument detunes WITH the bed as composure breaks (both sink together)', () => {
    const { port, rates } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene('wire');
    expect(d.instrumentDetune()).toBe(1);
    d.setComposure(1);
    expect(d.bedDetune()).toBeCloseTo(1 - MAX_DETUNE, 6);
    expect(d.instrumentDetune()).toBeCloseTo(1 - MAX_DETUNE, 6);
    // both tonal tracks were pushed the sunk rate (scratch/door are never detuned)
    expect(rates.filter((r) => r.rate === 1 - MAX_DETUNE).map((r) => r.track).sort()).toEqual([
      'bed',
      'wire',
    ]);
  });

  it('a bed-only scene reports instrumentDetune 1 (nothing to sink)', () => {
    const d = new AudioDirector(dreadPort().port);
    d.enterScene();
    d.setComposure(1);
    expect(d.instrumentDetune()).toBe(1);
  });
});

describe('AudioDirector — the door behind the chair (code-owned 3× schedule)', () => {
  it('doorSchedule spreads three strictly-increasing milestones across the budget', () => {
    expect(doorSchedule(14)).toEqual([4, 9, 13]);
    expect(doorSchedule(15)).toEqual([4, 9, 14]);
    // A tight budget is forced strictly increasing so two doors never collapse onto one turn.
    const tight = doorSchedule(3);
    expect(new Set(tight).size).toBe(3);
    for (let i = 1; i < tight.length; i++) expect(tight[i]).toBeGreaterThan(tight[i - 1]);
  });

  it('fires exactly three times across a full-length game, once per milestone', () => {
    const { port, doors } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene();
    for (let turn = 1; turn <= 14; turn++) d.markTurn(turn, 14);
    expect(doors).toEqual(['door', 'door', 'door']);
    expect(d.doorsFired()).toBe(3);
  });

  it('a game that ends early hears only the milestones it reached (caps at three, never exceeds)', () => {
    const { port, doors } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene();
    for (let turn = 1; turn <= 7; turn++) d.markTurn(turn, 14); // fast crack at turn 7
    expect(doors).toEqual(['door']); // only the first milestone (turn 4) was reached
  });

  it('does not fire before a scene is entered', () => {
    const { port, doors } = dreadPort();
    const d = new AudioDirector(port);
    d.markTurn(9, 14);
    expect(doors).toEqual([]);
  });

  it('a muted milestone is consumed silently and never replays on unmute', () => {
    const { port, doors } = dreadPort();
    const d = new AudioDirector(port, { muted: true });
    d.enterScene();
    for (let turn = 1; turn <= 5; turn++) d.markTurn(turn, 14); // crosses milestone 1 (turn 4) while muted
    expect(doors).toEqual([]); // silent
    d.setMuted(false);
    d.markTurn(6, 14); // not a milestone
    expect(doors).toEqual([]); // the muted door did NOT retro-fire
    expect(d.doorsFired()).toBe(1); // but it was consumed
  });

  it('leaveScene resets the door schedule for the next game', () => {
    const { port, doors } = dreadPort();
    const d = new AudioDirector(port);
    d.enterScene();
    for (let turn = 1; turn <= 14; turn++) d.markTurn(turn, 14);
    d.leaveScene();
    d.enterScene();
    expect(d.doorsFired()).toBe(0);
    d.markTurn(4, 14);
    expect(doors).toEqual(['door', 'door', 'door', 'door']); // 3 from game one + 1 from game two
  });
});
