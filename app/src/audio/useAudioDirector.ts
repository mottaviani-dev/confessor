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
import roomToneWav from '../../assets/audio/room-tone.wav';
import penScratchWav from '../../assets/audio/pen-scratch.wav';
import doorWav from '../../assets/audio/door.wav';

// Static asset ids (Metro requires literal imports) keyed by track — fed to the native factory below.
const TRACK_SOURCE = { bed: roomToneWav, scratch: penScratchWav, door: doorWav } as const;

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
  /** Advance the code-owned door schedule to this turn — the door behind the chair fires on milestones,
   *  three times per full game (mandate #2). */
  markTurn: (turn: number, turnLimit: number) => void;
};

/** Owns one AudioDirector for the mounted scene. Bed on mount → silence on unmount; scratch bracketed to
 *  the generation await. Drives the shared native SCENE_PORT so the room is audible on device. */
export function useAudioDirector(): SceneAudio {
  const [muted, setMutedState] = useState(MUTED);
  // One director per scene mount. Built lazily so the ref holds a stable instance across renders.
  const ref = useRef<AudioDirector | null>(null);
  if (ref.current === null) ref.current = new AudioDirector(SCENE_PORT, { muted: MUTED });

  useEffect(() => {
    const dir = ref.current!;
    dir.enterScene();
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
    markTurn: (turn: number, turnLimit: number) => ref.current!.markTurn(turn, turnLimit),
  };
}
