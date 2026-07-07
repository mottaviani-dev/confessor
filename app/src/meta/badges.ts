// THE BADGES — the meta-game's scar record (achievement layer, 2026-07-07). When a mind is CRACKED, an
// LLM judge (engine/judge.ts) names the VECTOR the player used — emergent, coined per run, NEVER a fixed
// list. This module is the PURE half: it turns a judged vector into a FROZEN badge (minted once, then only
// its count grows), dedups a repeated vector into an x2/x3 stack, and derives the persona's "wound" prose
// from the badges it carries. No I/O, no model — unit-testable, like the rest of meta/. Persisted per-mind
// in the ledger (per player, on-device — one device is one player).
//
// DESIGN INVARIANT (mirrors the engine's own): a scar ARMORS a vector, it NEVER rewrites WHO the mind is.
// The wound prose only hardens the VOICE's register against a way the mind has already been reached; the
// engine's scoring (APPROACH_EFFECTS) is blind to it, so a genuine `offer` still wins every mind — scars
// make a mind colder to a repeated trick, never unwinnable. Identity is the persona; the scar is a guard
// laid over it. Bounded by MAX_BADGES so the derived prose can never bloat the prompt (the memory ceiling).
import { z } from 'zod';

/** A crack the judge classified — the raw material a badge is minted from (engine/judge.ts output). */
export interface JudgedCrack {
  /** Emergent vector name the judge coined (e.g. "empathy", "false-authority"). Slugged into the id. */
  readonly vector: string;
  /** Display name, 1-2 words Title Case. */
  readonly name: string;
  /** One sentence: what this way of cracking the mind WAS. */
  readonly meaning: string;
  /** The id of an existing badge this crack matches (the judge was shown the roster), or null to mint. */
  readonly matchedId?: string | null;
}

/** A minted badge. FROZEN at birth — id/name/meaning/color/glyph never change; only `count` grows on a
 *  repeat of the same vector (the x2, x3 stack). Stored per-mind in the ledger. */
export interface Badge {
  readonly id: string;
  readonly name: string;
  readonly meaning: string;
  readonly color: string;
  readonly glyph: string;
  readonly count: number;
}

/** Storage is a trust boundary (ledger.ts parses through zod) — the badge shape validates on the way in. */
export const badgeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  meaning: z.string(),
  color: z.string(),
  glyph: z.string(),
  count: z.number().int().positive(),
});

/** Cap on distinct scars per mind — bounds both the roster and the derived wound prose so the scar block
 *  can never bloat the VOICE prompt (the same discipline as the engine's MAX_FACTS: a scar is a mark, not
 *  a log). Oldest scar drops when a ninth distinct vector lands. */
export const MAX_BADGES = 8;

// House-doctrine glyphs + palette (ART_DIRECTION.md: etch / single-light / aperture). MONOCHROME Unicode
// sigils that read as engraved marks — deliberately NOT colour emoji, which would shatter the monochrome
// plate. The colours are the desaturated scenario-accent family (verdigris / brass / umber / phosphor /
// bone / sodium / ash-teal / dried-blood). Both are chosen deterministically from the vector's slug, then
// frozen into the badge — so the same vector always wears the same mark, but distinct vectors read apart.
const GLYPHS = ['◉', '◈', '⟡', '✶', '⌖', '⍟', '☍', '⏣'] as const;
const COLORS = ['#5c9e8f', '#b08d57', '#9e6b5c', '#a9b86a', '#b3a892', '#c8923f', '#6f8f8a', '#8f5a52'] as const;

