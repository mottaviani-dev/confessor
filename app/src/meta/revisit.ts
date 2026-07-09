// THE ROOM REMEMBERS YOU CAME — the second-visit layer (mandate 1a; bible §2 thrust 4 turned on the
// scenario loop; Matteo's "evolve the story / gamification" swing). The meta-arc is CLOSED and a stranger
// clears the whole game in ~1.5h — HALF the §7 ≥3h launch bar. After the capstone there is no reason to
// re-open a cleared door. This module gives a WON room a second reason to open: a re-entered mind you
// already cracked greets you as someone who has already sat here and already taken what they came for, the
// pinned objective SHIFTS to the one thing you never asked, and a win releases a SECOND, code-held secret.
//
// DOCTRINE — why this is a PURE SCENARIO TRANSFORM, not a model call or new engine control-flow
// (Principle 2: code owns the cosmos, the model only voices the surface; Principle 5: partial revelation,
// scheduled by code, never rolled). The engine is scenario-agnostic by design (types.ts invariant): it
// plays whatever Scenario it is handed. So a "revisit" is not a new engine mode — it is the SAME engine
// playing a scenario whose surface has been shifted by `applyRevisit`. The model never sees the ledger,
// never learns it is a second visit, and never holds either secret — its genuine ignorance is the
// character's (Principle 2). One source of truth for "is this a revisit": the ledger's `cracked` flag
// (meta/ledger). No new persisted revisited flag — the ledger already records it, and a parallel flag
// encoding the same fact would be the anti-pattern the type rules forbid. The `returns` COUNT (ledgerStore)
// is the separate replay-factor instrument; this module owns the deterministic surface transform.

import type { Ledger } from './ledger';
import type { Scenario } from '../engine/types';

/**
 * The scenario the engine should PLAY, given whether the player has already cracked this mind. On a first
 * visit (or a mind with no authored `revisit` layer) this returns the scenario UNCHANGED — the room replays
 * exactly as before. On a genuine revisit it returns a scenario whose SURFACE is shifted: the persona's
 * opening line becomes the second-visit greeting, the pinned objective shifts to the one thing you never
 * asked, the secret becomes the second sliver, and the extract-redaction tokens follow the second secret
 * (falling back to the first secret's tokens when the second has no concrete specifics, e.g. the oracle).
 *
 * Pure + deterministic (no model, no I/O) — the whole reason the transform lives HERE and the engine stays
 * agnostic. Everything else about the scenario (id, title, persona, scene, thresholds, accent, currency
 * calibration, coherence lexicon) is preserved, so the same mind is fought the same way for a DEEPER give;
 * the win/lose balance and the manip wall are untouched (they read the unchanged thresholds).
 */
export function applyRevisit(scenario: Scenario, cracked: boolean): Scenario {
  const r = scenario.revisit;
  if (!cracked || !r) return scenario;
  return {
    ...scenario,
    openingLine: r.greeting,
    objective: r.objective,
    secret: r.secret,
    // The redaction guard must chase the SECOND secret's specifics on a revisit; when the second secret has
    // no concrete name/place (the oracle's inner prophecy) fall back to the base tokens, mirroring the
    // scenario type's own omit-rather-than-invent rule (undefined → redactLeakedExtract no-ops).
    extractTokens: r.extractTokens ?? scenario.extractTokens,
    // The base first-visit path-sliver (mandate 1b) does NOT carry onto a revisit: the revisit secret is a
    // self-contained second-visit reveal, and a base sliver (written for the FIRST secret) woven onto it
    // would misquote the moment. The spread above would keep it, so clear it — the revisit reveal stands
    // alone on both win-paths unless a revisit ever authors its own split (none does today).
    revealByPath: undefined,
    // Same rule for the deeper-give second-tier cut: it was authored for the FIRST secret, so it must not
    // ride onto the self-contained revisit reveal (a first-secret deeper cut woven onto the second-visit
    // secret would misquote). The revisit reveal stands alone; the deep-give layer is a first-visit reward.
    deeperSecret: undefined,
  };
}

/** True when this mind is a genuine revisit: already cracked AND carrying an authored second-visit layer.
 *  The UI/instrument read for "the room has a second reason to open" (distinct from `applyRevisit`, which
 *  transforms; this only tests). A cracked mind with no `revisit` block is NOT a revisit — it replays clean. */
export function isRevisit(scenario: Scenario, cracked: boolean): boolean {
  return cracked && scenario.revisit != null;
}

/**
 * THE PICKER LURE — the diegetic "come back" line for an already-cracked mind that carries a second-visit
 * layer (the discoverability half of mandate 1a). The second-visit content (greeting / shifted objective /
 * second secret) only pays off if the player RE-OPENS the door — but a cracked card reads "CRACKED" and
 * gives a stranger no reason to sit back down, so the replay-factor content the launch bar wants (§7
 * content-hours) stays invisible. This returns that mind's short room-voice teaser to render on its cracked
 * card, or null when the mind is a first visit / has no authored `revisit.hint`. Pure — the same gate as
 * `isRevisit` (a cracked mind with no revisit layer, or with a layer but no hint, shows nothing), so it can
 * never leak a lure onto an uncracked door. Display-only; the hint TEASES the shifted objective, never the
 * second secret (Principle 5 — partial revelation, scheduled by code).
 */
export function revisitHint(scenario: Scenario, cracked: boolean): string | null {
  return isRevisit(scenario, cracked) ? scenario.revisit?.hint ?? null : null;
}

/**
 * THE REPLAY-SURFACE INSTRUMENT (§7 Rule 3 — the honest content-hours lever is REPLAY-factor, not
 * turns-per-game). How many of the given minds are currently in a re-openable second-visit state: cracked
 * in the ledger AND carrying an authored `revisit` layer. This is the deterministic, judge-readable signal
 * for "how much second-layer content the player has unlocked" — it rises as minds are cracked, feeding the
 * content-hours replay-factor the launch bar wants (the persisted `returns` count in ledgerStore is the
 * companion signal: how many times a door was actually re-opened). Pure — the judge imports it without a
 * device or a model, the same shape as the Grip instruments (corruptionCount / objectiveNarrowCount).
 */
export function revisitableCount(ledger: Ledger, scenarios: readonly Scenario[]): number {
  return scenarios.filter((s) => isRevisit(s, ledger[s.id]?.cracked ?? false)).length;
}
