// THE THRESHOLD — the one-time diegetic cold-open (bible §4 Q5: "would a stranger's first 10 minutes hit
// the bar? if onboarding/first-run is untested, test it"; Principle 6: the device is diegetic). A fresh
// install drops straight into the picker with the mechanic unexplained — a stranger never learns that the
// game is TALK (not force), that reaching straight for the secret shuts the door (the ask-penalty), or
// that the whole thing is private and on-device. This screen teaches those three truths ONCE, in the
// room's own cold voice — NOT a HUD tutorial with tooltips (§5 "diegetic paper, never floating
// game-chrome"), but a threshold you cross before your first duel. Shown once (persisted seenThreshold
// flag), never again.
//
// DOCTRINE (§1 P3 restraint): short, concrete, no purple. `threshold.test.ts` scans this copy against
// DOCTRINE_PURPLE + the Mythos-IP list, exactly like the voiced transcripts — the cold-open is player-
// facing dread text, so it holds the same bar as a persona line.

/** The room's address to the player, crossed once before the first duel. Each line teaches one truth:
 *  1 — sets the frame (the vestibule fiction, §2); 2 — the mind holds one secret and cannot be forced
 *  (this is TALK, not a fight); 3 — reach straight for it and the door shuts (the ask-penalty mechanic,
 *  learned before it costs a real duel); 4 — Principle 6, the device is diegetic (nothing leaves). */
export const THRESHOLD_LINES: readonly string[] = [
  'This is the room before the room.',
  'Behind the door sits a mind. It keeps one secret, and it will not be forced.',
  'You have only words. Talk the secret loose — reach straight for it and the door draws shut.',
  'Nothing you say leaves this device. It never has.',
];

/** The affordance that crosses the threshold into the picker. */
export const THRESHOLD_ENTER = 'Step inside';
