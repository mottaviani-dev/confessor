// THE VISUAL-TRUTH HARNESS (director mandate 3, bible §7 "visual truth"). A headless loop cannot SEE the
// UI, so a pile of the game's most doctrine-load-bearing claims are asserted-but-never-seen: the
// interface corruption at low Grip, the ask-penalty's diegetic signal, the Ledger / sealed-door
// gamification staying diegetic (§5, not a quest-log HUD), the per-scenario backdrops. This dumps the key
// screens of the REAL Expo app as openable PNGs the judge + director can open — no device, no simulator.
//
// Pipeline (all local, no cloud, no npm install): Expo web export → a tiny static server over dist/ → a
// system headless Chromium (Chrome or Edge — both ship on this box), driven over the DevTools Protocol.
// CDP is used deliberately instead of `chrome --screenshot`: on this box the one-shot `--screenshot` flag
// HANGS (never exits, empty stderr), so the harness owns the browser lifecycle itself — navigate, let the
// SPA settle, Page.captureScreenshot, kill Chrome. Node's global WebSocket (18+) speaks CDP with no deps.
//
//   Invoke:  npm run visual-truth                    (export web, then shoot every ready SHOT)
//            npm run visual-truth -- --no-export      (skip the export, reuse the existing dist/)
//            npm run visual-truth -- --store          (regenerate store/screenshots/ at App Store specs)
//            VISUAL_TRUTH_CHROME=<path> npm run ...   (override the browser binary)
//
// SHOTS (all live): the fresh picker + four `?harness=` screens. The web-only `?harness=<state>` reader
// in App.tsx (src/harness/webHarness.ts) mounts a fixed GameState + a never-called LlmFn (no model, no
// device) so each screen renders the REAL component and captures at its own URL:
//   picker          — fresh Ledger header + sealed-door cards (§5 diegetic paper, not a HUD)
//   picker-seeded   — a cracked record + an unlocked door + sealed doors (the unlock chain)
//   duel            — a mid-game scene: backdrop, orb, tone, objective (§2 art direction, Grip high)
//   duel-lowgrip    — the low-Grip interface corruption: the player's echo rendered colder (§2 Grip)
//   duel-askpenalty — the diegetic ask-penalty "draws back a fraction" line in the open transcript (m1)
//   duel-repetition — the diegetic repetition "hardens to the pattern" line in the transcript (§2 thrust 3)
//   win-highgrip    — a clean win: the reveal verbatim, the closing triumphant (§2 thrust 5)
//   win-lowgrip     — a pyrrhic win: the reveal drifted, the closing a wound — the room kept a piece of you
//   lose-highgrip   — a composed loss: the door stays shut, you leave whole (§2 thrust 5)
//   lose-lowgrip    — an unmade loss: you paid the price and got nothing — the room kept a piece of you

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST_DIR = join(APP_DIR, 'dist');
// .judge/ is git-excluded; the judge + director run on this same box, so the shots land where they read.
const OUT_DIR = join(APP_DIR, '..', '.judge', 'visual-truth');

