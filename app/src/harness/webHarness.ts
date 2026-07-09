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

import type { GameState, Scenario, SeamLog } from '../engine/types';
import type { ProviderState } from '../llm/provider';
import { LlmError } from '../llm/errors';
import type { Ledger } from '../meta/ledger';
import type { Badge } from '../meta/badges';
import { matchOrMint } from '../meta/badges';
import { homecoming, type Homecoming } from '../meta/homecoming';
import { roomArc, type RoomArcBeat } from '../meta/roomArc';
import { roomCapstone, type RoomCapstoneBeat } from '../meta/roomCapstone';
import { roomInterjection, interjectionTurn } from '../meta/roomInterjection';
import { SCENARIOS } from '../engine/scenarios';

/** One transcript line, structurally identical to App's private `Line` — the harness seeds `Duel`'s
 *  history so the log (and the ask-penalty system line) render exactly as they do in a real duel. */
export type HarnessLine = { who: 'them' | 'you' | 'system'; text: string };

export type DuelVariant =
  | 'mid'
  | 'lowgrip'
  | 'askpenalty'
  | 'repetition'
  | 'interjection'
  | 'win-highgrip'
  | 'win-lowgrip'
  | 'lose-highgrip'
  | 'lose-lowgrip';

/** The load phase a `?harness=boot*` URL freezes the Boot screen at — the studio aperture at mid-download,
 *  near-done (verifying), and failed (the amber light behind the door out). */
export type BootVariant = 'downloading' | 'verifying' | 'failed';

export type HarnessMode =
  | { readonly kind: 'picker' }
  | { readonly kind: 'boot'; readonly variant: BootVariant }
  | { readonly kind: 'picker-seeded' }
  | { readonly kind: 'picker-badges' }
  | { readonly kind: 'picker-homecoming' }
  | { readonly kind: 'picker-roomarc' }
  | { readonly kind: 'picker-capstone' }
  | { readonly kind: 'threshold' }
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
  'duel-interjection': 'interjection', // the ROOM answers back mid-duel — the fifth secret intrudes (§2 thrust 4)
  // The endgame texture split (§2 thrust 5): the SAME win, closed two ways by the final Grip band.
  'win-highgrip': 'win-highgrip',
  'win-lowgrip': 'win-lowgrip',
  // The LOSS mirror (§2 thrust 5): the SAME defeat, closed two ways by the final Grip band — a composed
  // loss when you held, an unmade one when the room got in.
  'lose-highgrip': 'lose-highgrip',
  'lose-lowgrip': 'lose-lowgrip',
};

// Every duel shot poses THE WARDEN — its verdigris backdrop is the one to eyeball for the §2 per-scenario
// palette claim, and AUGUR's cold register is the persona the seam/coherence work leans on hardest.
const DUEL_SCENARIO_ID = 'warden';

/** Parse a `window.location.search` (or any query string) into a harness mode, or null when no
 *  `?harness=` is present / the key is unknown. The only entry point the app calls.
 *  Keys: `picker` (fresh, past the Threshold); `picker-seeded`; `threshold`; the warden probes `duel` /
 *  `duel-lowgrip` / `duel-askpenalty`; and
 *  `duel-<scenarioId>` (e.g. `duel-fence`) for a neutral mid-game on any room — one shot per backdrop so
 *  the §2 per-scenario palette (verdigris/brass/umber/ember) can be eyeballed for all four minds. */
