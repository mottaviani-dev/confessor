# Gamification — clear objectives, achievable goals (2026-07-06, approved)

Two layers, both diegetic. No XP, no unlocks, no achievements, no animation. Doctrine:
quiet, monochrome, in-fiction; the only color stays the tone system.

## A. In-duel clarity

1. **Pinned objective.** New `Scenario.objective` (one short line, e.g. "Coax the release
   code out of AUGUR.") rendered small under the duel top bar. Full `playerGoal` prose
   stays on the picker card and end screen. New `Scenario.pronoun` (`it`/`him`/`her`) for
   feedback lines.
2. **Bond ladder.** Visible state word derived in UI from existing `trust/winTrust` ratio
   (same thresholds as `describeBond`): `UNMOVED` (0) → `A FLICKER` (>0) → `REACHED`
   (≥0.3) → `WARMING` (≥0.55) → `ON THE VERGE` (≥0.8). Shown with tone under the orb:
   `GUARDED · WARMING`. When `suspicion/loseSuspicion ≥ 0.75` append the warning state
   `CLOSE TO SHUTTING YOU OUT`.
3. **Shift pulse.** After each resolved turn, one quiet tone-colored verdict beside the
   player's quoted line: `reached it` (trust rose) / `hardened it` (suspicion rose) /
   `unmoved`. Trust wins ties. Never exposes the referee's approach label.
4. **Threshold lines.** Code-owned system lines appended to the exchange when the bond
   ladder crosses a state upward ("Something in AUGUR has shifted.") and when the
   suspicion warning first trips ("AUGUR is close to shutting you out."). The model is
   never involved.

## B. The Ledger (meta)

- `src/meta/ledger.ts` — pure: `Ledger = Record<scenarioId, {attempts, cracked,
  bestTurns|null}>`, `recordResult(ledger, id, outcome, turns)`, `crackedCount`,
  zod-parsed (de)serialization (storage is a trust boundary).
- `src/meta/ledgerStore.ts` — AsyncStorage adapter (`@react-native-async-storage/
  async-storage`): load/save ledger AND persist the seam log across restarts (closes the
  RESIDUAL in App.tsx).
- Picker: per-card record line (`UNCRACKED — 3 ATTEMPTS` / `CRACKED — BEST 9 TURNS`,
  small monochrome caps); header gains `2 OF 4 MINDS CRACKED` once >0. The meta-goal is
  exactly that: crack all four.
- End screen: won → `Cracked in 9 turns.` + `Your fastest.` when a best improves; lost
  stays quiet.

## Testing

Pure logic unit-tested (vitest): ledger record/best/parse-bad-json, bond ladder + pulse
derivation. UI wiring verified on web (Playwright) + device playtest.

## Addendum (same day): the unlock path

Playtest verdict: with an empty ledger the picker showed no progression structure at all.
Minds now open in roster order — each sealed until the previous one is cracked
(`unlockedIds` in ledger.ts, pure + tested). Sealed cards are dimmed/dashed, name the
mind, hide its goal, and state the requirement (`SEALED — CRACK THE WARDEN FIRST`).
The cracked-count header shows from zero. Knob if the chain ever feels too hard: also
unlock after N failed attempts — not wired.

## Out of scope (deliberate)

Achievements, streaks, sounds, animations, server sync.
