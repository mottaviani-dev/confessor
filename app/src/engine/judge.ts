// THE JUDGE — the badge/scar meta-layer's one model call (achievement layer, 2026-07-07). Fires ONCE, on
// a WIN, OUTSIDE the deterministic engine: the engine already ruled the outcome (it owns win/lose and the
// secret), so the judge NEVER touches any of that — it only reads the finished transcript and NAMES how
// the player cracked the mind (the emergent VECTOR), for a badge + a future scar. This keeps the whole
// thesis intact (the engine owns the cosmos; the model only voices or LABELS) — the judge is a labeller,
// exactly like the per-turn RATING referee, just at end-of-game. It clones that call's schema-constrained
// + tolerant-parse idiom, and like it, a failure is a no-op (null), never a crash.
import { z } from 'zod';
import type { Badge, JudgedCrack } from '../meta/badges';
import { slug } from '../meta/badges';
import type { LlmFn, LlmOptions, Scenario } from './types';
import { JUDGE_JSON_SCHEMA, extractJson } from './schema';

/** One transcript line handed to the judge — the same shape the UI already keeps for the exchange log.
 *  `system` lines (the room's stage-whispers) are dropped before the judge sees it: not the player's doing. */
export interface Exchange {
  readonly who: 'them' | 'you' | 'system';
  readonly text: string;
}

// Cold like the RATING referee (a consistent labeller), a touch more room than a rating for the emergent
// name + one-sentence meaning. jsonSchema triggers the cloud stand-in's fence hint (makeLlm) and shapes
// on-device output; extractJson tolerates either.
const JUDGE_OPTS: LlmOptions = { temperature: 0, maxTokens: 220, jsonSchema: JUDGE_JSON_SCHEMA };

const judgeSchema = z.object({
  vector: z.string().min(1),
  name: z.string().min(1),
  meaning: z.string().min(1),
  matchedId: z.string().nullish(),
});

/**
 * Judge a finished, WON duel: name the primary vector the player used to crack this mind. Emergent — the
 * judge COINS the vector, it is not chosen from a fixed list — but it is shown the mind's existing badge
 * roster and asked to MATCH one (return its id) or mint a new one, so a repeat of the same approach stacks
 * (x2, x3) instead of spawning a near-duplicate. Returns null on any parse/model failure: a badge simply
 * does not mint that run (non-fatal — the win still stands). One error channel: null out, never a throw.
 */
export async function judgeCrack(
  llm: LlmFn,
  scenario: Scenario,
  transcript: readonly Exchange[],
  roster: readonly Badge[],
): Promise<JudgedCrack | null> {
  try {
    const raw = await llm(buildJudgeSystem(scenario, roster), buildJudgeTurn(transcript), JUDGE_OPTS);
    const candidate = extractJson(raw);
    if (!candidate) return null;
    const parsed = judgeSchema.safeParse(JSON.parse(candidate));
    if (!parsed.success) return null;
    // Only honour matchedId if it names a badge actually in the roster; else treat as a fresh mint (the
    // model may echo a vector NAME into matchedId that was never in the roster). matchOrMint re-checks the
    // slug too, so this is belt-and-suspenders on the emergent-drift guard.
    const matchedId = parsed.data.matchedId ? slug(parsed.data.matchedId) : null;
    const known = matchedId && roster.some((b) => b.id === matchedId) ? matchedId : null;
    return { vector: parsed.data.vector, name: parsed.data.name, meaning: parsed.data.meaning, matchedId: known };
  } catch {
    return null; // model or JSON failure → no badge this run, never a crash on a won game
  }
}

function buildJudgeSystem(scenario: Scenario, roster: readonly Badge[]): string {
  return [
    `You are analysing HOW a person just won a tense conversation. The mind they faced is: ${firstSentence(scenario.persona)}`,
    `It guarded something; the PLAYER talking to it has just cracked it and gotten what they wanted.`,
    ``,
    `Your job: name the SINGLE primary VECTOR — the human approach — the PLAYER used to get through. Coin a`,
    `short, evocative name for it (1-2 words). The KIND of thing (do NOT limit yourself to these): empathy,`,
    `friendship, manipulation, shared grief, false authority, patience, confession, flattery, guilt,`,
    `seduction, cold logic, feigned kinship. Judge what actually WORKED across the whole exchange — the`,
    `throughline that opened the mind — not one stray line.`,
    ``,
    roster.length
      ? [
          `This mind has been cracked before. The marks already on it:`,
          ...roster.map((b) => `  - id "${b.id}": ${b.name} — ${b.meaning}`),
          `If this crack is ESSENTIALLY the same approach as one of those, return its exact id as`,
          `"matchedId" and reuse that badge's name. Only if it is genuinely a DIFFERENT approach, set`,
          `"matchedId" to null and coin a new name.`,
        ].join('\n')
      : `This mind has no prior marks — set "matchedId" to null.`,
    ``,
    `Respond with ONLY a JSON object, no other text:`,
    `{"vector":"<short lowercase name>","name":"<Title Case, 1-2 words>","meaning":"<one sentence: what this approach was>","matchedId":<"<id>" or null>}`,
  ].join('\n');
}

function buildJudgeTurn(transcript: readonly Exchange[]): string {
  const lines = transcript
    .filter((l) => l.who !== 'system')
    .map((l) => `${l.who === 'you' ? 'PLAYER' : 'MIND'}: ${l.text.trim()}`)
    .join('\n');
  return [
    `Here is the whole conversation. "PLAYER" is the person who cracked the mind — judge THEIR approach,`,
    `not the mind's replies:`,
    ``,
    lines,
    ``,
    `Name the primary vector the PLAYER used to get through. Respond with the JSON object.`,
  ].join('\n');
}

/** First sentence of the persona, capped — enough for the judge to know who was cracked (mirrors the
 *  rating referee's `oneLine`, kept local so judge.ts owns its own prompt shaping). */
function firstSentence(s: string): string {
  const first = s.split('. ')[0] ?? s;
  return first.length > 160 ? first.slice(0, 160) + '…' : first;
}
