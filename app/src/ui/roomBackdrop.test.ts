import { describe, expect, it } from 'vitest';
import { proceduralRoom, roomFigure, lighten, TAR, SILHOUETTE } from './roomBackdrop';

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

  it('keeps the accent SPARING yet READABLE — a dim wash that still tints over near-black tar (§2)', () => {
    // Upper bound: a wash, never a flat colour fill. Lower bound: strong enough to actually read — at 0.07
    // the desaturated ash-violet vanished over the tar and the fifth room looked like a generic grey box.
    expect(room.veil.opacity).toBeLessThan(0.15);
    expect(room.veil.opacity).toBeGreaterThanOrEqual(0.1);
  });

  it('gives DIFFERENT rooms different accents (the fifth door is distinct from the four)', () => {
    const oracle = proceduralRoom('#7fbf9f'); // a pale-phosphor-ish accent
    expect(oracle.veil.color).not.toBe(room.veil.color);
    expect(oracle.halos[0].color).not.toBe(room.halos[0].color);
  });

  it('is pure (same accent → same spec)', () => {
    expect(proceduralRoom('#7a6f95')).toEqual(proceduralRoom('#7a6f95'));
  });

  it('seats an OCCUPANT below the bulb — the fifth room is not an empty chair (§2 art direction)', () => {
    expect(room.figure.length).toBeGreaterThan(0);
  });
});

describe('roomFigure — the half-lit silhouette whose face is never resolved (§2)', () => {
  const fig = roomFigure('#7a6f95'); // the Occupant's ash-violet

  it('is layered BACK→FRONT: the accent rim aura first, then the dark masses drawn over it', () => {
    // The first layer is the rim (an accent lifted toward bone); the later layers are the dark silhouette.
    expect(fig[0].color).not.toBe(SILHOUETTE);
    expect(fig.slice(1).every((p) => p.color === SILHOUETTE)).toBe(true);
  });

  it('the mass is DARKER than the tar floor, so it reads as a silhouette occluding the glow (not lit against it)', () => {
    const hex = (c: string) => parseInt(c.replace('#', ''), 16);
    expect(hex(SILHOUETTE)).toBeLessThan(hex(TAR));
  });

  it('rim-lights the near edge from the accent, never a flat white (keeps the single accent reading, §2)', () => {
    expect(fig[0].color).toBe(lighten('#7a6f95', 0.5));
    expect(fig[0].color).not.toBe('#ffffff');
  });

  it('the rim aura is FAINT — a grazed edge, not a lit body (restraint, §3)', () => {
    expect(fig[0].opacity).toBeLessThan(0.2);
  });

  it('the dark masses are near-opaque — a solid figure, not a ghost (a faint glow still bleeds the edge)', () => {
    for (const p of fig.slice(1)) {
      expect(p.opacity).toBeGreaterThan(0.9);
      expect(p.opacity).toBeLessThan(1); // never a dead cut-out — the near edge keeps a whisper of the glow
    }
  });

  it('the head sits ABOVE the shoulders (a seated figure, not a heap) and every part rises from the floor', () => {
    const shoulders = fig[1];
    const head = fig[2];
    expect(head.bottomFactor).toBeGreaterThan(shoulders.bottomFactor); // the head is raised off the shoulders
    expect(shoulders.bottomFactor).toBe(0); // the shoulders rise out of the dark floor
    expect(head.widthFactor).toBeLessThan(shoulders.widthFactor); // a head, narrower than the shoulders
    // ATTACHED but EMERGENT: the head's base overlaps the shoulder crown (reads as connected, not floating),
    // yet its crown clears that crown by a clear margin — so the silhouette reads head-on-shoulders, not a
    // rounded lump. At the old bottomFactor 0.3 only ~0.045w emerged and the fifth room read as a mound.
    const shouldersTop = shoulders.bottomFactor + shoulders.heightFactor;
    const headTop = head.bottomFactor + head.heightFactor;
    expect(head.bottomFactor).toBeLessThan(shouldersTop); // base overlaps the shoulders (attached)
    expect(headTop).toBeGreaterThan(shouldersTop + 0.08); // crown clears them by a clear neck of emergence
  });

  it('draws NO face — the head is a featureless disc (radiusFactor 0.5), never any feature layer (Principle 3)', () => {
    const head = fig[2];
    expect(head.widthFactor).toBe(head.heightFactor); // square → a perfect disc at radiusFactor 0.5
    expect(head.radiusFactor).toBe(0.5);
    // Restraint invariant: the figure is ONLY the rim + two dark masses — no eyes, no mouth, no feature part.
    expect(fig.length).toBe(3);
  });

  it('is pure (same accent → same figure)', () => {
    expect(roomFigure('#7a6f95')).toEqual(roomFigure('#7a6f95'));
  });
});
