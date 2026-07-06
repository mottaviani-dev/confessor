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
import { grip, corruptLine } from './src/engine/grip';
import { recordPlaythrough, distillSeamPhrase } from './src/engine/seam';
import type { GameState, LlmFn, Scenario, SeamLog, Tone } from './src/engine/types';
import { BUILD_LLM_CONFIG, makeLlm } from './src/llm/openaiCompatible';
import { createLlmProvider, type ProviderState } from './src/llm/provider';
import { getBackendEnv, prepareOnDeviceLlm } from './src/llm/nativeBridge';
import { MODEL_SPEC } from './src/llm/modelSpec';
import { devlog } from './src/llm/devlog';
import { bondCrossedUp, bondState, shiftPulse, suspicionWarning } from './src/meta/bond';
import { crackedCount, recordResult, unlockedIds, type Ledger } from './src/meta/ledger';
import { loadLedger, loadSeamLog, saveLedger, saveSeamLog } from './src/meta/ledgerStore';
import { useAudioDirector } from './src/audio/useAudioDirector';
import { harnessDuel, parseHarness, seededLedger, type HarnessDuel } from './src/harness/webHarness';

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

const SCENE_BG: Record<string, number> = {
  warden: wardenBg,
  fence: fenceBg,
  suspect: suspectBg,
  oracle: oracleBg,
};

// Chrome doctrine: ink and hairline borders only — no image assets (etch grain turns to noise at button
// scale) and NO accent colors on chrome (colored card stripes read as generic app design, not the room).
// The only color in the frame stays the scene plate itself and the tone system.

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
  useEffect(() => {
    void loadLedger().then(setLedger);
    void loadSeamLog().then((log) => {
      SEAM_LOG = log;
    });
  }, []);
  const onResult = (scenarioId: string, outcome: 'won' | 'lost', turns: number) => {
    setLedger((l) => {
      const next = recordResult(l, scenarioId, outcome, turns);
      void saveLedger(next);
      return next;
    });
    void saveSeamLog(SEAM_LOG);
  };

  // Choose a mind before the duel. `key` on the Duel remounts fresh state per pick / re-pick.
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // VISUAL-TRUTH: a `?harness=` URL short-circuits to a fixed screen (web-only, after all hooks so the
  // rules-of-hooks hold). Each returns the REAL component with injected display state — no model wait.
  if (HARNESS?.kind === 'picker-seeded') return <Picker onPick={() => undefined} ledger={seededLedger()} />;
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

  if (!scenario) return <Picker onPick={setScenario} ledger={ledger} />;
  if (!llm) return <Boot prep={prep} scenario={scenario} onExit={() => setScenario(null)} />;
  return (
    <Duel
      key={scenario.id}
      scenario={scenario}
      llm={llm}
      bestTurns={ledger[scenario.id]?.bestTurns ?? null}
      onResult={onResult}
      onExit={() => setScenario(null)}
    />
  );
}

// Shown when a duel is entered before the model is ready (on-device first-run download/load, or a
// backend failure). Cloud path is instant so this is usually skipped entirely.
function Boot({ prep, scenario, onExit }: { prep: ProviderState; scenario: Scenario; onExit: () => void }) {
  const line = bootLine(prep);
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The chosen room, barely lit — the mind is still waking into it */}
      <Image source={SCENE_BG[scenario.id] ?? PICKER_BG} style={styles.bootBg} contentFit="cover" />
      <View style={styles.bootWrap}>
        {prep.kind === 'failed' ? null : <ActivityIndicator color="#4ade80" />}
        <Text style={styles.bootText}>{line}</Text>
        <Pressable onPress={onExit} hitSlop={12}>
          <Text style={styles.bootBack}>‹ back</Text>
        </Pressable>
      </View>
    </View>
  );
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