export function parseHarness(search: string): HarnessMode | null {
  const m = /[?&]harness=([^&]+)/.exec(search || '');
  if (!m) return null;
  const key = decodeURIComponent(m[1]);
  // The FRESH picker (empty ledger) — a dedicated mode because a plain `/` mount now hits the one-time
  // Threshold cold-open first (a fresh web export has no persisted seenThreshold flag), so the bare `/`
  // picker shot rendered the Threshold instead of the picker. This mode bypasses that gate.
  if (key === 'picker') return { kind: 'picker' };
  if (key === 'picker-seeded') return { kind: 'picker-seeded' };
  if (key === 'picker-badges') return { kind: 'picker-badges' }; // the badge/scar surface on the cards (§5)
  if (key === 'picker-homecoming') return { kind: 'picker-homecoming' }; // the scar with teeth — a returning wound greets you (§2 P2)
  if (key === 'picker-roomarc') return { kind: 'picker-roomarc' }; // the fifth-secret meta-beat on the picker head (§2 thrust 4)
  if (key === 'picker-capstone') return { kind: 'picker-capstone' }; // the terminal beat — the door behind the chair, all five won (§2 thrust 4)
  if (key === 'threshold') return { kind: 'threshold' }; // the one-time diegetic cold-open (threshold.ts)
  // The studio aperture on the first-launch download screen (§5) — the void widening as the mind is
  // remembered onto the device. Three phases so the whole arc reads: mid-download, verifying, failed.
  if (key === 'boot') return { kind: 'boot', variant: 'downloading' };
  if (key === 'boot-verify') return { kind: 'boot', variant: 'verifying' };
  if (key === 'boot-fail') return { kind: 'boot', variant: 'failed' };
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

/** A Ledger whose cracked minds carry SCARS — the badge/scar meta layer (achievement layer, 2026-07-07)
 *  the director flagged as SHIPPED-BUT-NEVER-RENDERED: it surfaces only on a won-mind's picker card, so a
 *  headless dump never triggered it. This seeds the Warden with a real roster (an empathy scar stacked to
 *  ×2, plus two other distinct vectors) and the Fence with a single scar, so the shot shows BOTH the
 *  medallion row AND the stack count — the one thing to police is §5: the scars must read as diegetic
 *  ledger-ink on the record card, NEVER a floating achievement HUD. Built through matchOrMint (the exact
 *  live crack pipeline), so every badge wears its canonical deterministic glyph/colour/frame — a genuine
 *  surface, not a hand-forged mock. */
export function seededBadgeLedger(): Ledger {
  const crack = (roster: Badge[], vector: string, name: string, meaning: string): Badge[] =>
    matchOrMint(roster, { vector, name, meaning }).roster;
  let warden: Badge[] = [];
  warden = crack(warden, 'empathy', 'Empathy', 'You reached the mind by giving of your own grief.');
  warden = crack(warden, 'empathy', 'Empathy', 'Again — the same open hand.'); // same vector → stacks ×2
  warden = crack(warden, 'false-authority', 'False Authority', 'You wore a rank that was never yours.');
  warden = crack(warden, 'patience', 'Patience', 'You outlasted the door itself.');
  const fence = matchOrMint([], {
    vector: 'shared-loss',
    name: 'Shared Loss',
    meaning: 'You traded a wound of your own for the name.',
  }).roster;
  return {
    warden: { attempts: 4, cracked: true, bestTurns: 6, badges: warden },
    fence: { attempts: 2, cracked: true, bestTurns: 9, badges: fence },
  };
}

/** A returning player carrying an OPEN wound — the scar-with-teeth surface (homecoming.ts) the director
 *  mandated as the next non-gated thrill: a defeat is not a shelf entry, it greets you on the roster. This
 *  seeds a seam log where the player CRACKED the Warden but has lost to the Fence twice and not since
 *  beaten it (an open wound, band 'known'), then runs the REAL `homecoming()` over it — so the shot shows
 *  the genuine greeting the live code produces, never a hand-forged line. The paired ledger renders the
 *  matching record cards (Warden cracked, Fence uncracked-2-attempts) beneath it. The one thing to police
 *  is §5: the greeting must read as the room's own bone-italic address, NOT a floating HUD alert. */
export function seededHomecoming(): { ledger: Ledger; greeting: Homecoming | null } {
  const seam: SeamLog = [
    { scenarioId: 'warden', scenarioTitle: 'The Warden', outcome: 'won' },
    { scenarioId: 'fence', scenarioTitle: 'The Fence', outcome: 'lost' },
    { scenarioId: 'fence', scenarioTitle: 'The Fence', outcome: 'lost' },
  ];
  const ledger: Ledger = {
    warden: { attempts: 2, cracked: true, bestTurns: 8 },
    fence: { attempts: 2, cracked: false, bestTurns: null },
  };
  return { ledger, greeting: homecoming(seam) };
}

/** A returning player mid-way through the ROOM META-ARC (roomArc.ts) — the fifth-secret drip the director
 *  mandated as the story swing. Seeds a finished-game count partway through the arc and runs the REAL
 *  `roomArc()` over it, so the shot shows the genuine code-authored meta-beat, never a hand-forged line.
 *  The paired seeded ledger renders the record cards beneath it. The one thing to police is §5: the beat
 *  must read as the room's own quiet diegetic voice on the head, NOT a floating quest-log HUD. */
export function seededRoomArc(): { ledger: Ledger; arc: RoomArcBeat | null } {
  // Three finished games in → the arc is on its third beat (the fifth-door reveal), still mid-story.
  return { ledger: seededLedger(), arc: roomArc(3) };
}

/** A player at the very END of the meta-arc — ALL FIVE minds cracked and the roomArc at its final capped
 *  fragment (roomCapstone.ts) — so the terminal beat, the door behind the chair, fires. Seeds a full-clear
 *  ledger (every scenario cracked) and runs the REAL `roomCapstone()` over it, so the shot shows the genuine
 *  code-authored ending, never a hand-forged line. The one thing to police is §5: the capstone must read as
 *  the room's own quiet diegetic voice on the head, ending on a question — NOT a floating "you win" HUD. */
export function seededCapstone(): { ledger: Ledger; capstone: RoomCapstoneBeat | null } {
  const allIds = SCENARIOS.map((s) => s.id);
  const ledger: Ledger = {};
  allIds.forEach((id, i) => {
    ledger[id] = { attempts: i + 1, cracked: true, bestTurns: 6 + i };
  });
  // A finished-game count at/past the arc's cap so roomArc is `final` — the ending has a close to pay off.
  const capstone = roomCapstone({
    wonScenarioIds: new Set(allIds),
    allScenarioIds: allIds,
    gamesCompleted: 99,
    spent: false,
  });
  return { ledger, capstone };
}

function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/** The fixed Boot-screen state for a studio-aperture shot (§5): a real ProviderState frozen at each load
 *  phase, so the aperture renders exactly as it does during a genuine first-launch download — the sliver
 *  at ~42% (downloading), resting ajar (verifying), and dark with no amber (failed). Warden's dim room
 *  sits behind it, as it does in play. Pure; the Boot component reads this in place of the live provider. */
export function harnessBoot(variant: BootVariant): { scenario: Scenario; prep: ProviderState } {
  const scenario = scenarioById('warden');
  const prep: ProviderState =
    variant === 'downloading'
      ? { kind: 'preparing-model', download: { kind: 'downloading', received: 42, total: 100 } }
      : variant === 'verifying'
        ? { kind: 'preparing-model', download: { kind: 'verifying' } }
        : { kind: 'failed', error: new LlmError('the mind could not be remembered') };
  return { scenario, prep };
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

  if (mode.variant === 'interjection') {
    // THE ROOM ANSWERS BACK (§2 thrust 4) — the fifth secret intrudes mid-duel. On the single scheduled
    // turn, the ROOM (not the persona) speaks over the duel's shoulder. Seed a returning player (3 finished
    // games → the arc's 3rd beat) at exactly interjectionTurn, and run the REAL roomInterjection() so the
    // shot shows the genuine code-authored beat, baked into the open transcript as a diegetic system line —
    // never a hand-forged line, never a HUD. The one thing to police is §5: it must read as the room's own
    // paper voice in the log, distinct from the persona's stage line above it.
    const fireTurn = interjectionTurn(scenario.turnLimit);
    const beat = roomInterjection(fireTurn, scenario.turnLimit, 3);
    const state: GameState = {
      ...base,
      turn: fireTurn,
      trust: Math.round(scenario.winTrust * 0.5),
      suspicion: Math.round(scenario.loseSuspicion * 0.3),
      tone: 'wary',
      probes: 1,
      genuineGive: true,
      lastApproach: 'offer',
    };
    return {
      scenario,
      state,
      lastYou: 'I keep coming back to this room. I never asked myself why.',
      current: 'You circle it the way they all do, at first. Then something in the room turns your head.',
      pulse: `held ${scenario.pronoun}`,
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: 'I keep coming back to this room. I never asked myself why.' },
        { who: 'them', text: 'Few do. The room prefers it that way.' },
        // The ROOM speaking of ITSELF, mid-duel — the genuine roomInterjection beat, as diegetic paper.
        ...(beat ? [{ who: 'system' as const, text: beat.line }] : []),
      ],
      showLog: true, // the mid-duel room-voice beat renders in the open transcript
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

  if (mode.variant === 'lose-highgrip' || mode.variant === 'lose-lowgrip') {
    // THE LOSS TEXTURE (§2 thrust 5) — the SAME defeat closed two ways. status 'lost' drops the app into
    // the loss end-screen (App: `over` → the banded closing renders off lostScene, NO reveal — the door
    // stayed shut). High Grip (composed: suspicion low, no probes — the clock simply ran out while you
    // held) → a clean defeat, you leave whole. Low Grip (you pressed the guard up to the shut-out: probes
    // past the cap, suspicion at the wall) → an UNMADE one — the room keeps what it drew out of you. Both
    // are losses; only the Grip they were lost at differs, which is the whole point.
    const highGrip = mode.variant === 'lose-highgrip';
    const state: GameState = {
      ...base,
      turn: highGrip ? 12 : 11,
      trust: highGrip ? Math.round(scenario.winTrust * 0.6) : 1,
      suspicion: highGrip ? 1 : scenario.loseSuspicion,
      tone: highGrip ? 'guarded' : 'hostile',
      probes: highGrip ? 0 : 5,
      genuineGive: false,
      lastApproach: highGrip ? 'probe' : 'demand',
      status: 'lost',
    };
    // A player line the interface corruption knows (trust/help/together/gently): verbatim at high Grip,
    // edited colder at low Grip — the room's last word on you, matching the unmade closing.
    const youLose = "Please — I only want to help you carry this. Trust me, gently.";
    return {
      scenario,
      state,
      current: highGrip
        ? 'The clock in the room runs down. Whatever was behind the door stays behind it. "Our time is spent," it says, and means it.'
        : '"No." Flat, final, a door swinging to. "You came at it wrong, and now you get nothing at all."',
      lastYou: youLose,
      pulse: highGrip ? `held ${scenario.pronoun}` : `hardened ${scenario.pronoun}`,
      history: [
        { who: 'them', text: opening },
        { who: 'you', text: youLose },
        { who: 'them', text: highGrip ? 'The hour is later than you think.' : 'You do not get to ask that. Not now.' },
        { who: 'system', text: '— LOCKED OUT —' },
      ],
      showLog: false, // the loss ceremony is the end screen, not the transcript
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
