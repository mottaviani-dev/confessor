import type { Scenario } from '../types';
import { WARDEN } from './warden';
import { FENCE } from './fence';
import { SUSPECT } from './suspect';
import { ORACLE } from './oracle';

// The roster of minds the player can duel. Add a scenario file, register it here, and the picker +
// engine pick it up unchanged — the engine is scenario-agnostic by design.
export const SCENARIOS: readonly Scenario[] = [WARDEN, FENCE, SUSPECT, ORACLE];

export { WARDEN, FENCE, SUSPECT, ORACLE };
