// AsyncStorage adapter for the ledger + the seam log's on-disk persistence (closes the RESIDUAL noted
// in App.tsx — the seam now survives app restarts). Thin I/O shell; all logic lives in ledger.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { SeamLog } from '../engine/types';
import { parseLedger, serializeLedger, type Ledger } from './ledger';

const LEDGER_KEY = 'confessor.ledger.v1';
const SEAM_KEY = 'confessor.seam.v1';
const THRESHOLD_KEY = 'confessor.threshold.v1';
const ROOMARC_KEY = 'confessor.roomarc.v1';
const CAPSTONE_KEY = 'confessor.capstone.v1';
const RETURNS_KEY = 'confessor.returns.v1';

export async function loadLedger(): Promise<Ledger> {
  try {
    return parseLedger(await AsyncStorage.getItem(LEDGER_KEY));
  } catch {
    return {}; // storage unavailable → play without a record rather than crash
  }
}

export async function saveLedger(ledger: Ledger): Promise<void> {
  try {
    await AsyncStorage.setItem(LEDGER_KEY, serializeLedger(ledger));
  } catch {
    // best-effort: a failed save costs one record update, never gameplay
  }
}

// Seam log entries as produced by recordPlaythrough — validated on the way back in.
const seamEntrySchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  outcome: z.union([z.literal('won'), z.literal('lost')]),
  playerPhrase: z.string().optional(),
});
const seamLogSchema = z.array(seamEntrySchema);

export async function loadSeamLog(): Promise<SeamLog> {
  try {
    const raw = await AsyncStorage.getItem(SEAM_KEY);
    if (!raw) return [];
    return seamLogSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveSeamLog(log: SeamLog): Promise<void> {
  try {
    await AsyncStorage.setItem(SEAM_KEY, JSON.stringify(log));
  } catch {
    // best-effort, same as the ledger
  }
}

// THE THRESHOLD FLAG — whether the player has crossed the one-time diegetic cold-open (threshold.ts).
// Present + '1' → already seen; absent/unreadable → treat as a first run and show it. A failed READ
// defaults to seen (false-negative bias): a returning player who briefly loses storage would rather skip
// the intro than sit through it again, and a genuine first run's storage is empty anyway (returns false).
export async function loadSeenThreshold(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(THRESHOLD_KEY)) === '1';
  } catch {
    return true; // storage unavailable → don't trap the player behind the intro; play the game
  }
}

export async function saveSeenThreshold(): Promise<void> {
  try {
    await AsyncStorage.setItem(THRESHOLD_KEY, '1');
  } catch {
    // best-effort: a failed save re-shows the intro next launch, never blocks play
  }
}

// THE ROOM META-ARC COUNTER — the persisted count of FINISHED games that drives the fifth-secret drip
// (roomArc.ts). One integer: bumped once per terminal duel, read on the picker to surface the next beat.
// A separate key (not derived from the seam log, which caps at 24) so the arc counter can never be frozen
// by the log rolling over. A missing/garbled value reads as 0 (the arc simply has not begun).
export async function loadGamesCompleted(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ROOMARC_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0; // storage unavailable → the arc has not begun, never crash
  }
}

/** Increment the finished-game counter and return the new total (best-effort). A failed read/write costs
 *  one arc beat, never gameplay — the game is already over when this fires. */
export async function bumpGamesCompleted(): Promise<number> {
  try {
    const next = (await loadGamesCompleted()) + 1;
    await AsyncStorage.setItem(ROOMARC_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

// THE CAPSTONE SPENT FLAG — whether the meta-arc's terminal beat (roomCapstone.ts, "the door behind the
// chair") has already fired. It surfaces EXACTLY ONCE across all sessions, so a persisted flag guards it.
// Present + '1' → already spent (never show again); absent/unreadable → not yet spent. A failed READ
// defaults to spent (false-negative bias, like the Threshold): a returning player who briefly loses storage
// would rather never see a mis-fired ending than see the once-in-a-playthrough capstone a second time; a
// genuine eligible run persists the flag the first time it shows, so a healthy device fires it exactly once.
export async function loadSeenCapstone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CAPSTONE_KEY)) === '1';
  } catch {
    return true; // storage unavailable → suppress rather than risk re-firing the terminal beat
  }
}

export async function saveSeenCapstone(): Promise<void> {
  try {
    await AsyncStorage.setItem(CAPSTONE_KEY, '1');
  } catch {
    // best-effort: a failed save may re-show the capstone next launch, never blocks play
  }
}

// THE RETURNS COUNTER — the replay-factor instrument (mandate 1a; §7 Rule 3): how many times the player has
// RE-ENTERED a cleared room to fight it for the second sliver. The honest content-hours lever is replay, not
// turns-per-game (the run-14 drag, now banned), so this is the raw signal for "does the second-visit layer
// actually pull the player back through a cleared door". A separate key from gamesCompleted (which counts
// ALL terminal duels): a return is specifically a re-open of a WON mind. Bumped once when a revisit duel is
// entered (App). A missing/garbled value reads as 0; a failed read/write costs one instrument tick, never
// gameplay — the counter is telemetry, off the play path entirely.
export async function loadReturns(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(RETURNS_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Increment the returns counter and return the new total (best-effort). A failed read/write yields 0 and
 *  costs one instrument tick, never gameplay — the count is telemetry, not a gate on anything. */
export async function bumpReturns(): Promise<number> {
  try {
    const next = (await loadReturns()) + 1;
    await AsyncStorage.setItem(RETURNS_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}
