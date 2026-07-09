import React from 'react';
import { View, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { proceduralRoom } from './roomBackdrop';

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

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
