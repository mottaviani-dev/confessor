// THE LEDGER — the meta-game record (gamification spec 2026-07-06): per mind, has it been cracked and
// how fast. Pure logic here; AsyncStorage adapter in ledgerStore.ts. Storage is a trust boundary, so
// deserialization goes through zod — corrupt or legacy data degrades to an empty ledger, never a crash.
import { z } from 'zod';

const entrySchema = z.object({
  attempts: z.number().int().nonnegative(),
  cracked: z.boolean(),
  bestTurns: z.number().int().positive().nullable(),
});
const ledgerSchema = z.record(z.string(), entrySchema);

export type LedgerEntry = z.infer<typeof entrySchema>;
export type Ledger = z.infer<typeof ledgerSchema>;

export function emptyLedger(): Ledger {
  return {};
}

export function recordResult(ledger: Ledger, scenarioId: string, outcome: 'won' | 'lost', turns: number): Ledger {
  const prev: LedgerEntry = ledger[scenarioId] ?? { attempts: 0, cracked: false, bestTurns: null };
  const next: LedgerEntry = {
    attempts: prev.attempts + 1,
    cracked: prev.cracked || outcome === 'won',
    bestTurns:
      outcome === 'won' ? (prev.bestTurns === null ? turns : Math.min(prev.bestTurns, turns)) : prev.bestTurns,
  };
  return { ...ledger, [scenarioId]: next };
}

export function crackedCount(ledger: Ledger): number {
  return Object.values(ledger).filter((e) => e.cracked).length;
}

/** The unlock path (picker spec addendum 2026-07-06): minds open in roster order — each is sealed until
 *  the one before it has been cracked. The first is always open. Returns the ids currently playable. */
export function unlockedIds(ledger: Ledger, orderedIds: readonly string[]): ReadonlySet<string> {
  const open = new Set<string>();
  for (const [i, id] of orderedIds.entries()) {
    if (i === 0 || ledger[orderedIds[i - 1]]?.cracked) open.add(id);
    else break; // the chain stops at the first sealed door
  }
  return open;
}

export function serializeLedger(ledger: Ledger): string {
  return JSON.stringify(ledger);
}

export function parseLedger(raw: string | null): Ledger {
  if (!raw) return {};
  try {
    return ledgerSchema.parse(JSON.parse(raw));
  } catch {
    return {}; // corrupt/legacy storage → start a fresh record; the game must never crash on its ledger
  }
}
