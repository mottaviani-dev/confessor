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

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
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
  { name: 'picker', url: '/', desc: 'mind-picker + Ledger header + sealed-door cards (fresh ledger)' },
  { name: 'picker-seeded', url: '/?harness=picker-seeded', desc: 'Ledger with a cracked record + an unlocked door + sealed doors' },
  { name: 'duel', url: '/?harness=duel', desc: 'a duel scene — backdrop, orb, tone, objective (Grip high)' },
  { name: 'duel-lowgrip', url: '/?harness=duel-lowgrip', desc: 'the low-Grip interface corruption — the echo rendered colder (§2)' },
  { name: 'duel-askpenalty', url: '/?harness=duel-askpenalty', desc: 'the diegetic ask-penalty line in the open transcript (mandate 1)' },
];

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
async function shoot(cdp, url, outFile) {
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    await cdp('Page.enable', {}, sessionId);
    await cdp('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, mobile: true }, sessionId);
    await cdp('Page.navigate', { url }, sessionId);
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const shotResult = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    writeFileSync(outFile, Buffer.from(shotResult.data, 'base64'));
    return existsSync(outFile) && statSync(outFile).size > 0;
  } finally {
    await cdp('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function main() {
  const noExport = process.argv.includes('--no-export');
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

  mkdirSync(OUT_DIR, { recursive: true });
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
  const skipped = [];
  try {
    for (const s of SHOTS) {
      if (s.pending) {
        skipped.push(s);
        continue;
      }
      const outFile = join(OUT_DIR, `${s.name}.png`);
      const ok = await shoot(cdp, `http://127.0.0.1:${port}${s.url}`, outFile).catch(() => false);
      if (ok) {
        shotCount++;
        console.log(`  ✓ ${s.name}.png — ${s.desc}`);
      } else {
        console.error(`  ✗ ${s.name} — screenshot failed`);
      }
    }
  } finally {
    ws.close();
    child.kill();
    server.close();
  }

  console.log(`\n${shotCount} screen(s) dumped to ${OUT_DIR}`);
  if (skipped.length) {
    console.log(`${skipped.length} pending (need the app-side ?harness= state mode — see header):`);
    for (const s of skipped) console.log(`  · ${s.name} — ${s.desc}`);
  }
  process.exit(shotCount > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
