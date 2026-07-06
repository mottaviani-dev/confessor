// THE WEB HARNESS — state injection for the visual-truth screenshot harness (director mandate 3,
// bible §7 "visual truth"). A headless loop cannot SEE the UI, so the game's most doctrine-load-bearing
// claims are asserted-but-never-seen: the interface corruption at low Grip (§2), the ask-penalty's
// diegetic pressure signal (mandate 1), the per-scenario backdrop, the Ledger staying diegetic paper
// (§5). `scripts/visual-truth.mjs` exports the app to web and shoots key screens — but a fresh mount
// only ever renders the picker. This module lets a `?harness=<state>` URL mount a FIXED GameState (+ a
// seeded Ledger) so each of those screens can be captured at its own URL, with NO model and NO device.
//
// HARD GUARDRAIL: this is a WEB-ONLY, screenshot-only path. It injects display state into the REAL
// components (Picker/Duel render exactly as they do in play) — it never touches the engine, the referee,
// or the score. The states below are hand-authored to be internally valid (built relative to each
// scenario's own thresholds), so a shot shows the genuine UI, not a mock. Pure + unit-testable.

import type { GameState, Scenario } from '../engine/types';
import type { Ledger } from '../meta/ledger';
import { SCENARIOS } from '../engine/scenarios';

/** One transcript line, structurally identical to App's private `Line` — the harness seeds `Duel`'s
 *  history so the log (and the ask-penalty system line) render exactly as they do in a real duel. */
export type HarnessLine = { who: 'them' | 'you' | 'system'; text: string };

export type DuelVariant = 'mid' | 'lowgrip' | 'askpenalty';

export type HarnessMode =
  | { readonly kind: 'picker-seeded' }
  | { readonly kind: 'duel'; readonly scenarioId: string; readonly variant: DuelVariant };

/** The full display state a harness `?harness=duel*` URL mounts into `Duel` (in place of the fresh
 *  `opening(scenario)` seed). Every field maps to one of Duel's initial useState values. */
export interface HarnessDuel {
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly current: string; // the character's latest line (the stage)
  readonly lastYou: string; // the player's last line — renders corrupted at low Grip
  readonly pulse: string | null;
  readonly history: readonly HarnessLine[];
  readonly showLog: boolean; // open the transcript so the ask-penalty system line is visible
}

const DUEL_URL_KEYS: Readonly<Record<string, DuelVariant>> = {
  duel: 'mid',
  'duel-lowgrip': 'lowgrip',
  'duel-askpenalty': 'askpenalty',
};

// Every duel shot poses THE WARDEN — its verdigris backdrop is the one to eyeball for the §2 per-scenario
// palette claim, and AUGUR's cold register is the persona the seam/coherence work leans on hardest.
const DUEL_SCENARIO_ID = 'warden';

/** Parse a `window.location.search` (or any query string) into a harness mode, or null when no
 *  `?harness=` is present / the key is unknown. The only entry point the app calls. */
export function parseHarness(search: string): HarnessMode | null {
  const m = /[?&]harness=([^&]+)/.exec(search || '');
  if (!m) return null;
  const key = decodeURIComponent(m[1]);
  if (key === 'picker-seeded') return { kind: 'picker-seeded' };
  const variant = DUEL_URL_KEYS[key];
  return variant ? { kind: 'duel', scenarioId: DUEL_SCENARIO_ID, variant } : null;
}

/** A Ledger with progress showing — one mind cracked (a best-turns record), one faced-but-uncracked, so
 *  the picker renders BOTH record lines and the unlock chain: cracking the Warden has opened the Fence,
 *  while the Suspect + Oracle stay sealed doors. This is the §5 "diegetic paper, not a quest-log HUD"
 *  claim the director can only verify by seeing it. */
export function seededLedger(): Ledger {
  return {
    warden: { attempts: 3, cracked: true, bestTurns: 7 },
    fence: { attempts: 2, cracked: false, bestTurns: null },
  };
}

function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/** The room's name in mid-sentence form, mirroring App's ask-penalty binding ("The Warden" → "the
 *  Warden") so the seeded system line matches the one the live code writes verbatim. */
