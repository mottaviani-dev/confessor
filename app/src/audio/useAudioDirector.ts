// THE SCENE-AUDIO HOOK — binds the code-owned AudioDirector to the React scene lifecycle (mandate #3).
//
// The director (director.ts) already owns the TRUTH of what should be sounding; this hook is the wiring
// that feeds it the real turn lifecycle: the room-tone bed starts when a duel mounts and stops when it
// unmounts, and the pen-scratch latency mask runs for exactly the model-generation window. The mute
// choice lives module-level so it survives leaving one mind and entering another (mirrors App.tsx's
// SEAM_LOG).
//
// The port is now the real native adapter (mandate #1 — the residual is closed): on device it drives
// expo-audio's looping players; on web (the screenshot harness) it stays SILENT_PORT. Game audio plays
// UNDER the iOS hardware silent switch (`playsInSilentMode: true`): honoring the switch read as "the
// game has no sound at all" in playtest (2026-07-06) because the switch is on in most pockets — the
// ringer switch governs notifications, a game governs itself. Opting out of the room is the in-app
// SOUND/MUTED toggle's job (the director's own `setMuted`).

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AudioDirector, SILENT_PORT, type AudioPort } from './director';
import { createNativeAudioPort } from './nativeAudioPort';
import type { InstrumentVoice } from '../engine/types';
import roomToneWav from '../../assets/audio/room-tone.wav';
import penScratchWav from '../../assets/audio/pen-scratch.wav';
import doorWav from '../../assets/audio/door.wav';
import bowedWav from '../../assets/audio/instrument-bowed.wav';
import musicboxWav from '../../assets/audio/instrument-musicbox.wav';
import breathWav from '../../assets/audio/instrument-breath.wav';
import choirWav from '../../assets/audio/instrument-choir.wav';
import wireWav from '../../assets/audio/instrument-wire.wav';

// Static asset ids (Metro requires literal imports) keyed by track — fed to the native factory below. The
// five instruments are the per-scenario voices (bible §2 "Audio"), one layered under the bed per mind.
const TRACK_SOURCE = {
  bed: roomToneWav,
  scratch: penScratchWav,
  door: doorWav,
  bowed: bowedWav,
  musicbox: musicboxWav,
  breath: breathWav,
  choir: choirWav,
  wire: wireWav,
} as const;

/** The room's sound is native on device, silent on the web export the screenshot harness renders (and
 *  the correct fallback anywhere expo-audio can't load). Built once and shared across scene mounts — the
 *  native port caches one looping player per track for the app's lifetime. */
const SCENE_PORT: AudioPort =
  Platform.OS === 'web'
    ? SILENT_PORT
    : createNativeAudioPort((track) => createAudioPlayer(TRACK_SOURCE[track]));

// Game-audio mode, once at module load (device only): play under the hardware silent switch. Best-effort
// — if the call fails the app still runs, just back under the switch's rule.
if (Platform.OS !== 'web') {
  void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
}

// Player's mute choice, persisted across scene remounts (a re-pick remounts the Duel). Module-level, like
// SEAM_LOG — on-disk persistence across app restarts (AsyncStorage) is a separate residual.
let MUTED = false;

export type SceneAudio = {
  muted: boolean;
  /** Toggle mute; silences/restores everything immediately and persists the choice for the next scene. */
  toggleMute: () => void;
  /** A model call fired — begin the pen-scratch transcription mask. */
  onGenerationStart: () => void;
  /** First text arrived (or the call failed) — stop the scratch. Idempotent. */
  onGenerationEnd: () => void;
  /** Update the composure-break level (0 calm → 1 unravelled) — the room-tone bed detunes as it rises
   *  (mandate #2). The scene computes it from the engine's meters. */
  setComposure: (level: number) => void;
  /** Update the room's withdrawal level (0 engaged → 1 fully withdrawn) — on a sustained filler streak the
   *  room pulls the mind's instrument to the bare bed (mandate #2, the sonic twin of the bulb stilling). The
   *  scene computes it from the engine's filler streak (ui/roomWithdrawal); reverses on the next positive beat. */
  setWithdrawal: (level: number) => void;
  /** Advance the code-owned door schedule to this turn — the door behind the chair fires on milestones,
   *  three times per full game (mandate #2). */
  markTurn: (turn: number, turnLimit: number) => void;
};

/** Owns one AudioDirector for the mounted scene. Bed + the mind's instrument on mount → silence on unmount;
 *  scratch bracketed to the generation await. Drives the shared native SCENE_PORT so the room is audible on
 *  device. `instrument` is the playing scenario's per-mind voice (bible §2); the Duel remounts per scenario
 *  (keyed), so it is stable for this mount. */
export function useAudioDirector(instrument?: InstrumentVoice): SceneAudio {
  const [muted, setMutedState] = useState(MUTED);
  // One director per scene mount. Built lazily so the ref holds a stable instance across renders.
  const ref = useRef<AudioDirector | null>(null);
  if (ref.current === null) ref.current = new AudioDirector(SCENE_PORT, { muted: MUTED });
  // The instrument is fixed for this mount; hold it in a ref so the mount effect reads the current value
  // without listing it as a dependency (a scenario change remounts the Duel, rebuilding this hook fresh).
  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;

  useEffect(() => {
    const dir = ref.current!;
    dir.enterScene(instrumentRef.current);
    return () => dir.leaveScene();
  }, []);

  return {
    muted,
    toggleMute: () => {
      MUTED = !MUTED;
      ref.current!.setMuted(MUTED);
      setMutedState(MUTED);
    },
    onGenerationStart: () => ref.current!.generationStarted(),
    onGenerationEnd: () => ref.current!.generationEnded(),
    setComposure: (level: number) => ref.current!.setComposure(level),
    setWithdrawal: (level: number) => ref.current!.setWithdrawal(level),
    markTurn: (turn: number, turnLimit: number) => ref.current!.markTurn(turn, turnLimit),
  };
}