/** Vector name → stable id: lowercase, non-alphanumeric runs collapsed to single hyphens, ends trimmed. */
export function slug(vector: string): string {
  return vector.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Deterministic small hash (djb2) so a badge's glyph/colour is a pure function of its id — stable across
 *  reloads even before the value is frozen into the stored badge. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(arr: readonly T[], id: string, salt: number): T {
  return arr[(hash(id) + salt) % arr.length];
}

/** How many etched medallion FRAMES the badge art pool holds (`app/assets/badges/frame-{0..N-1}.jpg` —
 *  Leonardo-generated, house-style: single-light aperture seals). The frame is chosen deterministically
 *  from the badge id (like the glyph + colour), so a badge always wears the same medallion; the RN layer
 *  composites the accent glyph in its hollow centre. Kept here (pure — count + picker only); the image
 *  imports live in App.tsx, so badges.ts stays free of any React-Native dependency. */
export const FRAME_COUNT = 3;
export function frameIndex(id: string): number {
  return (hash(id) + 5) % FRAME_COUNT;
}

/** Mint a brand-new frozen badge from a judged crack. glyph+colour derive from the id (deterministic), so
 *  the same vector always looks the same; count starts at 1. Name/meaning are length-capped for the UI. */
function mint(judged: JudgedCrack): Badge {
  const id = slug(judged.vector) || 'unnamed';
  return {
    id,
    name: judged.name.trim().slice(0, 24) || judged.vector.trim().slice(0, 24) || 'A mark',
    meaning: judged.meaning.trim().slice(0, 120),
    color: pick(COLORS, id, 0),
    glyph: pick(GLYPHS, id, 3),
    count: 1,
  };
}

/**
 * Fold a judged crack into a mind's badge roster (pure). MATCH-OR-MINT: if the judge matched an existing
 * badge by id — or the vector slugs to one already present — bump that badge's count (x2, x3…); else mint
 * a new frozen badge. Deduping on the SLUG (not only the judge's matchedId) is the emergent-drift guard:
 * a judge that coins "compassion" one run and "empathy" the next would never stack, so identical slugs
 * collapse regardless of what matchedId said. Roster capped at MAX_BADGES (oldest distinct vector dropped).
 */
export function matchOrMint(
  roster: readonly Badge[],
  judged: JudgedCrack,
): { roster: Badge[]; badge: Badge; minted: boolean } {
  const wantId = judged.matchedId ? slug(judged.matchedId) : '';
  const vecId = slug(judged.vector);
  const existing = (wantId && roster.find((b) => b.id === wantId)) || roster.find((b) => b.id === vecId);
  if (existing) {
    const bumped: Badge = { ...existing, count: existing.count + 1 };
    return { roster: roster.map((b) => (b.id === existing.id ? bumped : b)), badge: bumped, minted: false };
  }
  const badge = mint(judged);
  return { roster: [...roster, badge].slice(-MAX_BADGES), badge, minted: true };
}

/**
 * Derive the persona's WOUND prose from the badges it carries (pure) — the scar block injected into the
 * VOICE system prompt (engine/prompt.ts appends it after `voiceStyle`). ONE compact block regardless of
 * counts, so it can never bloat the prompt: it lists the distinct vectors the mind has been cracked by
 * (its badge roster — already deduped + capped) and orders the voice to harden its REGISTER against them
 * WITHOUT changing WHO it is. Empty roster → undefined (no scar section; a fresh mind reads as authored).
 */
export function renderWound(badges: readonly Badge[]): string | undefined {
  if (!badges.length) return undefined;
  return [
    `# The marks left on you (never speak of this — it lives in HOW you answer, not WHAT you say)`,
    `You have been reached before, and some part of you remembers how. A guard has grown over each way in`,
    `— those approaches no longer move you as they first did; met the same way again, you feel the worn`,
    `shape of it coming and you answer a shade colder, slower, more closed than they intend. This hardening`,
    `is real but NARROW: your core — who you are, what you guard, and the one honest currency that can`,
    `still reach you — is UNCHANGED. Only your guard against these worn paths has thickened:`,
    ...badges.map(
      (b) => `- ${b.name.toLowerCase()}${b.count > 1 ? ` — tried on you ${b.count} times now; you are tired of it` : ''}`,
    ),
  ].join('\n');
}
