import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { apertureSpec } from './aperture';

// THE STUDIO APERTURE (bible §5) — the View-composed half of aperture.ts. A thin double-line bone frame
// (a mimeograph stamp) around two door leaves in shadow, split by a vertical sliver of pure black with
// amber light leaking at its edges — the studio's connective mark, "one black opening you never pass
// through." On the first-launch download the sliver WIDENS with progress: the mind being remembered onto
// the device is the door coming ajar (Principle 6), not a floating progress spinner (§5 forbids floating
// game-chrome). No image, no gradient, no SVG — layered Views + percentage widths only (see roomBackdrop),
// so it renders the same on the web export the visual-truth harness shoots and on device. Presentation
// only; never touches play.

export function StudioAperture({
  progress,
  lit = true,
  width = 120,
  height = 176,
  style,
}: {
  /** Load progress in [0,1], or null for an indeterminate phase (rests barely ajar). */
  progress: number | null;
  /** false on a failed load — the amber light behind the door goes out. */
  lit?: boolean;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = apertureSpec(progress, lit);
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      {/* Outer rule + the double-line gap. */}
      <View
        style={{
          flex: 1,
          borderWidth: spec.frame.widthPx,
          borderColor: spec.frame.color,
          padding: spec.frame.gapPx,
          backgroundColor: spec.base,
        }}
      >
        {/* Inner rule wraps the door leaves; the leaves are the door in shadow, the sliver splits them. */}
        <View
          style={{
            flex: 1,
            borderWidth: spec.frame.widthPx,
            borderColor: spec.frame.color,
            backgroundColor: spec.door,
            flexDirection: 'row',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* The void between the leaves — pure black, widening with progress. */}
          <View style={{ width: `${spec.sliver.widthFactor * 100}%`, height: '100%', backgroundColor: spec.sliver.color }}>
            {spec.leak && (
              <>
                {/* Amber light leaking at each vertical edge of the sliver — the only colour (§2). */}
                <View style={[styles.leakEdge, { left: 0, width: spec.leak.widthPx, backgroundColor: spec.leak.color, opacity: spec.leak.opacity }]} />
                <View style={[styles.leakEdge, { right: 0, width: spec.leak.widthPx, backgroundColor: spec.leak.color, opacity: spec.leak.opacity }]} />
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leakEdge: { position: 'absolute', top: 0, bottom: 0 },
});
