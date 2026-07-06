// THE AUDIO DIRECTOR — the room's sound, owned in code (bible §2 "Audio"; director mandate #3).
//
// Same split the whole game runs on (Principle 2): deterministic TS owns the TRUTH of what should be
// sounding right now; a thin platform port is the MOUTH that actually plays it. The director never
// imports an audio library — it takes an `AudioPort` and reconciles desired-vs-playing on every state
// change, so it is exhaustively unit-testable with a fake port and the real (expo-audio) port is a
// trivial adapter that can be swapped without touching this logic.
//
// Three sounds now (assets in `assets/audio/`, synthesized by scripts/gen-audio.mjs):
//   - 'bed'     = room-tone (60Hz hum + distant pipe knock), loops for the whole scene, LOW. It DETUNES
//                 as composure breaks (mandate #2 / bible §2 "room tone that detunes as Composure falls",
//                 Principle 4 — the engine changes what the player senses as the séance comes apart).
//   - 'scratch' = pen-scratch, loops ONLY while the model is generating — the ~4–5s wait rendered as
//                 diegetic transcription (bible §2 "make the wait diegetic").
//   - 'door'    = the door behind the chair (bible §2 key sound asset) — a ONE-SHOT heard exactly three
//                 times per full game on a CODE-owned schedule (never model-triggered), never explained.
// The mute switch silences everything and is honored on every transition.

export type AudioTrack = 'bed' | 'scratch' | 'door';

/** The platform mouth. `start`/`stop` are idempotent from the director's side — it only ever calls `start`
 *  on a track it believes is stopped, and `stop` on one it believes is playing, so an adapter may treat
 *  them as plain begin/end-loop. Implementations must not throw; a dead audio channel must never break a
 *  turn (the director routes nothing back out). */
export interface AudioPort {
  start(track: AudioTrack): void;
  stop(track: AudioTrack): void;
  /** Pitch-shift a LOOPING track by a playback-rate multiplier (1 = original pitch; <1 detunes DOWN).
   *  OPTIONAL — a port that cannot vary rate simply ignores it and the bed plays at pitch (mandate #2's
   *  detune degrades gracefully, never a hard dependency). Idempotent from the director: called only when
   *  the desired rate changed. */
  setRate?(track: AudioTrack, rate: number): void;
  /** Fire a ONE-SHOT (non-looping) sound once, now (the door behind the chair). OPTIONAL — silent on ports
   *  without it. The director owns the schedule; the port just plays when told. */
  playOnce?(track: AudioTrack): void;
}

/** A no-op port — the default until the native (expo-audio) adapter is wired, and the correct port on any
 *  platform without audio (e.g. the web export the screenshot harness uses). Keeps the director fully
 *  functional and testable with zero native dependency. */
export const SILENT_PORT: AudioPort = {
  start: () => {},
  stop: () => {},
  setRate: () => {},
  playOnce: () => {},
};

/** How far the bed pitch-drifts DOWN at full composure-break (a ~1-semitone sag: 2^(-1/12) ≈ 0.943). The
 *  room tone sinks as the séance comes apart — felt, not announced (Principle 4). */
export const MAX_DETUNE = 0.057;

/** The door behind the chair fires at these fractions of the turn budget — a deterministic, code-owned
 *  schedule (never model-triggered). A FULL game hears it exactly three times; a game that ends early
 *  (a fast crack or an early lock-out) hears the milestones it reached — the schedule caps at three, it
 *  cannot exceed it. */
export const DOOR_FRACTIONS: readonly number[] = [0.25, 0.6, 0.9];

type DirectorState = {
  muted: boolean;
  sceneActive: boolean;
  generating: boolean;
  /** Composure-break level, 0 (calm) → 1 (the séance fully unravelled). Drives the bed detune. */
  composure: number;
};

export class AudioDirector {
  private state: DirectorState = { muted: false, sceneActive: false, generating: false, composure: 0 };
  private readonly playing = new Set<AudioTrack>();
  /** The bed rate last pushed to the port — so detune updates are idempotent (no spamming setRate). null
   *  = the port holds no rate (bed stopped); a restart re-applies. */
  private bedRate: number | null = null;
  /** Door schedule state: the turn budget it was computed for, the milestone turns, and how many have
   *  fired. Door fires are evaluated ONLY in markTurn (never on unmute) so it can never stack or replay. */
  private doorLimit = 0;
  private doorMilestones: readonly number[] = [];
  private doorIndex = 0;

  constructor(private readonly port: AudioPort = SILENT_PORT, opts?: { muted?: boolean }) {
    if (opts?.muted) this.state.muted = true;
  }

