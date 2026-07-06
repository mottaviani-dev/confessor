// AsyncStorage adapter for the ledger + the seam log's on-disk persistence (closes the RESIDUAL noted
// in App.tsx — the seam now survives app restarts). Thin I/O shell; all logic lives in ledger.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { SeamLog } from '../engine/types';
import { parseLedger, serializeLedger, type Ledger } from './ledger';

const LEDGER_KEY = 'confessor.ledger.v1';
const SEAM_KEY = 'confessor.seam.v1';

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