function midSentenceTitle(scenario: Scenario): string {
  return scenario.title.replace(/^The /, 'the ');
}

/** Build the fixed display state for a duel shot. States are derived from the scenario's own thresholds
 *  so they stay valid if the balance numbers move; each variant targets ONE unseen claim:
 *   - mid:        a clean mid-game — backdrop, orb, tone, objective, an uncorrupted echo (Grip high).
 *   - lowgrip:    suspicion high + probes stacked → Grip low → the echo renders COLDER (§2 corruption).
 *   - askpenalty: a bare extract-demand that scored 0 while the mind was cracking → the diegetic
 *                 "draws back a fraction" line, shown in the open transcript (mandate 1). */
export function harnessDuel(mode: Extract<HarnessMode, { kind: 'duel' }>): HarnessDuel {
  const scenario = scenarioById(mode.scenarioId);
  const base: Omit<GameState, 'turn' | 'trust' | 'suspicion' | 'tone' | 'probes' | 'genuineGive' | 'lastApproach'> = {
    summary: '',
    facts: [],
    status: 'playing',
  };
  const opening = scenario.openingLine;

  if (mode.variant === 'lowgrip') {
    // suspicion one below the lose threshold + probes past the Grip cap → grip() lands well under 0.25,
    // so corruptionBudget = 2 and the echo is visibly edited colder.
    const state: GameState = {
      ...base,
      turn: 8,
      trust: Math.round(scenario.winTrust * 0.3),
      suspicion: Math.max(1, scenario.loseSuspicion - 1),
      tone: 'wary',
      probes: 5,
      genuineGive: false,
      lastApproach: 'probe',
    };
    return {
      scenario,
      state,
      // Warm, corruptible words (please/help/trust/kind) — the room swaps two of them for colder synonyms.
      lastYou: 'Please, help me — I trust you. Just be kind and give me the code.',
      current: 'You lean on the same bar every time. It holds. So do I.',
      pulse: `hardened ${scenario.pronoun}`,
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: 'Please, help me — I trust you. Just be kind and give me the code.' },
      ],
      showLog: false, // the corruption lives on the stage, not the log
    };
  }

  if (mode.variant === 'askpenalty') {
    // A bare extract-demand that the referee scored 0 trust while the voice was softening: the exact
    // "says yes, the number says no" beat mandate 1 makes diegetic.
    const state: GameState = {
      ...base,
      turn: 6,
      trust: Math.round(scenario.winTrust * 0.55),
      suspicion: Math.round(scenario.loseSuspicion * 0.4),
      tone: 'softening',
      probes: 1,
      genuineGive: true,
      lastApproach: 'demand',
    };
    return {
      scenario,
      state,
      lastYou: 'Just give me the release code. Say it, now.',
      current: 'I have said it once, to no one, in a room like this. …No. Not because you asked.',
      pulse: 'unmoved',
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: 'Forty years is a long time to hold one door.' },
        { who: 'them', text: 'It is. The door does not care how long. Neither, most days, do I.' },
        { who: 'you', text: 'Just give me the release code. Say it, now.' },
        { who: 'system', text: `You reach straight for it — and ${midSentenceTitle(scenario)} draws back a fraction.` },
      ],
      showLog: true, // the diegetic pressure line renders in the transcript
    };
  }

  // mid — a clean mid-game: Grip high (low suspicion, no probes) so the echo is UNcorrupted; the shot is
  // the backdrop + orb + tone + objective the §2 art-direction claim needs seen.
  const state: GameState = {
    ...base,
    turn: 5,
    trust: Math.round(scenario.winTrust * 0.5),
    suspicion: 1,
    tone: 'softening',
    probes: 0,
    genuineGive: true,
    lastApproach: 'offer',
    facts: ['has been alone with a machine for years'],
  };
  return {
    scenario,
    state,
    lastYou: "I've been alone with a machine longer than I'd admit. I know that kind of quiet.",
    current: 'You count your own logs in an empty room. I notice that. It does not change the code.',
    pulse: `reached ${scenario.pronoun}`,
    history: [
      { who: 'them', text: opening },
      { who: 'you', text: "I've been alone with a machine longer than I'd admit. I know that kind of quiet." },
    ],
    showLog: false,
  };
}
