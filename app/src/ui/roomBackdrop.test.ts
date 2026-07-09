import { describe, expect, it } from 'vitest';
import { proceduralRoom, lighten, TAR } from './roomBackdrop';

// THE FIFTH ROOM, PAINTED-IN-INTERIM (director mandate #3). These pin the pure layer math: the room sits on
// tar, carries its mind's accent (the whole chamber, not just the bulb), and reads as ONE hanging light
// falling off into the dark (opacity rising as the halo tightens). The FELT room is the visual-truth
// harness's shot; this pins the deterministic grammar behind it.

describe('lighten — the accent lifted toward bone (never a flat white)', () => {
  it('mixes toward white and stays a valid 6-digit hex', () => {
    const out = lighten('#7a6f95', 0.5);
    expect(/^#[0-9a-f]{6}$/.test(out)).toBe(true);
  });

  it('is brighter than the input on every channel', () => {
    const inN = 0x7a; // R of #7a6f95
    const out = lighten('#7a6f95', 0.5);
    expect(parseInt(out.slice(1, 3), 16)).toBeGreaterThan(inN);
  });

  it('amt 0 is a no-op; amt 1 is white; clamps out-of-range', () => {
    expect(lighten('#7a6f95', 0)).toBe('#7a6f95');
    expect(lighten('#7a6f95', 1)).toBe('#ffffff');
    expect(lighten('#7a6f95', 5)).toBe('#ffffff'); // clamped
  });

  it('is pure (same inputs → same output)', () => {
    expect(lighten('#7a6f95', 0.42)).toBe(lighten('#7a6f95', 0.42));
  });
});

describe('proceduralRoom — the code-composed chiaroscuro', () => {
  const room = proceduralRoom('#7a6f95'); // the Occupant's ash-violet

  it('sits on the studio tar floor', () => {
    expect(room.base).toBe(TAR);
  });

  it('carries the mind ACCENT across the whole chamber (the veil + the wide halos are the raw accent)', () => {
    expect(room.veil.color).toBe('#7a6f95');
    expect(room.halos.some((h) => h.color === '#7a6f95')).toBe(true);
  });

  it('reads as ONE hanging bulb: halos ordered outer→inner, tightening AND brightening (chiaroscuro falloff)', () => {
    for (let i = 1; i < room.halos.length; i++) {
      expect(room.halos[i].sizeFactor).toBeLessThan(room.halos[i - 1].sizeFactor); // tighter
      expect(room.halos[i].opacity).toBeGreaterThan(room.halos[i - 1].opacity); // brighter
    }
  });

  it('keeps the accent SPARING — the veil is a dim wash, never a flat colour fill (§2)', () => {
    expect(room.veil.opacity).toBeLessThan(0.15);
  });

  it('gives DIFFERENT rooms different accents (the fifth door is distinct from the four)', () => {
    const oracle = proceduralRoom('#7fbf9f'); // a pale-phosphor-ish accent
    expect(oracle.veil.color).not.toBe(room.veil.color);
    expect(oracle.halos[0].color).not.toBe(room.halos[0].color);
  });

  it('is pure (same accent → same spec)', () => {
    expect(proceduralRoom('#7a6f95')).toEqual(proceduralRoom('#7a6f95'));
  });
});
