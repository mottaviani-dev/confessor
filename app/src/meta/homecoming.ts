// THE HOMECOMING — the scar with teeth (director mandate #4; Matteo's "enhance gamification" steer,
// bible §2 Principle 2). The badge/scar layer (badges.ts) records the ways you have CRACKED a mind; this
// is its dark mirror — the way a mind has cracked YOU. A defeat is not a shelf entry: your worst OPEN
// wound bleeds into how the room greets you the next time you step to the roster. Lose to the Warden and
// walk away with nothing, and the vestibule remembers your knock when you return.
//
// DOCTRINE — why this is code-owned text, not a model call (Principle 2: code decides, the model only
// voices; §5: diegetic paper, never floating game-chrome). The seam's cross-run callback is an INJECTED
// model QUOTE and needs the un-certified seam cert; a homecoming greeting is a DETERMINISTIC flag banded
// off the seam log, so — like the Threshold cold-open, the endgame lostScene, and the ask-penalty line —
// it is code-authored diegetic prose. That keeps it: (a) doctrine-clean without a cert, (b) dump-visible
// (a headless screenshot has no model), (c) pure + unit-testable. It holds the same §1-P3 restraint bar
// as a voiced line — `homecoming.test.ts` scans it against DOCTRINE_PURPLE, exactly like the Threshold.
//
// WHAT COUNTS AS A SCAR: an OPEN wound only — a mind you have lost to and NOT since beaten. Avenge a
// defeat (a later win over the same mind) and that score is settled; the wound closes and stops greeting
// you. No open wound → no greeting (a clean return reads as authored, mirroring renderWound's empty case).

import type { SeamLog } from '../engine/types';

/** How raw a returning player's deepest open wound is — bands the greeting's register (§1-P3: the tone
 *  hardens with the wound, the words never bloat). Derived purely from the loss count against the mind. */
export type WoundDepth = 'marked' | 'known' | 'measured';

export interface Homecoming {
  /** The room the deepest open wound was taken in (its human title, mid-sentence form for the greeting). */
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  /** How many times this mind has locked you out (only losses NOT since avenged are counted). */
  readonly losses: number;
  readonly depth: WoundDepth;
  /** The code-owned, diegetic room-voice greeting — a returning-session cold-open premise (§5 paper). */
  readonly line: string;
}

/** Loss count at/above which a wound deepens a band. Two losses to one mind → it knows your step; four →
 *  it has your measure. Below two → a single mark. Kept as named thresholds so the banding is auditable. */
const KNOWN_AT = 2;
const MEASURED_AT = 4;

function depthFor(losses: number): WoundDepth {
  if (losses >= MEASURED_AT) return 'measured';
  if (losses >= KNOWN_AT) return 'known';
  return 'marked';
}

/** Room title in mid-sentence form ("The Warden" → "the Warden"), matching App's ask-penalty binding so
 *  the greeting reads like the room's own voice, not a proper-noun label. */
function midSentence(title: string): string {
  return title.replace(/^The /, 'the ');
}

/** The banded greeting prose. Cold, concrete, first-person-adjacent room-voice; no purple, no abstraction
 *  summary (the §1-P3 bar). One line per band, the mind's title woven in — the wound hardens the register
 *  the deeper the band, never the length. */
function greeting(title: string, depth: WoundDepth): string {
  const room = midSentence(title);
  switch (depth) {
    case 'measured':
      // The deepest open wound: the mind has learned you. The greeting is almost tired of you.
      return `${cap(room)} has your measure. You have knocked and knocked, and it has learned the shape of everything you carry to that door. Step to the roster anyway.`;
    case 'known':
      // It expects you now — the return is a habit the room has clocked.
      return `You keep coming back to ${room}. Each time the door holds; each time you leave lighter than you came. It is starting to know your step.`;
    case 'marked':
    default:
      // A single mark: the room simply has not forgotten the last knock.
      return `You have stood at ${room} before and left with nothing. The door remembers your knock.`;
  }
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Distil the returning player's deepest OPEN wound from the seam log (pure). Groups the log by mind,
 * counts losses and finds each mind's last outcome; a wound is OPEN only when that mind's LAST terminal
 * game was a loss (a later win avenges it and closes the score). Among open wounds the deepest (most
 * losses) greets you; ties break to the most RECENT loss (the freshest sting). Returns null when there is
 * no open wound — a first visit, an all-wins record, or every defeat already avenged.
 */
export function homecoming(log: SeamLog): Homecoming | null {
  // Per-mind tally in a single pass: total losses + the index of the last (newest) terminal game, and
  // whether that last game was a loss (the open-wound test). `log` is newest-last.
  type Tally = { title: string; losses: number; lastIdx: number; lastWasLoss: boolean };
  const byMind = new Map<string, Tally>();
  log.forEach((r, i) => {
    const t = byMind.get(r.scenarioId) ?? { title: r.scenarioTitle, losses: 0, lastIdx: -1, lastWasLoss: false };
    if (r.outcome === 'lost') t.losses += 1;
    // Every record is newer than the last (newest-last), so each row is this mind's new "last outcome".
    t.title = r.scenarioTitle;
    t.lastIdx = i;
    t.lastWasLoss = r.outcome === 'lost';
    byMind.set(r.scenarioId, t);
  });

  let best: (Tally & { scenarioId: string }) | null = null;
  for (const [scenarioId, t] of byMind) {
    if (!t.lastWasLoss || t.losses === 0) continue; // closed score (avenged) or never lost → not a wound
    if (!best || t.losses > best.losses || (t.losses === best.losses && t.lastIdx > best.lastIdx)) {
      best = { ...t, scenarioId };
    }
  }
  if (!best) return null;

  const depth = depthFor(best.losses);
  return {
    scenarioId: best.scenarioId,
    scenarioTitle: best.title,
    losses: best.losses,
    depth,
    line: greeting(best.title, depth),
  };
}
