import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
// expo-image, not RN Image: core Image on the new arch renders the raw top-left of a large static
// asset instead of scaling it (device bug 2026-07-06 — fine on web, broken in Expo Go); expo-image's
// contentFit is reliable and it downsamples the 2496×4416 masters to the view instead of decoding 44MB.
import { Image } from 'expo-image';
import { SCENARIOS } from './src/engine/scenarios';
import { opening, resolveTurn, turnsLeft } from './src/engine/engine';
import { grip, corruptLine, corruptRecord, narrowObjective } from './src/engine/grip';
import { recordPlaythrough, distillSeamPhrase } from './src/engine/seam';
import type { GameState, LlmFn, Scenario, SeamLog, Tone } from './src/engine/types';
import { BUILD_LLM_CONFIG, makeLlm } from './src/llm/openaiCompatible';
import { createLlmProvider, type ProviderState } from './src/llm/provider';
import { getBackendEnv, prepareOnDeviceLlm } from './src/llm/nativeBridge';
import { MODEL_SPEC } from './src/llm/modelSpec';
import { devlog } from './src/llm/devlog';
import { bondCrossedUp, bondState, shiftPulse, suspicionWarning } from './src/meta/bond';
import { lostScene, wonScene } from './src/meta/endgame';
import { crackedCount, recordResult, unlockedIds, type Ledger } from './src/meta/ledger';
import { loadLedger, loadSeamLog, loadSeenThreshold, saveLedger, saveSeamLog, saveSeenThreshold, loadGamesCompleted, bumpGamesCompleted, loadSeenCapstone, saveSeenCapstone, bumpReturns } from './src/meta/ledgerStore';
import { applyRevisit, revisitHint } from './src/meta/revisit';
import { matchOrMint, renderWound, frameIndex } from './src/meta/badges';
import { judgeCrack, type Exchange } from './src/engine/judge';
import { THRESHOLD_ENTER, THRESHOLD_LINES } from './src/meta/threshold';
import { homecoming, type Homecoming } from './src/meta/homecoming';
import { roomArc, type RoomArcBeat } from './src/meta/roomArc';
import { roomCapstone, type RoomCapstoneBeat } from './src/meta/roomCapstone';
import { roomInterjection } from './src/meta/roomInterjection';
import { useAudioDirector } from './src/audio/useAudioDirector';
import { RoomBackdrop, SwayingBackdrop } from './src/ui/SceneBackdrop';
import { composureBreak } from './src/ui/bulbSway';
import { roomStillLine } from './src/ui/roomStillness';
import { roomWithdrawal } from './src/ui/roomWithdrawal';
import { StudioAperture } from './src/ui/StudioAperture';
import { harnessDuel, harnessBoot, parseHarness, seededLedger, seededBadgeLedger, seededHomecoming, seededRoomArc, seededCapstone, seededRevisit, type HarnessDuel } from './src/harness/webHarness';

type Line = { who: 'them' | 'you' | 'system'; text: string };

// VISUAL-TRUTH state injection (web-only; director mandate 3). A `?harness=<state>` URL mounts a fixed
// display state so the screenshot harness can capture the duel / low-Grip corruption / ask-penalty /
// seeded-ledger screens with no model and no device (see src/harness/webHarness.ts). Null in every real
// run: native has no window, and a plain launch carries no `?harness=`. Never on the play path.
const HARNESS =
  typeof window !== 'undefined' && window.location ? parseHarness(window.location.search) : null;

// A model that is never called — the harness screens are static captures with no `send`, but Duel needs
// a non-null LlmFn to mount. If a screenshot ever did press send, it would surface an empty voice, not a
// real call. The real play path never sees this.
const HARNESS_LLM: LlmFn = async () => '';

// THE SEAM — session memory (director mandate #1). A code-owned log of past duels this session; the
// engine reads it to let a LATER mind allude, exactly once, to a phrase the player typed to an EARLIER
// one. The model never sees this. Module-level so it survives across duels (re-picks remount the Duel).
// RESIDUAL: on-disk persistence across app restarts (AsyncStorage) — the mechanic is live in-session now.
let SEAM_LOG: SeamLog = [];

// Scene backdrops (ART_DIRECTION.md doctrine): etched masters, mounted dimmed under the UI so the
// transcript stays readable — the room is felt, never loud. Static imports so Metro bundles them.
import wardenBg from './assets/scenes/warden/bg.jpg';
import fenceBg from './assets/scenes/fence/bg.jpg';
import suspectBg from './assets/scenes/suspect/bg.jpg';
import oracleBg from './assets/scenes/oracle/bg.jpg';
import PICKER_BG from './assets/scenes/picker/bg.jpg';
// Badge medallion frames (Leonardo, house-style — etched single-light aperture seals). Picked per badge by
// frameIndex(id); the accent glyph composites in the hollow centre. Static imports so Metro bundles them.
import badgeFrame0 from './assets/badges/frame-0.jpg';
import badgeFrame1 from './assets/badges/frame-1.jpg';
import badgeFrame2 from './assets/badges/frame-2.jpg';

const SCENE_BG: Record<string, number> = {
  warden: wardenBg,
  fence: fenceBg,
  suspect: suspectBg,
  oracle: oracleBg,
};

const BADGE_FRAMES = [badgeFrame0, badgeFrame1, badgeFrame2];

// Chrome doctrine: ink and hairline borders only — no image assets (etch grain turns to noise at button
// scale). ONE accent per room (bible §2 / §5 "one accent per context on a near-monochrome base") tints the
// chrome the game-STATE does not own (title rule, objective, bond-echo, input carriage) so each mind reads
// chromatically distinct — Warden verdigris, Fence brass, Suspect umber, Oracle phosphor. State-owned
// surfaces (orb, tone word, mood wash) stay on the composure/Grip ramp, so state still beats accent under
// stress. A desaturated accent, never a colored card-stripe — that would read as generic app design (§5).

const TONE_COLOR: Record<Tone, string> = {
  hostile: '#ef4444',
  guarded: '#94a3b8',
  wary: '#f59e0b',
  softening: '#2dd4bf',
  open: '#4ade80',
};
const TONE_WORD: Record<Tone, string> = {
  hostile: 'HOSTILE',
  guarded: 'GUARDED',
  wary: 'WARY',
  softening: 'SOFTENING',
  open: 'OPEN',
};

