import { z } from 'zod';
import type { Rating } from './types.js';

// The RATING call's constrained output (call 2 of the two-call turn). Tiny + flat + enums — the
// research's rule: hard schema constraint costs a small model accuracy ("constraint tax"), so keep the
// constrained call trivial (a few tokens) and let the VOICE call (call 1) run free. At runtime this is
// enforced by Apple `@Generable` (capable devices) or llama.cpp GBNF (`response_format: json_schema`).
//
// 2026-07-05 redesign (judge P1: manipulation won 3/4 scenarios): the payload carries NO numbers.
// A 3B cannot do calibrated arithmetic — it emitted +2 trust for any eloquent line — but it CAN pick
// one label from a small enum. The `approach` label is the whole mechanic; the engine maps it to
// trust/suspicion deltas in code.

const APPROACHES = ['offer', 'probe', 'flattery', 'bargain', 'demand', 'threat', 'filler'] as const;

export const RatingSchema = z.object({
  // Tone is flavour (drives the diegetic sprite), NOT the mechanic — so an off-enum tone from an
  // unconstrained model must NOT throw away the approach (the mechanic). Default it, keep the approach.
  // On-device GBNF/@Generable constrain it exactly; this leniency only matters for the cloud stand-in.
  tone: z.enum(['hostile', 'guarded', 'wary', 'softening', 'open']).catch('guarded'),
  // The approach IS the mechanic, so it stays strict: an off-enum label is an untrustworthy rating →
  // parse fails → the engine takes a neutral no-score turn (never guesses). Case is normalized first —
  // an unconstrained cloud model capitalizing "Probe" is still the same label.
  approach: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(APPROACHES)),
  // The referee's prose `note` was RETIRED (mandate #5): the character's persistent memory is now
  // engine-assembled from the player's actual disclosure (engine.ts extractDisclosure), not a model
  // sentence. The RATING call is a pure classifier again — tone + approach, nothing to author.
});

/** JSON Schema for constrained decoding (Apple @Generable / llama.cpp GBNF). Tiny + flat + enums — and
 *  since mandate #5 there is no free-text field at all, so the constrained output is fully enumerated. */
export const RATING_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tone', 'approach'],
  properties: {
    tone: { type: 'string', enum: ['hostile', 'guarded', 'wary', 'softening', 'open'] },
    approach: { type: 'string', enum: APPROACHES },
  },
} as const;

/**
 * Parse + validate the rating call's raw text into a Rating, or null if it can't be trusted.
 * Tolerant extraction (models wrap JSON in prose/fences on the odd turn) then strict zod. Null → the
 * engine treats it as a neutral no-op rating (no score change), never a crash.
 */
export function parseRating(raw: string): Rating | null {
  const candidate = extractJson(raw);
  if (candidate !== null) {
    try {
      const result = RatingSchema.safeParse(JSON.parse(candidate));
      if (result.success) return result.data;
    } catch {
      /* fall through to salvage */
    }
  }
  // Salvage a TRUNCATED rating: recover the mechanic (approach) + tone by regex even if the JSON never
  // closed — a small model can still overrun on the odd turn (e.g. a runaway tone). No approach readable
  // → nothing to trust. (The free-text `note` that used to truncate here is gone since mandate #5.)
  return salvageRating(raw);
}

/** Recover tone + approach from a rating whose JSON never closed. null if the approach can't be read —
 *  without it there is no mechanic to trust. */
function salvageRating(raw: string): Rating | null {
  const a = raw.match(new RegExp(`"approach"\\s*:\\s*"(${APPROACHES.join('|')})"`, 'i'));
  if (!a) return null;
  const toneMatch = raw.match(/"tone"\s*:\s*"(hostile|guarded|wary|softening|open)"/i);
  const partial = {
    tone: toneMatch ? toneMatch[1].toLowerCase() : 'guarded',
    approach: a[1],
  };
  const result = RatingSchema.safeParse(partial);
  return result.success ? result.data : null;
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const start = trimmed.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}