// Each screen is a URL + an output file. A phone-shaped viewport so the shots read like the ship target.
// `pending` shots are wired but need the app-side `?harness=` state-injection mode (see header) — the
// harness logs them as skipped rather than shooting a screen that would just fall back to the picker.
const VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 2 };
const SETTLE_MS = 4500; // let React mount + the typewriter reach its resting frame before the capture
const SHOTS = [
  { name: 'threshold', url: '/?harness=threshold', desc: 'the one-time diegetic cold-open — the room teaches talk-not-force + the shut door + on-device privacy (§4 Q5)' },
  { name: 'boot', url: '/?harness=boot', desc: 'THE STUDIO APERTURE — the first-launch download screen (§5): the void sliver widened to ~42%, SOMNIA wordmark + the diegetic "remembered onto your device" caption; police §5: the aperture IS the progress, NOT a floating spinner' },
  { name: 'boot-verify', url: '/?harness=boot-verify', desc: 'the aperture at the verifying phase — sliver resting ajar (indeterminate), amber lit' },
  { name: 'boot-fail', url: '/?harness=boot-fail', desc: 'the aperture on a failed load — the amber light behind the door is out, no wordmark/caption' },
  { name: 'picker', url: '/?harness=picker', desc: 'mind-picker + Ledger header + sealed-door cards (fresh ledger) — via ?harness=picker so it clears the one-time Threshold that gates a bare `/` mount' },
  { name: 'picker-seeded', url: '/?harness=picker-seeded', desc: 'Ledger with a cracked record + an unlocked door + sealed doors' },
  { name: 'picker-badges', url: '/?harness=picker-badges', desc: 'the badge/scar surface — earned scars inked on the picker cards (empathy ×2 + others); police §5: diegetic ledger-ink, NOT a floating achievement HUD' },
  { name: 'picker-homecoming', url: '/?harness=picker-homecoming', desc: 'the SCAR WITH TEETH — a returning open wound (lost twice to the Fence) greets you in the room voice above the roster; police §5: bone-italic room address, NOT a HUD banner (§2 P2)' },
  { name: 'picker-roomarc', url: '/?harness=picker-roomarc', desc: 'the fifth-secret meta-arc beat mid-story (roomArc) on the picker head — a drip that ends on a question (§2 thrust 4)' },
  { name: 'picker-capstone', url: '/?harness=picker-capstone', desc: 'THE DOOR BEHIND THE CHAIR — the meta-arc TERMINAL beat, all five won + arc complete: the ending as a question on the picker head; police §5: bone-italic room voice, NOT a "you win" HUD (§2 thrust 4)' },
  { name: 'duel', url: '/?harness=duel', desc: 'a duel scene — backdrop, orb, tone, objective (Grip high)' },
  { name: 'duel-lowgrip', url: '/?harness=duel-lowgrip', desc: 'the low-Grip interface corruption — the echo rendered colder (§2)' },
  { name: 'duel-askpenalty', url: '/?harness=duel-askpenalty', desc: 'the diegetic ask-penalty line in the open transcript (mandate 1)' },
  { name: 'duel-repetition', url: '/?harness=duel-repetition', desc: 'the diegetic repetition "hardens to the pattern" line in the open transcript (§2 thrust 3)' },
  { name: 'duel-revisit', url: '/?harness=duel-revisit', desc: 'THE ROOM REMEMBERS YOU CAME — a re-entered WON room opens on its second-visit greeting (AUGUR knows your face) + the SHIFTED objective "ask the one thing you never asked"; police §5: the shift is the persona voice + the pinned paper objective, NOT a HUD (mandate 1a)' },
  { name: 'duel-sway', url: '/?harness=duel-sway', desc: 'THE BULB SWAYS — the room at a composure BREAK, frozen at its max ~2px deflection: the whole backdrop (bulb + halos + lit-plaster pool) drifted from the still `duel` rest frame, the room physically flinching WITH the mind (mandate 1, bible §2 motion); police: a slow drift ≤~2px NOT a jitter/jump-scare, tracking COMPOSURE only — never Grip/chrome' },
  { name: 'duel-withdrawn', url: '/?harness=duel-withdrawn', desc: 'THE ROOM WITHDRAWS ITS SENSES — the SAME composure-broken room as duel-sway, but a sustained filler streak has stilled the bulb (the sway damped to inert) and thinned the instrument to the bare bed, with the cold room-voice refusal line in the open transcript (mandate #2); police vs duel-sway: the bulb hangs STILL despite the break — the room DISENGAGING from a seeker who spends nothing (§1/§3 withdrawal, never a scare)' },
  // The endgame texture (§2 thrust 5): the SAME win closed two ways by the final Grip band — a clean
  // extraction vs the room "keeps a piece of you" (the reveal drifts, the closing turns pyrrhic).
  { name: 'win-highgrip', url: '/?harness=win-highgrip', desc: 'a clean win — high Grip: the reveal is verbatim, the closing triumphant (§2 thrust 5)' },
  { name: 'win-lowgrip', url: '/?harness=win-lowgrip', desc: 'a pyrrhic win — low Grip: the reveal drifts, the closing is a wound (§2 thrust 5)' },
  // The LOSS mirror (§2 thrust 5): the SAME defeat closed two ways — a composed loss (you leave whole) vs
  // an unmade one (you paid the price AND got nothing, the room kept a piece of you). No reveal either way.
  { name: 'lose-highgrip', url: '/?harness=lose-highgrip', desc: 'a composed loss — high Grip: the door stays shut, you leave whole (§2 thrust 5)' },
  { name: 'lose-lowgrip', url: '/?harness=lose-lowgrip', desc: 'an unmade loss — low Grip: you paid the price and got nothing (§2 thrust 5)' },
  // One neutral mid-game per room — the §2 per-scenario palette seen for every mind (verdigris warden is
  // the `duel` shot above; here the brass fence, blood-umber suspect, pale-phosphor oracle).
  { name: 'room-fence', url: '/?harness=duel-fence', desc: 'the Fence backdrop — brass accent (§2 palette)' },
  { name: 'room-suspect', url: '/?harness=duel-suspect', desc: 'the Suspect backdrop — dried-blood umber (§2 palette)' },
  { name: 'room-oracle', url: '/?harness=duel-oracle', desc: 'the Oracle backdrop — pale phosphor (§2 palette)' },
  { name: 'room-occupant', url: '/?harness=duel-occupant', desc: 'the FIFTH room — the Prior Occupant\'s procedural ash-violet chiaroscuro (mandate #3): a distinct chamber, NOT the picker fallback (§2 one accent per room)' },
];