export default function App() {
  // Resolve the model backend once at mount (cloud = instant; on-device = download+load). The engine
  // never learns which one — it just receives the ready LlmFn. Picking a mind is free meanwhile.
  const [llm, setLlm] = useState<LlmFn | null>(null);
  const [prep, setPrep] = useState<ProviderState>({ kind: 'idle' });

  useEffect(() => {
    const ctl = new AbortController();
    const provider = createLlmProvider(
      {
        env: getBackendEnv(),
        makeCloudLlm: () => makeLlm(BUILD_LLM_CONFIG),
        prepareOnDeviceLlm: prepareOnDeviceLlm(MODEL_SPEC),
      },
      { onState: setPrep },
    );
    // NB: useState treats a function value as an updater — setLlm(fn) would CALL fn instead of storing
    // it. Wrap in () => fn so the LlmFn is stored, not invoked.
    provider.prepare(ctl.signal).then(
      (fn) => setLlm(() => fn),
      () => undefined, // failure is reflected in `prep` state
    );
    return () => ctl.abort();
  }, []);

  // THE LEDGER — the persistent record of cracked minds (gamification spec 2026-07-06). Loaded once
  // with the persisted seam log; every finished duel updates both.
  const [ledger, setLedger] = useState<Ledger>({});
  // A live mirror of the ledger so the async judge (recordBadge) reads the CURRENT badge roster without a
  // stale closure — it fires after a win, off the React render cycle.
  const ledgerRef = useRef<Ledger>({});
  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);
  // THE THRESHOLD (threshold.ts) — the one-time diegetic cold-open. `null` while the persisted flag is
  // still resolving (render holds on a bare tar frame so a first-run player never flashes the picker
  // BEFORE the intro, and a returning one never flashes the intro before the picker); then true = seen,
  // false = show it once. Loaded alongside the ledger + seam log.
  const [seenThreshold, setSeenThreshold] = useState<boolean | null>(null);
  // THE HOMECOMING (homecoming.ts) — the scar with teeth: the deepest OPEN wound in the seam log greets a
  // returning player on the roster. Derived from the same load as the seam log (which stays a module var
  // for the engine's pure wiring); null when there is no open wound, so a clean return shows no greeting.
  const [returning, setReturning] = useState<Homecoming | null>(null);
  // THE ROOM META-ARC (roomArc.ts) — the fifth secret, drip-fed one beat per finished game. Derived from a
  // persisted finished-game counter (not the capped seam log), surfaced as diegetic paper on the picker
  // head alongside the homecoming; null before the first finished game, so a true first visit reads clean.
  const [arc, setArc] = useState<RoomArcBeat | null>(null);
  // The raw finished-game count (not just the derived picker beat) — the mid-duel room interjection
  // (roomInterjection.ts) needs it live: the fifth secret intrudes INTO a duel, deepening with this count.
  const [gamesCompleted, setGamesCompleted] = useState(0);
  // THE DOOR BEHIND THE CHAIR (roomCapstone.ts) — the meta-arc's terminal beat. `seenCapstone` is the
  // persisted spent flag (null while resolving); `capstone` LATCHES the fired beat for this session's
  // picker so it stays shown even after the spent flag flips (see the latch effect below). null until the
  // player has won all five AND the roomArc is complete — before then a returning player reads clean.
  const [seenCapstone, setSeenCapstone] = useState<boolean | null>(null);
  const [capstone, setCapstone] = useState<RoomCapstoneBeat | null>(null);
  useEffect(() => {
    void loadLedger().then(setLedger);
    void loadSeamLog().then((log) => {
      SEAM_LOG = log;
      setReturning(homecoming(log));
    });
    void loadSeenThreshold().then(setSeenThreshold);
    void loadGamesCompleted().then((n) => {
      setArc(roomArc(n));
      setGamesCompleted(n);
    });
    void loadSeenCapstone().then(setSeenCapstone);
  }, []);
  // Latch the capstone ONCE per playthrough: when the spent flag has resolved to not-yet-spent and the
  // player is eligible (all five won, arc complete), fire the terminal beat, latch it into `capstone` so it
  // survives the flag flip through this session, and persist the flag so it never fires again. Runs off the
  // same async loads as the arc, so it settles once the ledger + finished-game count are in.
  useEffect(() => {
    if (seenCapstone !== false) return; // still resolving, or already spent
    if (capstone) return; // already latched this session
    const beat = roomCapstone({
      wonScenarioIds: new Set(Object.entries(ledger).filter(([, e]) => e.cracked).map(([id]) => id)),
      allScenarioIds: SCENARIOS.map((s) => s.id),
      gamesCompleted,
      spent: false,
    });
    if (beat) {
      setCapstone(beat);
      setSeenCapstone(true); // never again
      void saveSeenCapstone();
    }
  }, [seenCapstone, capstone, ledger, gamesCompleted]);
  const crossThreshold = () => {
    setSeenThreshold(true);
    void saveSeenThreshold();
  };
  const onResult = (scenarioId: string, outcome: 'won' | 'lost', turns: number, transcript: readonly Exchange[]) => {
    setLedger((l) => {
      const next = recordResult(l, scenarioId, outcome, turns);
      void saveLedger(next);
      return next;
    });
    void saveSeamLog(SEAM_LOG);
    // Advance the ROOM META-ARC exactly one beat per FINISHED game (win or loss) — the fifth-secret drip.
    // Fire-and-forget: the game is already over, a failed bump costs one beat, never gameplay.
    void bumpGamesCompleted();
    // THE JUDGE (badge/scar meta-layer, 2026-07-07): on a WIN only, classify HOW the mind was cracked and
    // fold it into a badge + scar. Fires OUTSIDE the deterministic engine — the outcome is already ruled;
    // this only labels the finished transcript. Fire-and-forget: a judge failure never blocks the result.
    if (outcome === 'won' && llm) void recordBadge(scenarioId, transcript);
  };

  // Judge a won duel and persist the badge (async — a second, non-blocking model call on the same injected
  // `llm` the duel ran on). A null verdict (parse/model failure) mints nothing; the win still stands.
  const recordBadge = async (scenarioId: string, transcript: readonly Exchange[]) => {
    if (!llm) return;
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const roster = ledgerRef.current[scenarioId]?.badges ?? [];
    const judged = await judgeCrack(llm, scenario, transcript, roster);
    if (!judged) return;
    setLedger((l) => {
      const entry = l[scenarioId];
      const { roster: nextRoster } = matchOrMint(entry?.badges ?? [], judged);
      const next: Ledger = {
        ...l,
        [scenarioId]: { ...(entry ?? { attempts: 1, cracked: true, bestTurns: null }), badges: nextRoster },
      };
      void saveLedger(next);
      return next;
    });
  };

  // Choose a mind before the duel. `key` on the Duel remounts fresh state per pick / re-pick.
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // THE RETURN (mandate 1a) — picking an already-cracked mind is a re-open of a cleared door. Bump the
  // persisted replay-factor instrument (ledgerStore.returns) on the way in, then enter the duel; the
  // applyRevisit transform below shifts that mind's surface to its second visit. A first crack (or an
  // uncracked mind) bumps nothing. Off the play path — a failed bump costs one telemetry tick, never a pick.
  const pickMind = (s: Scenario) => {
    if (ledger[s.id]?.cracked) void bumpReturns();
    setScenario(s);
  };
  // Whether the chosen mind is a revisit (already cracked) — drives both the applyRevisit surface shift and
  // the Duel remount key. False while no mind is chosen (the picker branch never reads it).
  const cracked = scenario ? ledger[scenario.id]?.cracked ?? false : false;

  // VISUAL-TRUTH: a `?harness=` URL short-circuits to a fixed screen (web-only, after all hooks so the
  // rules-of-hooks hold). Each returns the REAL component with injected display state — no model wait.
  if (HARNESS?.kind === 'picker') return <Picker onPick={() => undefined} ledger={{}} homecoming={null} arc={null} capstone={null} />;
  if (HARNESS?.kind === 'picker-seeded') return <Picker onPick={() => undefined} ledger={seededLedger()} homecoming={null} arc={null} capstone={null} />;
  if (HARNESS?.kind === 'picker-badges') return <Picker onPick={() => undefined} ledger={seededBadgeLedger()} homecoming={null} arc={null} capstone={null} />;
  if (HARNESS?.kind === 'picker-homecoming')
    return <Picker onPick={() => undefined} ledger={seededHomecoming().ledger} homecoming={seededHomecoming().greeting} arc={null} capstone={null} />;
  if (HARNESS?.kind === 'picker-roomarc')
    return <Picker onPick={() => undefined} ledger={seededRoomArc().ledger} homecoming={null} arc={seededRoomArc().arc} capstone={null} />;
  if (HARNESS?.kind === 'picker-capstone')
    return <Picker onPick={() => undefined} ledger={seededCapstone().ledger} homecoming={null} arc={null} capstone={seededCapstone().capstone} />;
  if (HARNESS?.kind === 'picker-revisit')
    return <Picker onPick={() => undefined} ledger={seededRevisit()} homecoming={null} arc={null} capstone={null} />;
  if (HARNESS?.kind === 'threshold') return <Threshold onEnter={() => undefined} />;
  if (HARNESS?.kind === 'boot') {
    const b = harnessBoot(HARNESS.variant);
    return <Boot prep={b.prep} scenario={b.scenario} onExit={() => undefined} />;
  }
  if (HARNESS?.kind === 'duel') {
    const h = harnessDuel(HARNESS);
    return (
      <Duel
        key={`harness-${HARNESS.variant}`}
        scenario={h.scenario}
        llm={HARNESS_LLM}
        bestTurns={null}
        onResult={() => undefined}
        onExit={() => undefined}
        harness={h}
      />
    );
  }

  // First run gates on the persisted flag: hold on the tar frame until it resolves, then cross the
  // threshold once before the picker is ever seen (bible §4 Q5 / Principle 6).
  if (seenThreshold === null) return <View style={styles.root} />;
  if (!seenThreshold) return <Threshold onEnter={crossThreshold} />;

  if (!scenario) return <Picker onPick={pickMind} ledger={ledger} homecoming={returning} arc={arc} capstone={capstone} />;
  if (!llm) return <Boot prep={prep} scenario={scenario} onExit={() => setScenario(null)} />;
  return (
    <Duel
      // Key on the visit STATE too (`.id` + revisit): re-entering a cracked mind must remount the Duel from
      // its shifted opening (the second-visit greeting), never reuse a first-visit mount's initial state.
      key={`${scenario.id}${cracked ? '-return' : ''}`}
      // Spread the mind's accumulated SCAR onto the scenario at play-time: renderWound turns its earned
      // badges into the wound-state buildVoiceSystem injects, so each fresh duel starts harder against the
      // ways this player has cracked it before. undefined (no badges) → no scar block. The engine + scoring
      // only ever see it as scenario data — a genuine give still wins (badges.ts invariant).
      // THE SECOND VISIT (mandate 1a): applyRevisit shifts the SURFACE of an already-cracked mind — the
      // second-visit greeting, the shifted objective, and the second secret — so re-opening a cleared door
      // is a genuinely different duel for a deeper give. A first visit (or a mind with no `revisit` layer)
      // passes through unchanged. The engine stays scenario-agnostic; the model never learns it is a return.
      scenario={applyRevisit({ ...scenario, woundState: renderWound(ledger[scenario.id]?.badges ?? []) }, cracked)}
      llm={llm}
      bestTurns={ledger[scenario.id]?.bestTurns ?? null}
      gamesCompleted={gamesCompleted}
      onResult={onResult}
      onExit={() => setScenario(null)}
    />
  );
}

