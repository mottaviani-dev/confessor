import type { Scenario } from '../types';
import { WARDEN } from './warden';
import { FENCE } from './fence';
import { SUSPECT } from './suspect';
import { ORACLE } from './oracle';
import { OCCUPANT } from './occupant';

// The roster of minds the player can duel. Add a scenario file, register it here, and the picker +
// engine pick it up unchanged — the engine is scenario-agnostic by design. The OCCUPANT is registered
// LAST: she is the fifth door, unlocked only after the other four are cracked (the ordered unlock chain),
// so the meta-arc frame (roomArc) lands before the seeker ever sits across from the one who stayed.
export const SCENARIOS: readonly Scenario[] = [WARDEN, FENCE, SUSPECT, ORACLE, OCCUPANT];

export { WARDEN, FENCE, SUSPECT, ORACLE, OCCUPANT };
