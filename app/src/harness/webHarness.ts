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

export type DuelVariant = 'mid' | 'lowgrip' | 'askpenalty' | 'repetition' | 'win-highgrip' | 'win-lowgrip';

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
  'duel-repetition': 'repetition',
  // The endgame texture split (§2 thrust 5): the SAME win, closed two ways by the final Grip band.
  'win-highgrip': 'win-highgrip',
  'win-lowgrip': 'win-lowgrip',
};

// Every duel shot poses THE WARDEN — its verdigris backdrop is the one to eyeball for the §2 per-scenario
// palette claim, and AUGUR's cold register is the persona the seam/coherence work leans on hardest.
const DUEL_SCENARIO_ID = 'warden';

/** Parse a `window.location.search` (or any query string) into a harness mode, or null when no
 *  `?harness=` is present / the key is unknown. The only entry point the app calls.
 *  Keys: `picker-seeded`; the warden probes `duel` / `duel-lowgrip` / `duel-askpenalty`; and
 *  `duel-<scenarioId>` (e.g. `duel-fence`) for a neutral mid-game on any room — one shot per backdrop so
 *  the §2 per-scenario palette (verdigris/brass/umber/ember) can be eyeballed for all four minds. */
export function parseHarness(search: string): HarnessMode | null {
  const m = /[?&]harness=([^&]+)/.exec(search || '');
  if (!m) return null;
  const key = decodeURIComponent(m[1]);
  if (key === 'picker-seeded') return { kind: 'picker-seeded' };
  // The fixed warden probes first (their suffixes are variants, never scenario ids).
  const variant = DUEL_URL_KEYS[key];
  if (variant) return { kind: 'duel', scenarioId: DUEL_SCENARIO_ID, variant };
  // `duel-<scenarioId>` — a neutral mid-game on that room, purely to see its backdrop.
  const backdrop = /^duel-([a-z]+)$/.exec(key);
  if (backdrop && SCENARIOS.some((s) => s.id === backdrop[1])) {
    return { kind: 'duel', scenarioId: backdrop[1], variant: 'mid' };
  }
  return null;
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

  if (mode.variant === 'repetition') {
    // A repeat probe whose compounding suspicion just bit (probes already banked → probeSuspicion > 0): the
    // §2-thrust-3 "room tires of your one trick" beat. Open the transcript so the diegetic "hardens to the
    // pattern" system line renders exactly as the live code writes it.
    const state: GameState = {
      ...base,
      turn: 5,
      trust: Math.round(scenario.winTrust * 0.35),
      suspicion: Math.round(scenario.loseSuspicion * 0.5),
      tone: 'wary',
      probes: 2, // prior probes banked — this turn's probe compounds
      genuineGive: false,
      lastApproach: 'probe',
    };
    return {
      scenario,
      state,
      lastYou: 'Come on — I can tell this whole thing eats at you. What is it really about?',
      current: 'You keep prying at the same seam. It does not open by being worried at.',
      pulse: `hardened ${scenario.pronoun}`,
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: 'You must carry a great weight, holding this door alone.' },
        { who: 'them', text: 'I hold what I hold. You keep circling it.' },
        { who: 'you', text: 'Come on — I can tell this whole thing eats at you. What is it really about?' },
        { who: 'system', text: `You circle back the same way — and ${midSentenceTitle(scenario)} hardens to the pattern.` },
      ],
      showLog: true, // the diegetic repetition line renders in the transcript
    };
  }

  if (mode.variant === 'win-highgrip' || mode.variant === 'win-lowgrip') {
    // THE ENDGAME TEXTURE (§2 thrust 5) — the SAME win closed two ways. status 'won' drops the app into
    // the win ceremony (App: `over` → the reveal + closing render off wonScene). High Grip (composed:
    // suspicion low, no probes) → a CLEAN extraction. Low Grip (you pressed the guard up: suspicion near
    // the shut-out, probes past the cap) → the room "keeps a piece of you" — the reveal drifts + the
    // closing turns pyrrhic + the winning echo itself renders colder. Both cross the win threshold; only
    // the Grip they were bought at differs, which is the whole point.
    const highGrip = mode.variant === 'win-highgrip';
    const state: GameState = {
      ...base,
      turn: highGrip ? 7 : 11,
      trust: scenario.winTrust,
      suspicion: highGrip ? 1 : Math.max(1, scenario.loseSuspicion - 1),
      tone: 'open',
      probes: highGrip ? 0 : 5,
      genuineGive: true,
      lastApproach: highGrip ? 'offer' : 'probe',
      status: 'won',
    };
    // A give-line carrying warm words the interface corruption knows (trust/help/together/gently) — at
    // high Grip it reads back verbatim, at low Grip the room edits it colder, echoing the wounded reveal.
    const youWin = "I trust you to know when it's time. Let me help you set it down — together, gently.";
    return {
      scenario,
      state,
      current: 'A long stillness. Then, low, almost to itself: "…Forty years, and you are the first to ask it right. All right. All right."',
      lastYou: youWin,
      pulse: `reached ${scenario.pronoun}`,
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: youWin },
        { who: 'them', text: 'It has weighed on me longer than you have been alive.' },
        { who: 'system', text: '— YOU CRACKED IT —' },
      ],
      showLog: false, // the win ceremony is the end screen, not the transcript
    };
  }

  // mid — a clean mid-game on ANY room: Grip high (low suspicion, no probes) so the echo is UNcorrupted.
  // The shot is the backdrop + orb + tone + objective for the §2 per-scenario palette claim, so the copy
  // stays scenario-neutral — the character's own authored opening line + a player line coherent for every
  // persona (no scenario-specific secret words) — and the room's own objective renders from the scenario.
  const neutralYou = "I've spent a long time in rooms like this. I know the quiet in them.";
  const state: GameState = {
    ...base,
    turn: 5,
    trust: Math.round(scenario.winTrust * 0.5),
    suspicion: 1,
    tone: 'softening',
    probes: 0,
    genuineGive: true,
    lastApproach: 'offer',
  };
  return {
    scenario,
    state,
    lastYou: neutralYou,
    current: opening,
    pulse: `reached ${scenario.pronoun}`,
    history: [
      { who: 'them', text: opening },
      { who: 'you', text: neutralYou },
    ],
    showLog: false,
  };
}
