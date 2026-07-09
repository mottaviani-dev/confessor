// THE STUDIO SIGNATURE — native wiring (bible §5). The truth (fire-once, mute-safe) lives in
// studioSignature.ts; this is the thin adapter that gives it a real mouth on device and a silent one on
// the web export (the screenshot harness) — mirroring useAudioDirector's SCENE_PORT web guard.
//
// The signature is a ONE-SHOT played once per launch on the studio splash, so a single StudioSignature is
// held at MODULE level (not per-mount): a remounted boot screen re-calls playStudioSignature() but the
// latch guarantees the sound fires exactly once. The native player is built lazily on first play so a
// failed audio load never breaks boot — the studio moment is never on the critical path.

import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { StudioSignature, SILENT_ONESHOT, STUDIO_SIGNATURE_VOLUME, type OneShotPort } from './studioSignature';
import { devlog } from '../llm/devlog';
import signatureWav from '../../assets/audio/studio-signature.wav';

/** The native one-shot mouth: one expo-audio player for the signature, built lazily and reused. Never
 *  throws — a dead channel routes to the devlog and the splash stays silent, it never breaks boot. */
function nativeOneShot(): OneShotPort {
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  return {
    playOnce: () => {
      try {
        if (!player) {
          player = createAudioPlayer(signatureWav);
          player.volume = STUDIO_SIGNATURE_VOLUME;
        }
        player.seekTo(0); // rewind so the one-shot plays from its start
        player.play();
      } catch (err) {
        devlog('[audio] studio signature failed', err);
      }
    },
  };
}

// One studio signature for the app's lifetime — silent on web (the screenshot harness), native on device.
const STUDIO_SIGNATURE = new StudioSignature(Platform.OS === 'web' ? SILENT_ONESHOT : nativeOneShot());

/** Sound the studio signature — once per launch (the latch makes repeat calls no-ops). Called from the
 *  first-run "remembering" splash (App.tsx Boot). */
export function playStudioSignature(): void {
  STUDIO_SIGNATURE.play();
}