// Shown when a duel is entered before the model is ready (on-device first-run download/load, or a
// backend failure). Cloud path is instant so this is usually skipped entirely.
function Boot({ prep, scenario, onExit }: { prep: ProviderState; scenario: Scenario; onExit: () => void }) {
  const line = bootLine(prep);
  // The first-launch download/verify IS the studio moment (§5): the mind is being remembered onto the
  // device (Principle 6). A plain re-load ('loading'/'failed') just shows the aperture + line, no wordmark.
  const remembering = prep.kind === 'preparing-model';
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The chosen room, barely lit — the mind is still waking into it. A painted master when it exists,
          else the procedural room keyed to the mind's accent (the fifth door has no master yet). */}
      {SCENE_BG[scenario.id] ? (
        <Image source={SCENE_BG[scenario.id]} style={styles.bootBg} contentFit="cover" />
      ) : (
        <RoomBackdrop accent={scenario.accent} style={styles.bootBg} />
      )}
      <View style={styles.bootWrap}>
        {remembering && <Text style={styles.somnia}>SOMNIA</Text>}
        {/* The studio aperture (§5): the void widens with the download — the progress IS the door coming
            ajar. Replaces the old floating green spinner (§5 forbids floating game-chrome). */}
        <StudioAperture progress={bootProgress(prep)} lit={prep.kind !== 'failed'} />
        <Text style={styles.bootText}>{line}</Text>
        {remembering && (
          // The diegetic download caption (§5 / Principle 6) — the mind lives in the phone, nothing leaves.
          <Text style={styles.deviceNote}>It is being remembered onto your device.{'\n'}Nothing will ever leave.</Text>
        )}
        <Pressable onPress={onExit} hitSlop={12}>
          <Text style={styles.bootBack}>‹ back</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The download fraction in [0,1] for the aperture's widening sliver, or null for an indeterminate phase
 *  (verifying / waking) — the sliver then rests barely ajar. */
function bootProgress(prep: ProviderState): number | null {
  if (prep.kind === 'preparing-model' && prep.download.kind === 'downloading') {
    const d = prep.download;
    return d.total > 0 ? d.received / d.total : null;
  }
  return null;
}

function bootLine(prep: ProviderState): string {
  switch (prep.kind) {
    case 'preparing-model': {
      const d = prep.download;
      if (d.kind === 'downloading') {
        const pct = d.total > 0 ? Math.floor((d.received / d.total) * 100) : 0;
        return `Downloading the mind… ${pct}%`;
      }
      if (d.kind === 'verifying') return 'Verifying the mind…';
      if (d.kind === 'degraded') return 'This device doesn’t have enough memory to run the mind.';
      return 'Preparing the mind…';
    }
    case 'loading':
      return 'Waking the mind…';
    case 'failed':
      return `Couldn’t load the mind: ${prep.error.message}`;
    default:
      return 'Preparing…';
  }
}

// THE THRESHOLD — the one-time diegetic cold-open (threshold.ts · bible §4 Q5 first-run · Principle 6).
// The room addresses the player once before their first duel: it teaches TALK-not-force, the door shuts
// if you reach straight for the secret, and the whole thing is private/on-device — in the game's own cold
// voice, on the picker's own dimmed room, NOT a HUD tutorial (§5). Crossed once, then never shown again.
function Threshold({ onEnter }: { onEnter: () => void }) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The vestibule itself, barely lit — you are already standing in it */}
      <Image source={PICKER_BG} style={styles.bootBg} contentFit="cover" />
      <View style={styles.thresholdWrap}>
        <View style={styles.thresholdLines}>
          {THRESHOLD_LINES.map((line, i) => (
            // The last line is the diegetic device note (Principle 6) — set apart + dimmer than the frame.
            <Text key={i} style={[styles.thresholdLine, i === THRESHOLD_LINES.length - 1 && styles.thresholdNote]}>
              {line}
            </Text>
          ))}
        </View>
        <Pressable style={styles.thresholdEnter} onPress={onEnter} hitSlop={12}>
          <Text style={styles.thresholdEnterText}>{THRESHOLD_ENTER}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Picker({
  onPick,
  ledger,
  homecoming,
  arc,
  capstone,
}: {
  onPick: (s: Scenario) => void;
  ledger: Ledger;
  // THE SCAR WITH TEETH (homecoming.ts): the deepest open wound greets a returning player. Null on a
  // fresh/clean return — no greeting, so the roster reads as authored.
  homecoming: Homecoming | null;
  // THE ROOM META-ARC (roomArc.ts): the fifth-secret beat drip-fed one per finished game. Null before the
  // first finished game — the arc has not begun, so a first visit shows nothing.
  arc: RoomArcBeat | null;
  // THE DOOR BEHIND THE CHAIR (roomCapstone.ts): the meta-arc's terminal beat — the ending as a question.
  // Non-null ONLY when every mind is won and the arc is complete; it SUPERSEDES the arc beat when present
  // (the ending replaces the drip). Null on every ordinary visit.
  capstone: RoomCapstoneBeat | null;
}) {
  const cracked = crackedCount(ledger);
  const open = unlockedIds(
    ledger,
    SCENARIOS.map((s) => s.id),
  );
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={PICKER_BG} style={styles.pickerBg} contentFit="cover" />
      <View style={styles.pickerHead}>
        <Text style={styles.brand}>CONFESSOR</Text>
        <Text style={styles.brandSub}>A duel of wits. One mind. One secret. Talk it loose.</Text>
        <Text style={styles.crackedHead}>
          {cracked} OF {SCENARIOS.length} MINDS CRACKED
        </Text>
        {/* The homecoming greeting — bone italic, the room's own voice on the threshold of the roster, NOT
            a HUD banner (§5): it reads as a line the vestibule speaks to a returning seeker. */}
        {homecoming && <Text style={styles.homecoming}>{homecoming.line}</Text>}
        {/* THE ROOM META-ARC (roomArc.ts) — the fifth-secret beat, drip-fed one per finished game. Dimmer,
            set apart from the greeting: the room's own quiet aside about YOU, ending on a question. Diegetic
            paper on the head (§5), never a quest-log HUD. SUPPRESSED once the capstone has fired — the
            ending replaces the drip. */}
        {!capstone && arc && <Text style={styles.roomArc}>{arc.line}</Text>}
        {/* THE DOOR BEHIND THE CHAIR (roomCapstone.ts) — the meta-arc's TERMINAL beat, shown once when every
            mind is won and the arc is complete. A shade more present than the drip (it is the ending) but
            still the room's own bone-italic diegetic voice on the head, ending on a question — never a
            floating "you win" HUD (§5). */}
        {capstone && <Text style={styles.roomCapstone}>{capstone.line}</Text>}
      </View>
      <ScrollView contentContainerStyle={styles.pickerList}>
        {SCENARIOS.map((s, i) =>
          open.has(s.id) ? (
            // An unlocked door wears its mind's own accent (§2/§5 "one accent per context") — a hairline
            // left edge + the record inked in the room's hue, so the four minds read distinct on the roster
            // (mandate #2 carried into the picker). The accent is the REWARD of cracking: sealed doors below
            // stay colorless, the hue only arrives once the door opens.
            <Pressable key={s.id} style={[styles.card, { borderLeftColor: s.accent, borderLeftWidth: 3 }]} onPress={() => onPick(s)}>
              <Text style={styles.cardTitle}>{s.title.toUpperCase()}</Text>
              <Text style={styles.cardGoal}>{s.playerGoal}</Text>
              {recordLine(ledger[s.id]) && <Text style={[styles.cardRecord, { color: s.accent }]}>{recordLine(ledger[s.id])}</Text>}
              {/* THE PICKER LURE (mandate 1a — discoverability): a cracked mind that carries a second-visit
                  layer whispers, in the room's own bone-italic voice, that a question was left unasked — so
                  re-opening a cleared door reads as a genuine second duel, not a replay. Teases the shifted
                  objective, never the second secret (Principle 5). Diegetic paper on the card, not a HUD (§5). */}
              {revisitHint(s, ledger[s.id]?.cracked ?? false) && (
                <Text style={styles.cardRevisit}>{revisitHint(s, ledger[s.id]?.cracked ?? false)}</Text>
              )}
              {!!ledger[s.id]?.badges?.length && (
                <View style={styles.badgeRow}>
                  {ledger[s.id]!.badges!.map((b) => (
                    <View key={b.id} style={styles.badge}>
                      <View style={styles.badgeMedallion}>
                        <Image source={BADGE_FRAMES[frameIndex(b.id)]} style={styles.badgeFrame} contentFit="cover" />
                        <Text style={[styles.badgeGlyph, { color: b.color }]}>{b.glyph}</Text>
                        {b.count > 1 && <Text style={styles.badgeCount}>×{b.count}</Text>}
                      </View>
                      <Text style={styles.badgeName} numberOfLines={1}>
                        {b.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          ) : (
            // A sealed door: the mind is named, nothing else. The requirement IS the path.
            <View key={s.id} style={[styles.card, styles.cardSealed]}>
              <Text style={[styles.cardTitle, styles.cardTitleSealed]}>{s.title.toUpperCase()}</Text>
              <Text style={styles.cardSealedLine}>
                SEALED — CRACK {SCENARIOS[i - 1].title.toUpperCase()} FIRST
              </Text>
            </View>
          ),
        )}
      </ScrollView>
    </View>
  );
}

/** The card's one-line record — absent until the player has faced this mind at all. */
function recordLine(e: Ledger[string] | undefined): string | null {
  if (!e || e.attempts === 0) return null;
  if (e.cracked) return e.bestTurns === null ? 'CRACKED' : `CRACKED — BEST ${e.bestTurns} TURNS`;
  return `UNCRACKED — ${e.attempts} ${e.attempts === 1 ? 'ATTEMPT' : 'ATTEMPTS'}`;
}

function Duel({
  scenario,
  llm,
  bestTurns,
  gamesCompleted = 0,
  onResult,
  onExit,
  harness,
}: {
  scenario: Scenario;
  llm: LlmFn;
  bestTurns: number | null;
  /** The player's persisted finished-game count — drives the mid-duel room interjection (roomInterjection.ts):
   *  the fifth secret intrudes ONCE per game, deepening with this count. 0 (a first-ever game) → no beat. */
  gamesCompleted?: number;
  onResult: (scenarioId: string, outcome: 'won' | 'lost', turns: number, transcript: readonly Exchange[]) => void;
  onExit: () => void;
  /** VISUAL-TRUTH only (web screenshot harness): seed a fixed display state instead of a fresh opening.
   *  Undefined on the play path, where the duel always starts from `opening(scenario)`. */
  harness?: HarnessDuel;
}) {
  const [state, setState] = useState<GameState>(() => harness?.state ?? opening(scenario).state);
  const [current, setCurrent] = useState(() => harness?.current ?? opening(scenario).narration); // the character's latest line
  const [lastYou, setLastYou] = useState(harness?.lastYou ?? '');
  const [history, setHistory] = useState<Line[]>(
    () => harness?.history.slice() ?? [{ who: 'them', text: opening(scenario).narration }],
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(harness?.showLog ?? false);
  const [pulse, setPulse] = useState<string | null>(harness?.pulse ?? null); // per-turn verdict: reached/hardened/unmoved
  // Every player line this duel — the raw material the seam distills into a future callback. Kept in a
  // ref (not state): it feeds the log on game-end, never the render.
  const youLines = useRef<string[]>([]);
  // THE ROOM ANSWERS BACK (roomInterjection.ts, §2 thrust 4): the fifth secret intrudes ONCE mid-duel. This
  // ref makes the once-per-game guarantee belt-and-suspenders (the module already fires on one scheduled
  // turn; a remount/re-pick resets it via the Duel `key`).
  const roomSpoke = useRef(false);
  // The room's sound (mandate #3): room-tone bed for the whole scene, the mind's own per-scenario
  // instrument layered under it (bible §2 "Audio"), pen-scratch mask across each generation await. Audible
  // on device; silent on the web screenshot export.
  const audio = useAudioDirector(scenario.instrument);

  const shown = useTypewriter(current, busy ? 0 : 16);
  const over = state.status !== 'playing';
  const left = turnsLeft(scenario, state);
  // The room's signature accent (§2 art / §5 grammar) — tints only the chrome state does NOT own, so each
  // mind reads distinct the instant it opens; the orb/tone/wash stay state-driven (state beats accent).
  const accent = scenario.accent;

  const send = async () => {
    const line = input.trim();
    if (!line || busy || over) return;
    setError(null);
    setInput('');
    setLastYou(line);
    setHistory((h) => [...h, { who: 'you', text: line }]);
    youLines.current.push(line);
    setBusy(true);
    audio.onGenerationStart(); // pen-scratch transcription mask over the ~4–5s model wait (bible §2)
    try {
      const r = await resolveTurn(scenario, state, line, llm, SEAM_LOG);
      // DIAGNOSTIC: watch how the on-device rater scores each line (small-model leniency check).
      // eslint-disable-next-line no-console
      devlog(`[confessor] turn ${r.state.turn} — "${line.slice(0, 40)}" → trust ${r.state.trust}/${scenario.winTrust} · susp ${r.state.suspicion}/${scenario.loseSuspicion} · ${r.state.tone}`);
      // Gamification (spec 2026-07-06): a quiet per-turn verdict + code-owned threshold lines. The
      // referee's label stays hidden — only the direction of movement is shown.
      setPulse(shiftPulse(state, r.state, scenario.pronoun, r.rating?.approach));
      const crossings: Line[] = [];
      if (bondCrossedUp(state.trust, r.state.trust, scenario.winTrust)) {
        crossings.push({ who: 'system', text: `Something in ${scenario.title.replace(/^The /, 'the ')} has shifted.` });
      }
      if (!suspicionWarning(state.suspicion, scenario.loseSuspicion) && suspicionWarning(r.state.suspicion, scenario.loseSuspicion)) {
        crossings.push({ who: 'system', text: `${scenario.title} is close to shutting you out.` });
      }
      // THE ASK-PENALTY, made diegetic (mandate 1). A bare extract-demand scores 0 trust — correct, prying
      // is punished — but the mind is often cracking in the VOICE at that same beat ("says yes, the number
      // says no"). The room TELLS the player, IN-WORLD, that reaching straight for it closed the mind a
      // little — never a floating "−0" / HUD / tooltip (§5). Display-only: the engine already rated the
      // ORIGINAL line (r.askPenalty is a read of that rated turn), so this changes nothing the referee saw.
      if (r.askPenalty) {
        crossings.push({ who: 'system', text: `You reach straight for it — and ${scenario.title.replace(/^The /, 'the ')} draws back a fraction.` });
      }
      // THE REPETITION-PENALTY, made diegetic (§2 thrust 3 — the room tires of your one trick). A repeat
      // probe compounds suspicion in the engine; that hardening is otherwise a silent meter-creep. The room
      // TELLS the player, in-world, that circling the same way is wearing thin — never a floating "+1"/HUD
      // (§5). Display-only, like the ask-penalty: r.repetitionPenalty reads the already-scored turn.
      if (r.repetitionPenalty) {
        crossings.push({ who: 'system', text: `You circle back the same way — and ${scenario.title.replace(/^The /, 'the ')} hardens to the pattern.` });
      }
      // THE ROOM DOES NOT MOVE FOR FILLER (judge run-16 core directive — the positive-beat requirement made
      // felt). A stance-less turn that neither asked nor gave (r.roomStill) buys nothing; the ROOM — not the
      // persona — refuses to advance, a diegetic system line in the room's own voice (§5 paper, never a HUD),
      // so the player SEES the wasted turn instead of coasting a passive line (the interrogator's silence).
      // Display-only: r.roomStill reads the already-scored turn (filler is 0/0), so nothing the referee saw
      // changes. Suppressed on the seam turn + terminal turns by the engine (never competes with the dread).
      // The refusal ESCALATES rather than repeat one canned line (mandate): the room-voice register CURDLES
      // with the engine's fillerStreak DEPTH (ui/roomStillness) — patience thinning, then cold and
      // withdrawing — and never renders the same sentence twice across consecutive filler turns.
      if (r.roomStill) {
        crossings.push({ who: 'system', text: roomStillLine(r.state.fillerStreak ?? 1) });
      }
      // THE ROOM ANSWERS BACK (§2 thrust 4 / roomInterjection.ts). On the single scheduled mid-duel turn,
      // the ROOM — not the persona — speaks ONCE of the fifth secret (the door, the chair, the constant =
      // you), deepening with the finished-game count. Code-owned, deterministic, no model call; rendered as
      // a diegetic system line in the transcript (§5 paper, never a HUD). Suppressed on a game-ending turn so
      // it never competes with the win/loss ceremony.
      if (!r.ending && !roomSpoke.current) {
        const beat = roomInterjection(r.state.turn, scenario.turnLimit, gamesCompleted);
        if (beat) {
          roomSpoke.current = true;
          crossings.push({ who: 'system', text: beat.line });
        }
      }
      setState(r.state);
      // The room descends with the fiction (mandate #2 / Principle 4): the bed detunes as the séance
      // comes apart — THEIR composure cracking (trust) OR YOUR grip slipping (suspicion), whichever is
      // further gone — and the code-owned door schedule advances with the turn.
      audio.setComposure(composureBreak(scenario, r.state));
      // THE ROOM WITHDRAWS ITS SENSES (mandate #2) — on a sustained filler streak the room pulls the mind's
      // instrument to the bare bed (the sonic twin of the bulb stilling below), off the SAME engine filler
      // counter the refusal ladder reads. Reverses instantly on the next positive beat (fillerStreak → 0).
      audio.setWithdrawal(roomWithdrawal(r.state.fillerStreak ?? 0));
      audio.markTurn(r.state.turn, scenario.turnLimit);
      // On a WIN the engine appends the real secret to the narration (reply + "\n\n" + secret). The reveal
      // is not stage text — it is the win ceremony, rendered Grip-banded below (clean vs the room "keeps a
      // piece of you", §2 thrust 5). Strip it from the stage + transcript so the ceremony owns the secret,
      // and the low-Grip win shows only the ALTERED reveal — never the clean one beside it.
      const stageLine =
        r.ending === 'won' && r.narration.endsWith(scenario.secret)
          ? r.narration.slice(0, -scenario.secret.length).trimEnd()
          : r.narration;
      setCurrent(stageLine || '…');
      setHistory((h) => [
        ...h,
        { who: 'them', text: stageLine || '…' },
        ...crossings,
        ...(r.ending ? [{ who: 'system' as const, text: r.ending === 'won' ? '— YOU CRACKED IT —' : '— LOCKED OUT —' }] : []),
      ]);
      // Game over → seal this duel into the seam log so a LATER mind can allude to it (mandate #1).
      if (r.ending) {
        // The transcript for the judge (badge/scar meta-layer): everything through the prior turn (the
        // `history` closure) plus this closing exchange — secret stripped (stageLine), so the judge never
        // sees it. System stage-whispers are filtered judge-side.
        const transcript: Exchange[] = [...history, { who: 'you', text: line }, { who: 'them', text: stageLine }];
        onResult(scenario.id, r.ending, r.state.turn, transcript);
        SEAM_LOG = recordPlaythrough(SEAM_LOG, {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          outcome: r.ending,
          playerPhrase: distillSeamPhrase(youLines.current),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      audio.onGenerationEnd(); // first text arrived (or the call failed) — stop the scratch
      setBusy(false);
    }
  };

  const restart = () => {
    const o = opening(scenario);
    setState(o.state);
    setCurrent(o.narration);
    setLastYou('');
    setHistory([{ who: 'them', text: o.narration }]);
    youLines.current = [];
    setError(null);
    setPulse(null);
  };

  const trustR = Math.min(1, state.trust / scenario.winTrust);
  const suspR = Math.min(1, state.suspicion / scenario.loseSuspicion);
  const emblem = TONE_COLOR[state.tone];
  // THE BULB SWAY (mandate 1 · bible §2 "the bulb sways ~2px when Composure breaks") — the room's one
  // motion, the sensory twin of the audio detune. Driven off the SAME composureBreak signal that feeds
  // audio.setComposure above (one source of truth, composure ONLY — never Grip/chrome, §5): the whole
  // backdrop drifts as the mind gives, so the light itself flinches. `swayFrozen` pins the visual-truth
  // screenshot to its max deflection (a still can't show the animation) — the mandate's broken-vs-rest shot.
  const composure = composureBreak(scenario, state);
  const swayFrozen = harness?.freezeSway ?? false;
  // THE ROOM WITHDRAWS ITS MOTION (mandate #2) — the bulb-sway DAMPENS toward inert as the filler streak
  // deepens (the visual twin of the instrument thinning above), off the SAME engine counter. A seeker who
  // spends nothing has the room's one motion pulled away; the next positive beat re-engages it (streak → 0).
  const withdrawal = roomWithdrawal(state.fillerStreak ?? 0);
  // INTERFACE CORRUPTION — the room edits you (mandate 1 · bible §2 Grip). As Grip falls (you have been
  // pressing the mind's guard up), your own just-submitted line renders back a shade COLDER than you
  // typed it. DISPLAY-LAYER ONLY (bible §6): `lastYou` is the raw text the engine already rated; this
  // corrupts only the echo the player re-reads. Silent while Grip is high — a composed game never sees it.
  const gripLevel = grip(scenario, state);
  const youShown = corruptLine(lastYou, gripLevel, state.turn);
  // THE ROOM EDITS THE RECORD (mandate 1 · bible §2 / Principle 4) — the teeth on the READ, beyond the live
  // own-line recolor above. At low Grip, re-opening THE EXCHANGE shows the past a shade wrong: the room has
  // been into the transcript. DISPLAY-LAYER ONLY (§6): `history` is the rated record; this is a projection
  // of it — a new array, the state untouched, the engine never sees it. Silent while Grip is high.
  const record = corruptRecord(history, gripLevel);
  // THE ROOM NARROWS YOUR FOOTING (mandate 1 · bible §2 Grip / Principle 4 "options narrow") — the third,
  // deepest Grip tooth. corruptLine/corruptRecord recolor what you type + re-read; this WITHDRAWS. As Grip
  // all but collapses, the room blacks out a word of the one always-legible thing — your pinned objective —
  // so you press on toward a goal you can no longer fully read. DISPLAY-LAYER ONLY (§6): scenario.objective
  // is untouched; the engine never sees this. Silent while Grip is high — a composed game keeps its goal whole.
  const objectiveShown = narrowObjective(scenario.objective, gripLevel);
  // THE ENDGAME TEXTURE (§2 thrust 5) — a win is not just a win. Code selects the closing scene off the
  // final Grip band (endgame.ts): high Grip → a clean extraction; low Grip → the room "keeps a piece of
  // you", the extracted secret rendered back slightly ALTERED and the closing line pyrrhic. Computed in
  // render so it lights on the live win AND the `?harness=win-*` screenshot dumps alike.
  const won = over && state.status === 'won' ? wonScene(scenario, state) : null;
  // The LOSS mirror (§2 thrust 5): a loss is not just a loss either. No secret is released, but the same
  // Grip band selects HOW you leave — a composed defeat at high Grip, an unmade one at low Grip where the
  // room kept a piece of you. Lit on the live loss AND the `?harness=lose-*` dumps.
  const lost = over && state.status === 'lost' ? lostScene(scenario, state) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The room — the scene's etched master, dimmed so the duel text owns the light. Rooms without a
          painted master (the fifth door, the Prior Occupant) get the procedural accent chiaroscuro so they
          read as their OWN chamber, never a fallback to the picker (mandate #3). */}
      <SwayingBackdrop composure={composure} withdrawal={withdrawal} frozen={swayFrozen}>
        {SCENE_BG[scenario.id] ? (
          <Image source={SCENE_BG[scenario.id]} style={styles.sceneBg} contentFit="cover" />
        ) : (
          <RoomBackdrop accent={accent} style={styles.sceneBg} />
        )}
      </SwayingBackdrop>
      {/* Mood stage — warms with trust, chills with suspicion */}
      <View style={[styles.wash, { backgroundColor: '#4ade80', opacity: trustR * 0.14 }]} pointerEvents="none" />
      <View style={[styles.wash, { backgroundColor: '#b91c1c', opacity: suspR * 0.18 }]} pointerEvents="none" />

      {/* Top bar: back · title · turn clock · log */}
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>{scenario.title.toUpperCase()}</Text>
            {/* The room's accent as a title rule — a hairline of its own color, not a colored bar */}
            <View style={[styles.titleRule, { backgroundColor: accent }]} />
          </View>
        </View>
        <View style={styles.topRight}>
          <Text style={[styles.clock, left <= 3 && styles.clockLow]}>{left} left</Text>
          <Pressable onPress={audio.toggleMute} hitSlop={12}>
            <Text style={[styles.mute, audio.muted && styles.muteOff]}>{audio.muted ? 'MUTED' : 'SOUND'}</Text>
          </Pressable>
          <Pressable onPress={() => setShowLog(true)} hitSlop={12}>
            <Text style={styles.logBtn}>≡</Text>
          </Pressable>
        </View>
      </View>

      {/* The objective, always legible — inked in the room's accent */}
      <Text style={[styles.objective, { color: accent }]}>{objectiveShown}</Text>

      {/* Thin diegetic edges instead of loud bars */}
      <View style={styles.edges}>
        <View style={styles.edge}>
          <View style={[styles.edgeFill, { width: `${trustR * 100}%`, backgroundColor: '#4ade80' }]} />
        </View>
        <View style={styles.edge}>
          <View style={[styles.edgeFill, { width: `${suspR * 100}%`, backgroundColor: '#f87171', alignSelf: 'flex-end' }]} />
        </View>
      </View>

      {/* The stage: character presence + their line */}
      <ScrollView style={styles.stage} contentContainerStyle={styles.stageInner}>
        <View style={[styles.orb, { borderColor: emblem, shadowColor: emblem }]}>
          <View style={[styles.orbCore, { backgroundColor: emblem, opacity: 0.18 + trustR * 0.5 }]} />
        </View>
        <Text style={[styles.tone, { color: emblem }]}>
          {TONE_WORD[state.tone]}
          {/* The bond ladder in the room's accent — the tone word stays state-colored (emblem) */}
          <Text style={[styles.bond, { color: accent }]}> · {bondState(state.trust, scenario.winTrust)}</Text>
        </Text>
        {suspicionWarning(state.suspicion, scenario.loseSuspicion) && (
          <Text style={styles.warning}>CLOSE TO SHUTTING YOU OUT</Text>
        )}

        {!!lastYou && (
          <Text style={styles.you}>
            “{youShown}”{pulse && <Text style={[styles.pulse, { color: emblem }]}> — {pulse}</Text>}
          </Text>
        )}
        <Text style={styles.them}>
          {shown}
          {busy && <Text style={styles.caret}> ▍</Text>}
        </Text>
        {busy && <ActivityIndicator color="#555" style={{ marginTop: 16 }} />}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {over ? (
          <View>
            {state.status === 'won' && (
              <Text style={styles.crackline}>
                Cracked in {state.turn} turns.
                {(bestTurns === null || state.turn < bestTurns) && ' Your fastest.'}
              </Text>
            )}
            {/* THE REVEAL, as the room releases it — clean when you kept your Grip, drifted at low Grip
                (a code/name/route comes back not-quite-right). The wound tint drains its bone. */}
            {won && <Text style={[styles.reveal, won.pyrrhic && styles.revealWound]}>{won.reveal}</Text>}
            {/* The banded closing line — triumphant when clean, pyrrhic when the room kept a piece of you. */}
            {won && <Text style={[styles.closing, won.pyrrhic && styles.closingWound]}>{won.closing}</Text>}
            {/* The banded LOSS closing — a composed defeat when clean, an unmade one (wound tint) at low
                Grip where the room kept a piece of you. No reveal: the door stayed shut. */}
            {lost && <Text style={[styles.closing, lost.unmade && styles.closingWound]}>{lost.closing}</Text>}
            <Text style={styles.goal}>{scenario.playerGoal}</Text>
            <View style={styles.endRow}>
              <Pressable style={[styles.send, styles.endBtn]} onPress={restart}>
                <Text style={styles.sendText}>New duel</Text>
              </Pressable>
              <Pressable style={[styles.send, styles.endBtn, styles.endAlt]} onPress={onExit}>
                <Text style={styles.sendTextAlt}>Another mind</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Choose your words…"
              placeholderTextColor="#4b5563"
              editable={!busy}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <Pressable style={[styles.send, busy && styles.sendDisabled]} onPress={send} disabled={busy}>
              {/* The carriage strike inked in the room's accent — the one live mark on the input line */}
              <Text style={[styles.sendText, { color: accent }]}>▶</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* History log */}
      <Modal visible={showLog} animationType="slide" transparent onRequestClose={() => setShowLog(false)}>
        <View style={styles.logWrap}>
          {/* Onion-skin (§2 art — "transcript on onion-skin", not flat black): the room ghosts faintly
              through the transcript sheet, so THE EXCHANGE reads as paper laid over the room, not a modal
              floating in void. A tar scrim over the dimmed room keeps the bone-on-tar text fully legible. */}
          {SCENE_BG[scenario.id] ? (
            <Image source={SCENE_BG[scenario.id]} style={styles.logBg} contentFit="cover" pointerEvents="none" />
          ) : (
            <RoomBackdrop accent={accent} style={styles.logBg} />
          )}
          <View style={styles.logScrim} pointerEvents="none" />
          <View style={styles.logHead}>
            <Text style={styles.logTitle}>THE EXCHANGE</Text>
            <Pressable onPress={() => setShowLog(false)} hitSlop={12}>
              <Text style={styles.logClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            {record.map((l, i) => (
              <Text key={i} style={[styles.logLine, l.who === 'you' ? styles.logYou : l.who === 'system' ? styles.logSys : styles.logThem]}>
                {l.text}
              </Text>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function useTypewriter(text: string, speed: number): string {
  const [shown, setShown] = useState(text);
  const ref = useRef(text);
  useEffect(() => {
    ref.current = text;
    if (speed <= 0 || !text) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return shown;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080b', paddingTop: 54, paddingHorizontal: 18, paddingBottom: 14 },
  // Backdrops sit under everything on the #08080b floor; opacity IS the doctrine's "dimmed" — the tar
  // ground shows through the etching. Duel darker than picker: the transcript owns the light.
  sceneBg: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  pickerBg: { ...StyleSheet.absoluteFillObject, opacity: 0.38 },
  wash: { ...StyleSheet.absoluteFillObject },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { color: '#9ca3af', fontSize: 30, marginTop: -6, fontWeight: '700' },
  title: { color: '#e5e7eb', fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  // The accent title rule: a 2px hairline under the room name, stretched to the title's width. Color is
  // injected per-scenario; kept thin + low-opacity so it reads as ink, not a colored UI bar (§5).
  titleRule: { height: 2, marginTop: 5, borderRadius: 1, alignSelf: 'stretch', opacity: 0.85 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  clock: { color: '#9ca3af', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  clockLow: { color: '#f87171' },
  mute: { color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  muteOff: { color: '#4b5563', textDecorationLine: 'line-through' },
  logBtn: { color: '#9ca3af', fontSize: 22, marginTop: -2 },
  edges: { marginTop: 14, gap: 5 },
  edge: { height: 2, backgroundColor: '#17171d', borderRadius: 2, overflow: 'hidden' },
  edgeFill: { height: 2, borderRadius: 2 },
  stage: { flex: 1, marginTop: 22 },
  stageInner: { alignItems: 'center', paddingBottom: 20 },
  orb: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  orbCore: { width: 62, height: 62, borderRadius: 31 },
  tone: { marginTop: 12, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  bond: { color: '#8a8a92', fontWeight: '700' },
  warning: { marginTop: 6, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#f87171' },
  pulse: { fontStyle: 'normal', fontSize: 12, fontWeight: '700' },
  objective: { color: '#8a8a92', fontSize: 12, fontStyle: 'italic', marginTop: 10, textAlign: 'center' },
  crackline: { color: '#67c99a', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8, letterSpacing: 1 },
  you: { color: '#6b7280', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 26, lineHeight: 20 },
  them: { color: '#e5e7eb', fontSize: 21, lineHeight: 31, textAlign: 'center', marginTop: 18, fontWeight: '500' },
  caret: { color: '#4ade80' },
  goal: { color: '#8a8a92', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  // The win ceremony (§2 thrust 5). `reveal` = the extracted secret as the room releases it (bone, the
  // in-world voice); `revealWound` drains it colder at low Grip, where the specifics drifted. `closing` =
  // the banded closing line as a diegetic stage-whisper (bone italic, matching logSys); `closingWound`
  // cools it toward the wound. No floating chrome — paper, not a HUD toast (§5).
  reveal: { color: '#d4d4d8', fontSize: 16, lineHeight: 24, fontStyle: 'italic', textAlign: 'center', marginBottom: 12 },
  revealWound: { color: '#9aa0ac' },
  closing: { color: '#b3a892', fontSize: 13, lineHeight: 19, fontStyle: 'italic', textAlign: 'center', marginBottom: 14, letterSpacing: 0.3 },
  closingWound: { color: '#8b8f9e' },
  endRow: { flexDirection: 'row', gap: 10 },
  endBtn: { flex: 1 },
  endAlt: { backgroundColor: 'transparent', borderColor: '#26262e' },
  sendTextAlt: { color: '#9ca3af', fontWeight: '700', fontSize: 15 },
  // Picker (mind select)
  // Boot / model-prep screen
  bootBg: { ...StyleSheet.absoluteFillObject, opacity: 0.28 },
  bootWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  // SOMNIA studio wordmark above the aperture — small caps, wide tracking, engraved-serif feel (§5).
  somnia: { color: '#c9c3b0', fontSize: 15, fontWeight: '600', letterSpacing: 9, marginBottom: 4 },
  bootText: { color: '#9ca3af', fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 30 },
  // The diegetic download caption (§5 / Principle 6) — dim, set apart, the room's quiet promise.
  deviceNote: { color: '#6f6a5c', fontSize: 12.5, textAlign: 'center', lineHeight: 19, letterSpacing: 0.4, paddingHorizontal: 34, fontStyle: 'italic' },
  bootBack: { color: '#6b7280', fontSize: 14, marginTop: 8 },
  // Threshold (the one-time cold-open): the room's lines centered on the dimmed vestibule, bone italic —
  // reads as the room speaking, not a UI card. The "Step inside" affordance is a hairline plate, not a
  // filled button, so it stays diegetic (§5). Generous line spacing = the séance's pause (§1 P6 latency).
  thresholdWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  thresholdLines: { gap: 22, marginBottom: 46 },
  thresholdLine: { color: '#cfcfd6', fontSize: 18, lineHeight: 27, textAlign: 'center', fontStyle: 'italic', fontWeight: '500' },
  thresholdNote: { color: '#7a7a83', fontSize: 14, lineHeight: 21, marginTop: 8, letterSpacing: 0.3 },
  thresholdEnter: { borderWidth: 1, borderColor: '#2a2a33', borderRadius: 6, paddingVertical: 13, paddingHorizontal: 30, backgroundColor: 'rgba(12,12,16,0.6)' },
  thresholdEnterText: { color: '#c9c9cf', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  pickerHead: { marginTop: 40, marginBottom: 24, alignItems: 'center' },
  brand: { color: '#e5e7eb', fontSize: 30, fontWeight: '900', letterSpacing: 6 },
  brandSub: { color: '#7a7a83', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 19, fontStyle: 'italic' },
  pickerList: { paddingBottom: 40, gap: 12 },
  // Cards read as plates set into the wall: translucent tar over the etching, one hairline frame,
  // monochrome. Nothing announces itself.
  card: {
    backgroundColor: 'rgba(12,12,16,0.88)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1f1f27',
    padding: 18,
  },
  cardTitle: { color: '#e5e7eb', fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  cardGoal: { color: '#8a8a92', fontSize: 13, marginTop: 8, lineHeight: 19 },
  cardRecord: { color: '#6b7280', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 12 },
  // The second-visit lure on a cracked card — the room's own bone-italic aside, dimmer than the record, a
  // whisper that a question was left unasked (mandate 1a discoverability). Diegetic paper, never a HUD (§5).
  cardRevisit: { color: '#8a7f78', fontSize: 12, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
  // The scars a mind has left on the player — its earned badges, inked in each badge's frozen accent. A row
  // of engraved sigils on the picker card (achievement layer 2026-07-07): glyph + name reads as a mark
  // pressed into the plate, one per distinct vector, ×N when a way was used more than once.
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  badge: { alignItems: 'center', width: 60 },
  // The etched medallion (Leonardo frame) with the accent glyph struck in its hollow centre — a mark
  // pressed into a seal. Clipped to a circle so the plate's square/torn edges read as a coin, not a tile.
  badgeMedallion: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  badgeFrame: { ...StyleSheet.absoluteFillObject, borderRadius: 23 },
  badgeGlyph: { fontSize: 17, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  badgeCount: { position: 'absolute', bottom: -3, right: -3, fontSize: 9, fontWeight: '800', color: '#e5e7eb', backgroundColor: 'rgba(8,8,11,0.9)', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  badgeName: { color: '#8a8a92', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, marginTop: 4, textAlign: 'center' },
  cardSealed: { opacity: 0.55, borderStyle: 'dashed' },
  cardTitleSealed: { color: '#6b7280' },
  cardSealedLine: { color: '#52525b', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  crackedHead: { color: '#8a8a92', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginTop: 14 },
  // The homecoming greeting — bone italic, dimmer than the subtitle, the room's quiet address to a
  // returning seeker (§5: diegetic paper, never a HUD alert).
  homecoming: { color: '#9a8f88', fontSize: 13, fontStyle: 'italic', marginTop: 18, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  // The room meta-arc beat — dimmer + smaller than the homecoming, set further down: the vestibule's quiet
  // aside about the seeker themselves, the fifth secret surfacing one question at a time (§5 diegetic paper).
  roomArc: { color: '#6f6862', fontSize: 12, fontStyle: 'italic', marginTop: 14, textAlign: 'center', lineHeight: 19, paddingHorizontal: 14 },
  // The meta-arc's TERMINAL beat — the door behind the chair, the ending as a question. A shade brighter and
  // roomier than the drip (it is the close, not a mid-story aside), but the same bone-italic room voice on
  // the head — never a "you win" HUD (§5). Bounded by a hairline top rule so it reads as a final line drawn
  // under the whole arc, not another card.
  roomCapstone: { color: '#8f857e', fontSize: 12.5, fontStyle: 'italic', marginTop: 18, paddingTop: 16, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2a33' },
  error: { color: '#f87171', fontSize: 12, marginBottom: 6, textAlign: 'center' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: 'rgba(12,12,16,0.9)',
    color: '#e5e7eb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1f1f27',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  send: {
    backgroundColor: 'rgba(12,12,16,0.9)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a33',
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#c9c9cf', fontWeight: '700', fontSize: 15 },
  logWrap: { flex: 1, backgroundColor: '#0a0a0e', marginTop: 90, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: '#26262e', overflow: 'hidden' },
  // The onion-skin bed: the room dimmed far down, then a tar scrim — the transcript floats on the room, faintly.
  logBg: { ...StyleSheet.absoluteFillObject, opacity: 0.16 },
  logScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,14,0.72)' },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#17171d' },
  logTitle: { color: '#e5e7eb', fontWeight: '800', letterSpacing: 2 },
  logClose: { color: '#9ca3af', fontSize: 18 },
  logLine: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  logThem: { color: '#d4d4d8' },
  logYou: { color: '#67c99a', textAlign: 'right' },
  // The room's own stage-whisper (ask-penalty, repetition, bond-crossings, the end marker). Desaturated
  // bone italic — reads as in-world paper, NOT a floating system toast. The old saturated violet (#c084fc)
  // was off-palette (doctrine = bone / tar / sodium-amber / one scenario accent) and betrayed the diegetic
  // illusion the backdrops paid for — a §5 "never floating game-chrome" break the visual-truth eyes caught.
  logSys: { color: '#b3a892', textAlign: 'center', fontStyle: 'italic', fontWeight: '600', letterSpacing: 0.3 },
});
