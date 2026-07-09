import { describe, expect, it } from 'vitest';
import {
  apertureSpec,
  APERTURE_AMBER,
  APERTURE_BONE,
  APERTURE_TAR,
  APERTURE_VOID,
  SLIVER_MAX,
  SLIVER_REST,
} from './aperture';

describe('apertureSpec — the studio aperture geometry (bible §5)', () => {
  it('rests barely ajar with an indeterminate phase (null progress)', () => {
    const s = apertureSpec(null);
    expect(s.sliver.widthFactor).toBe(SLIVER_REST);
    // Still lit (amber) when merely indeterminate — the light is on, the number just isn't known.
    expect(s.leak?.color).toBe(APERTURE_AMBER);
  });

  it('opens from rest toward the max as progress rises — monotonic, never a full opening (§5)', () => {
    const zero = apertureSpec(0).sliver.widthFactor;
    const half = apertureSpec(0.5).sliver.widthFactor;
    const full = apertureSpec(1).sliver.widthFactor;
    expect(zero).toBe(SLIVER_REST);
    expect(half).toBeGreaterThan(zero);
    expect(full).toBeGreaterThan(half);
    expect(full).toBe(SLIVER_MAX);
    // It stays a SLIVER you never pass through — the void never fills the frame.
    expect(SLIVER_MAX).toBeLessThan(0.5);
  });

  it('clamps progress out of [0,1]', () => {
    expect(apertureSpec(-3).sliver.widthFactor).toBe(SLIVER_REST);
    expect(apertureSpec(9).sliver.widthFactor).toBe(SLIVER_MAX);
  });

  it('brightens the amber leak as the door opens', () => {
    expect(apertureSpec(1).leak!.opacity).toBeGreaterThan(apertureSpec(0).leak!.opacity);
  });

  it('goes dark on a failed load — the light behind the door is out (no amber)', () => {
    expect(apertureSpec(0.4, false).leak).toBeNull();
    // The sliver geometry is unchanged; only the light dies.
    expect(apertureSpec(0.4, false).sliver.widthFactor).toBe(apertureSpec(0.4, true).sliver.widthFactor);
  });

  it('holds the studio palette — bone frame, tar ground, pure-black void, amber-only light (§2/§5)', () => {
    const s = apertureSpec(0.5);
    expect(s.base).toBe(APERTURE_TAR);
    expect(s.frame.color).toBe(APERTURE_BONE);
    expect(s.sliver.color).toBe(APERTURE_VOID);
    expect(s.leak!.color).toBe(APERTURE_AMBER);
    // The frame is a DOUBLE line (a rule + a gap) — the mimeograph stamp (§2).
    expect(s.frame.gapPx).toBeGreaterThan(0);
    expect(s.frame.widthPx).toBeGreaterThan(0);
  });
});