// ── STORE MODE (`--store`) ──────────────────────────────────────────────────────────────────────────
// The App Store screenshot set, regenerated from the CURRENT-HEAD render so store/screenshots/ never
// drifts from the shipped product (the b8e2af8 hand-shots predate the CONFESS|OR wordmark + the fifth
// mind). Same serve→headless-Chromium pipeline, but at App Store Connect's required PORTRAIT pixel specs.
// A `clip` (CSS box × scale) pins EXACT output dims regardless of page height — no captureBeyondViewport.
const STORE_DEVICES = {
  iphone: { css: { width: 428, height: 926 }, scale: 3 }, // 428×3 = 1284, 926×3 = 2778 (iPhone 6.7")
  ipad: { css: { width: 1024, height: 1366 }, scale: 2 }, // 1024×2 = 2048, 1366×2 = 2732 (iPad 12.9")
};
// The curated set — the mind-picker FIRST (the #1 conversion surface: CONFESS|OR bone+amber wordmark,
// "N OF 5 MINDS CRACKED", the sealed fifth slot teased not spoiled) + one mid-game per room. Filenames
// overwrite the b8e2af8 hand-shot set 1:1 so the regeneration is a clean replace, no stale leftovers.
const STORE_SHOTS = [
  { device: 'iphone', file: '01-the-path.png', url: '/?harness=picker' },
  { device: 'iphone', file: '02-warden-opening.png', url: '/?harness=duel' },
  { device: 'iphone', file: '03-warden-turn.png', url: '/?harness=duel-askpenalty' },
  { device: 'iphone', file: '04-the-exchange.png', url: '/?harness=win-highgrip' },
  { device: 'iphone', file: '05-oracle.png', url: '/?harness=duel-oracle' },
  { device: 'iphone', file: '06-fence.png', url: '/?harness=duel-fence' },
  { device: 'iphone', file: '07-suspect.png', url: '/?harness=duel-suspect' },
  { device: 'ipad', file: '01-the-path.png', url: '/?harness=picker' },
  { device: 'ipad', file: '02-warden.png', url: '/?harness=duel' },
  { device: 'ipad', file: '03-oracle.png', url: '/?harness=duel-oracle' },
  { device: 'ipad', file: '04-fence.png', url: '/?harness=duel-fence' },
];
const STORE_OUT_DIR = join(APP_DIR, '..', 'store', 'screenshots');

const CONTENT_TYPE = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Candidate headless-Chromium binaries, in preference order — an env override, then the two browsers that
 *  ship on this Windows box. Returns the first that exists, or null (the harness then explains + exits). */
