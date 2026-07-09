import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { proceduralRoom } from './roomBackdrop';
import { swayAmplitude } from './bulbSway';

// THE PROCEDURAL ROOM (director mandate #3) — the View-composed half of roomBackdrop.ts. Renders a
// scenario-accent chiaroscuro (tar floor + a dim full-frame accent veil + a single hanging bulb of
// concentric halos) for a room that has no painted master yet (the Prior Occupant). No image, no gradient
// primitive — layered Views only, so it renders the same on the web export the visual-truth harness shoots
// and on device. Presentation only: it sits UNDER the UI on the tar floor exactly where the painted
// masters do (the caller passes the same absoluteFill + dim-opacity style), and never touches play.

export function RoomBackdrop({ accent, style }: { accent: string; style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const spec = proceduralRoom(accent);
  return (
    <View style={[styles.fill, { backgroundColor: spec.base }, style]} pointerEvents="none">
      {/* The full-frame accent veil — the whole chamber reads in the mind's hue, sparingly. */}
      <View style={[styles.fill, { backgroundColor: spec.veil.color, opacity: spec.veil.opacity }]} />
      {/* The single hanging bulb: concentric halos high-centre, wide+faint out to tight+bright, the light
          falling from the top so the room goes dark below (chiaroscuro; §2 "a single hanging bulb"). */}
      {spec.halos.map((h, i) => {
        const d = width * h.sizeFactor;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: d,
              height: d,
              borderRadius: d / 2,
              top: -d * 0.34, // the bulb hangs just above the top edge; its glow spills down into the room
              left: (width - d) / 2,
              backgroundColor: h.color,
              opacity: h.opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── THE BULB SWAY (bible §2 "the bulb sways ~2px when Composure breaks"; director mandate 1) ─────────
//
// The room's ONE motion, and the sensory TWIN of the audio detune. `SwayingBackdrop` wraps the scene's
// backdrop (the painted master OR the procedural room — one impl for all five chambers) in an Animated
// translate so the WHOLE room — the bulb, its cast halos, the lit-plaster pool, the shadow it throws —
// drifts together as one light source flinching, never a floating icon. Driven off `composure` ONLY (the
// composureBreak signal App also feeds the audio detune — one source of truth, never Grip/chrome, §5).
//
// The AMPLITUDE is composure-driven + reproducible (swayAmplitude, stepped bands ≤ MAX_SWAY_PX); the
// PHASE is a slow pendulum on a clock (a drift, not a jitter — §3 restraint). translateX = phase × amp:
//   - phase oscillates −1 → +1 → −1 forever on an ease-in-out sine, ~2.2s each way (a hanging bulb's
//     unhurried swing), so its onset/period carry no randomness (§1 no jump scares, deterministic);
//   - amp animates toward the current band over ~0.7s, so a composure step widens the swing smoothly.
// FROZEN (the visual-truth screenshot harness): a still capture can't show an animation, so `frozen` pins
// the transform to the STATIC max deflection (phase +1 × amp) — the "max deflection vs rest frame" shot
// the mandate asks for (?harness=duel-sway broken vs ?harness=duel composed-and-still). useNativeDriver is
// false so the translate renders identically on the web export the harness shoots and on device.

export function SwayingBackdrop({
  composure,
  withdrawal = 0,
  frozen = false,
  style,
  children,
}: {
  /** The composure-break signal 0 (calm) → 1 (unravelled) — the SAME reading that drives the audio detune. */
  readonly composure: number;
  /** THE ROOM WITHDRAWS ITS MOTION (mandate #2) — 0 (engaged) → 1 (fully withdrawn), off the engine's filler
   *  streak (ui/roomWithdrawal). It DAMPENS the composure sway toward zero: on a sustained filler streak the
   *  bulb goes inert (the room pulls its one motion away from a seeker who gives it nothing, Principle 4),
   *  reversing instantly when the streak resets. Off (0) → the sway is the pure composure reading. */
  readonly withdrawal?: number;
  /** Screenshot harness: pin the transform to the static max deflection instead of animating (still capture). */
  readonly frozen?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
}) {
  // The composure sway, DAMPENED by the room's withdrawal: as the room disengages on a sustained filler
  // streak the pendulum stills toward zero, so the light itself stops moving for a seeker who spends nothing.
  const damp = 1 - Math.max(0, Math.min(1, Number.isFinite(withdrawal) ? withdrawal : 0));
  const amp = swayAmplitude(composure) * damp;
  const phase = useRef(new Animated.Value(0)).current; // the pendulum, −1 → +1
  const ampV = useRef(new Animated.Value(amp)).current; // the deflection, eased toward the current band

  // The slow pendulum — a continuous −1→+1→−1 drift. Runs for the component's life (never on the frozen
  // screenshot path). Deterministic: fixed period, no random onset.
  useEffect(() => {
    if (frozen) return;
    const swing = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(phase, { toValue: -1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    swing.start();
    return () => swing.stop();
  }, [frozen, phase]);

  // Ease the amplitude toward the composure band, so a step (still → drift → widen → break) glides in
  // rather than snapping — the descent felt, not flickered.
  useEffect(() => {
    if (frozen) return;
    const a = Animated.timing(ampV, { toValue: amp, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [amp, frozen, ampV]);

  const translateX = frozen ? amp : Animated.multiply(phase, ampV);
  return (
    <Animated.View style={[styles.fill, { transform: [{ translateX }] }, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