  /** The scene mounted — start the room-tone bed (unless muted). */
  enterScene(): void {
    this.set({ sceneActive: true });
  }

  /** The scene unmounted — stop everything and reset the composure + door schedule for the next game. */
  leaveScene(): void {
    this.doorLimit = 0;
    this.doorMilestones = [];
    this.doorIndex = 0;
    this.set({ sceneActive: false, generating: false, composure: 0 });
  }

  /** A model call fired — start the pen-scratch latency mask (unless muted / no scene). */
  generationStarted(): void {
    this.set({ generating: true });
  }

  /** First text arrived (or the call ended/failed) — stop the scratch. Idempotent. */
  generationEnded(): void {
    this.set({ generating: false });
  }

  setMuted(muted: boolean): void {
    this.set({ muted });
  }

  isMuted(): boolean {
    return this.state.muted;
  }

  /** Set the composure-break level (0 calm → 1 fully unravelled) — the bed detunes toward MAX_DETUNE as
   *  it rises. Clamped. The scene computes it from the engine's own meters (their crack + your spook), so
   *  the player HEARS the séance coming apart (Principle 4: the engine changes what you sense). */
  setComposure(level: number): void {
    const composure = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
    this.set({ composure });
  }

  /** Current bed detune rate, for tests/telemetry (1 when calm/silent; < 1 as composure breaks). */
  bedDetune(): number {
    return this.bedRate ?? 1;
  }

  /** Advance the code-owned door schedule to the given turn (1-based) within a `turnLimit`-turn game. Fires
   *  the door once per crossed milestone (silent when muted, but still consumed so it never replays), capped
   *  at three per game. Model-independent by construction — the engine calls this from turn resolution. */
  markTurn(turn: number, turnLimit: number): void {
    if (!this.state.sceneActive) return;
    if (this.doorLimit !== turnLimit) {
      this.doorLimit = turnLimit;
      this.doorMilestones = doorSchedule(turnLimit);
      this.doorIndex = 0;
    }
    while (this.doorIndex < this.doorMilestones.length && turn >= this.doorMilestones[this.doorIndex]) {
      this.doorIndex += 1;
      if (!this.state.muted) this.port.playOnce?.('door');
    }
  }

  /** How many times the door has fired this game (0–3) — tests/telemetry. */
  doorsFired(): number {
    return this.doorIndex;
  }

  /** The tracks the port currently has looping — exposed for tests/telemetry, not for control. */
  activeTracks(): readonly AudioTrack[] {
    return [...this.playing];
  }

  private set(patch: Partial<DirectorState>): void {
    this.state = { ...this.state, ...patch };
    this.reconcile();
  }

  /** The single source of truth: given the state, what SHOULD be sounding — then diff against what is. */
  private desired(): Set<AudioTrack> {
    const want = new Set<AudioTrack>();
    if (this.state.muted || !this.state.sceneActive) return want; // muted or off-scene → silence
    want.add('bed');
    if (this.state.generating) want.add('scratch');
    return want;
  }

  private reconcile(): void {
    const want = this.desired();
    for (const track of ['bed', 'scratch'] as const) {
      const shouldPlay = want.has(track);
      const isPlaying = this.playing.has(track);
      if (shouldPlay && !isPlaying) {
        this.playing.add(track);
        this.port.start(track);
      } else if (!shouldPlay && isPlaying) {
        this.playing.delete(track);
        this.port.stop(track);
      }
    }
    this.reconcileDetune();
  }

  /** Push the desired bed pitch to the port when it changed. The bed sags 1 → (1 − MAX_DETUNE) as
   *  composure breaks; while the bed is stopped the port holds no rate (bedRate = null) so the next start
   *  re-applies from scratch. */
  private reconcileDetune(): void {
    if (!this.playing.has('bed')) {
      this.bedRate = null;
      return;
    }
    const rate = 1 - MAX_DETUNE * this.state.composure;
    if (this.bedRate === rate) return;
    this.bedRate = rate;
    this.port.setRate?.('bed', rate);
  }
}

/** Deterministic door-milestone turns for a given budget — DOOR_FRACTIONS of the clock, forced strictly
 *  increasing so a small turn budget never collapses two doors onto one turn (they would stack). */
export function doorSchedule(turnLimit: number): readonly number[] {
  const out: number[] = [];
  for (const f of DOOR_FRACTIONS) {
    const at = Math.max(1, Math.ceil(turnLimit * f));
    out.push(out.length ? Math.max(at, out[out.length - 1] + 1) : at);
  }
  return out;
}