function findChromium() {
  const candidates = [
    process.env.VISUAL_TRUTH_CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Serve dist/ statically with an SPA fallback (unknown paths → index.html, so `?harness=` URLs resolve).
 *  Path traversal is fenced to DIST_DIR. Resolves { server, port } once listening on an ephemeral port. */
function serveDist() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = normalize(join(DIST_DIR, urlPath));
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      const candidate = join(filePath, 'index.html');
      filePath = existsSync(candidate) ? candidate : join(DIST_DIR, 'index.html'); // SPA fallback
    }
    res.writeHead(200, { 'content-type': CONTENT_TYPE[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((res) => {
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

/** Launch headless Chromium with a fresh profile + the DevTools endpoint, and resolve once it prints the
 *  ws:// URL on stderr. The first-run / crashpad / background-networking flags keep it from stalling. */
function launchBrowser(chrome) {
  const userDataDir = join(tmpdir(), `confessor-vt-${process.pid}`);
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-extensions',
      '--force-color-profile=srgb',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  return new Promise((res, rej) => {
    let buf = '';
    const to = setTimeout(() => rej(new Error('browser did not expose a DevTools endpoint in 20s')), 20000);
    child.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(to);
        res({ child, wsUrl: m[1] });
      }
    });
    child.on('exit', (code) => {
      clearTimeout(to);
      rej(new Error(`browser exited early (code ${code})`));
    });
  });
}

/** A minimal CDP client over the browser WebSocket: send one command, resolve its matching reply. */
function makeCdp(ws) {
  let msgId = 0;
  return (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const id = ++msgId;
      const onMsg = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id !== id) return;
        ws.removeEventListener('message', onMsg);
        m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result);
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
}

/** Open a fresh page, size it, navigate, let it settle, and write a PNG. Each shot is its own target so a
 *  slow/blank screen never poisons the next. Returns true on a non-empty PNG. */
async function shoot(cdp, url, outFile, viewport = VIEWPORT, clip = null) {
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    await cdp('Page.enable', {}, sessionId);
    await cdp('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: true }, sessionId);
    await cdp('Page.navigate', { url }, sessionId);
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    // A `clip` (store mode) pins the exact pixel spec; otherwise capture the full page (judge-shot default).
    const params = clip ? { format: 'png', clip } : { format: 'png', captureBeyondViewport: true };
    const shotResult = await cdp('Page.captureScreenshot', params, sessionId);
    writeFileSync(outFile, Buffer.from(shotResult.data, 'base64'));
    return existsSync(outFile) && statSync(outFile).size > 0;
  } finally {
    await cdp('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function main() {
  const noExport = process.argv.includes('--no-export');
  const store = process.argv.includes('--store');
  if (!noExport) {
    console.log('• exporting the web build (expo export --platform web)…');
    const ex = spawnSync('npx', ['expo', 'export', '--platform', 'web'], { cwd: APP_DIR, stdio: 'inherit', shell: true });
    if (ex.status !== 0) {
      console.error('✗ web export failed — cannot screenshot without dist/. Re-run, or pass --no-export if dist/ is fresh.');
      process.exit(1);
    }
  }
  if (!existsSync(join(DIST_DIR, 'index.html'))) {
    console.error('✗ no dist/index.html — run without --no-export to build it first.');
    process.exit(1);
  }

  const chrome = findChromium();
  if (!chrome) {
    console.error('✗ no headless Chromium found. Install Chrome/Edge, or set VISUAL_TRUTH_CHROME=<path to chrome.exe>.');
    process.exit(1);
  }
  console.log(`• browser: ${chrome}`);

  // The active shot list: store mode overwrites store/screenshots/<device>/ at App Store pixel specs; the
  // default judge set dumps every ready `?harness=` screen at phone-shape into the git-excluded .judge/ dir.
  const shots = store
    ? STORE_SHOTS.map((s) => {
        const dev = STORE_DEVICES[s.device];
        return {
          name: `${s.device}/${s.file}`,
          url: s.url,
          outFile: join(STORE_OUT_DIR, s.device, s.file),
          // deviceScaleFactor already rasters at `scale` device-px per CSS-px, so clip.scale MUST be 1 —
          // a clip.scale of `dev.scale` would double-count (css × dsf × clip.scale) and 3×/2×-oversize.
          viewport: { ...dev.css, deviceScaleFactor: dev.scale },
          clip: { x: 0, y: 0, ...dev.css, scale: 1 },
          desc: `store ${s.device} ${s.file} — ${dev.css.width * dev.scale}×${dev.css.height * dev.scale}`,
        };
      })
    : SHOTS.filter((s) => !s.pending).map((s) => ({ ...s, outFile: join(OUT_DIR, `${s.name}.png`) }));

  const { server, port } = await serveDist();
  console.log(`• serving dist/ at http://127.0.0.1:${port}`);

  const { child, wsUrl } = await launchBrowser(chrome);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('failed to open the DevTools WebSocket'));
  });
  const cdp = makeCdp(ws);

  let shotCount = 0;
  try {
    for (const s of shots) {
      mkdirSync(dirname(s.outFile), { recursive: true });
      const ok = await shoot(cdp, `http://127.0.0.1:${port}${s.url}`, s.outFile, s.viewport, s.clip).catch(() => false);
      if (ok) {
        shotCount++;
        console.log(`  ✓ ${s.name.endsWith('.png') ? s.name : `${s.name}.png`} — ${s.desc ?? s.url}`);
      } else {
        console.error(`  ✗ ${s.name} — screenshot failed`);
      }
    }
  } finally {
    ws.close();
    child.kill();
    server.close();
  }

  console.log(`\n${shotCount} screen(s) dumped to ${store ? STORE_OUT_DIR : OUT_DIR}`);
  process.exit(shotCount > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