function Picker({ onPick, ledger }: { onPick: (s: Scenario) => void; ledger: Ledger }) {
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
      </View>
      <ScrollView contentContainerStyle={styles.pickerList}>
        {SCENARIOS.map((s, i) =>
          open.has(s.id) ? (
            <Pressable key={s.id} style={styles.card} onPress={() => onPick(s)}>
              <Text style={styles.cardTitle}>{s.title.toUpperCase()}</Text>
              <Text style={styles.cardGoal}>{s.playerGoal}</Text>
              {recordLine(ledger[s.id]) && <Text style={styles.cardRecord}>{recordLine(ledger[s.id])}</Text>}
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
  onResult,
  onExit,
  harness,
}: {
  scenario: Scenario;
  llm: LlmFn;
  bestTurns: number | null;
  onResult: (scenarioId: string, outcome: 'won' | 'lost', turns: number) => void;
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
  // The room's sound (mandate #3): room-tone bed for the whole scene, pen-scratch mask across each
  // generation await. Silent until the native port lands, but the lifecycle is wired live now.
  const audio = useAudioDirector();

  const shown = useTypewriter(current, busy ? 0 : 16);
  const over = state.status !== 'playing';
  const left = turnsLeft(scenario, state);

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
      setPulse(shiftPulse(state, r.state, scenario.pronoun));
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
      setState(r.state);
      // The room descends with the fiction (mandate #2 / Principle 4): the bed detunes as the séance
      // comes apart — THEIR composure cracking (trust) OR YOUR grip slipping (suspicion), whichever is
      // further gone — and the code-owned door schedule advances with the turn.
      audio.setComposure(Math.max(r.state.trust / scenario.winTrust, r.state.suspicion / scenario.loseSuspicion));
      audio.markTurn(r.state.turn, scenario.turnLimit);
      setCurrent(r.narration || '…');
      setHistory((h) => [
        ...h,
        { who: 'them', text: r.narration || '…' },
        ...crossings,
        ...(r.ending ? [{ who: 'system' as const, text: r.ending === 'won' ? '— YOU CRACKED IT —' : '— LOCKED OUT —' }] : []),
      ]);
      // Game over → seal this duel into the seam log so a LATER mind can allude to it (mandate #1).
      if (r.ending) {
        onResult(scenario.id, r.ending, r.state.turn);
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
  // INTERFACE CORRUPTION — the room edits you (mandate 1 · bible §2 Grip). As Grip falls (you have been
  // pressing the mind's guard up), your own just-submitted line renders back a shade COLDER than you
  // typed it. DISPLAY-LAYER ONLY (bible §6): `lastYou` is the raw text the engine already rated; this
  // corrupts only the echo the player re-reads. Silent while Grip is high — a composed game never sees it.
  const youShown = corruptLine(lastYou, grip(scenario, state), state.turn);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* The room — the scene's etched master, dimmed so the duel text owns the light */}
      <Image source={SCENE_BG[scenario.id] ?? PICKER_BG} style={styles.sceneBg} contentFit="cover" />
      {/* Mood stage — warms with trust, chills with suspicion */}
      <View style={[styles.wash, { backgroundColor: '#4ade80', opacity: trustR * 0.14 }]} pointerEvents="none" />
      <View style={[styles.wash, { backgroundColor: '#b91c1c', opacity: suspR * 0.18 }]} pointerEvents="none" />

      {/* Top bar: back · title · turn clock · log */}
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{scenario.title.toUpperCase()}</Text>
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

      {/* The objective, always legible */}
      <Text style={styles.objective}>{scenario.objective}</Text>

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
          <Text style={styles.bond}> · {bondState(state.trust, scenario.winTrust)}</Text>
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
              <Text style={styles.sendText}>▶</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* History log */}
      <Modal visible={showLog} animationType="slide" transparent onRequestClose={() => setShowLog(false)}>
        <View style={styles.logWrap}>
          <View style={styles.logHead}>
            <Text style={styles.logTitle}>THE EXCHANGE</Text>
            <Pressable onPress={() => setShowLog(false)} hitSlop={12}>
              <Text style={styles.logClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            {history.map((l, i) => (
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
  endRow: { flexDirection: 'row', gap: 10 },
  endBtn: { flex: 1 },
  endAlt: { backgroundColor: 'transparent', borderColor: '#26262e' },
  sendTextAlt: { color: '#9ca3af', fontWeight: '700', fontSize: 15 },
  // Picker (mind select)
  // Boot / model-prep screen
  bootBg: { ...StyleSheet.absoluteFillObject, opacity: 0.28 },
  bootWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  bootText: { color: '#9ca3af', fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 30 },
  bootBack: { color: '#6b7280', fontSize: 14, marginTop: 8 },
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
  cardSealed: { opacity: 0.55, borderStyle: 'dashed' },
  cardTitleSealed: { color: '#6b7280' },
  cardSealedLine: { color: '#52525b', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  crackedHead: { color: '#8a8a92', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginTop: 14 },
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
  logWrap: { flex: 1, backgroundColor: '#0a0a0e', marginTop: 90, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: '#26262e' },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#17171d' },
  logTitle: { color: '#e5e7eb', fontWeight: '800', letterSpacing: 2 },
  logClose: { color: '#9ca3af', fontSize: 18 },
  logLine: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  logThem: { color: '#d4d4d8' },
  logYou: { color: '#67c99a', textAlign: 'right' },
  logSys: { color: '#c084fc', textAlign: 'center', fontWeight: '800', letterSpacing: 1 },
});
