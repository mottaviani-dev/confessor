// THE AUDIO-TRUTH REPORT (director mandate 1, bible §7 — the EAR's parity with scripts/visual-truth.mjs).
// A headless loop cannot HEAR the game, so every audio asset ships asserted-not-heard. This reads the
// generated PCM in assets/audio/ and DUMPS a numbers table to .judge/audio-truth/ the judge + director can
// open — per-asset dominant frequency (Hz), RMS energy, spectral purity; the studio signature's two-segment
// (wooden-settle → high pure tone) structure; the five per-mind instruments' distinct fingerprints; and the
// composure detune measured as a real pitch ratio (resample by the director's MAX_DETUNE). No device, no
// expo-audio, no dep — a hand-rolled Goertzel at target frequencies parses the WAV directly.
//
//   Invoke:  npm run audio-truth        (regenerate assets first: npm run gen-audio)
//
// The DSP mirrors src/audio/audioTruth.ts (the canonical, unit-tested source of truth this report reads
// FROM in spirit); audioTruth.test.ts asserts the design intents as CI bands so a drifted asset fails a
// test, not a device. This .mjs is the human/judge-readable dump of the same measurements.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, '..', 'assets', 'audio');
// .judge/ is git-excluded; the judge + director run on this same box, so the table lands where they read.
const OUT_DIR = join(HERE, '..', '..', '.judge', 'audio-truth');

// ── DSP (mirror of src/audio/audioTruth.ts) ─────────────────────────────────────────────────────────
function parseWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (off) => String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let sampleRate = 0, bitsPerSample = 0, channels = 0, dataOffset = -1, dataLength = 0;
  let p = 12;
  while (p + 8 <= bytes.length) {
    const id = tag(p);
    const size = view.getUint32(p + 4, true);
    const body = p + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = size;
    }
    p = body + size + (size & 1);
  }
  if (dataOffset < 0) throw new Error('no data chunk');
  if (bitsPerSample !== 16 || channels !== 1) throw new Error('expected 16-bit mono PCM');
  const n = Math.floor(dataLength / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  return { samples, sampleRate };
}

function goertzelPower(samples, freq, sr, from = 0, to = samples.length) {
  const w = (2 * Math.PI * freq) / sr;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < to; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  const len = to - from;
  return len > 0 ? power / len : 0;
}

function dominantFrequency(samples, sr, probes, from = 0, to = samples.length) {
  let best = probes[0], bestPow = -1, total = 0;
  for (const f of probes) {
    const pow = goertzelPower(samples, f, sr, from, to);
    total += pow;
    if (pow > bestPow) { bestPow = pow; best = f; }
  }
  return { freq: best, power: bestPow, totalPower: total };
}

function rms(samples, from = 0, to = samples.length) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  const len = to - from;
  return len > 0 ? Math.sqrt(sum / len) : 0;
}

function resamplePlayback(samples, rate) {
  const outN = Math.floor(samples.length / rate);
  const out = new Float32Array(outN);
  for (let i = 0; i < outN; i++) {
    const src = i * rate;
    const j = Math.floor(src);
    const frac = src - j;
    const a = samples[j] ?? 0;
    const b = samples[j + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

const PROBES = (() => {
  const p = [];
  for (let f = 40; f <= 320; f += 1) p.push(f);
  for (let f = 328; f <= 2400; f += 8) p.push(f);
  return p;
})();

// A long-window Goertzel destabilises the low bins (coeff≈2 accumulates float error over ~10⁵ samples),
// so dominant-detection runs over a bounded stable window. See src/audio/audioTruth.ts ANALYSIS_SECONDS.
const ANALYSIS_SECONDS = 2;
const windowOf = (pcm) => [0, Math.min(pcm.samples.length, Math.floor(ANALYSIS_SECONDS * pcm.sampleRate))];

/** Sub-Hz peak by a fine sweep — for a resampled/detuned tone that falls between the 1 Hz PROBES. */
function refinePeak(samples, sr, lo, hi, step, from, to) {
  let best = lo, bestPow = -1;
  for (let f = lo; f <= hi; f += step) {
    const pow = goertzelPower(samples, f, sr, from, to);
    if (pow > bestPow) { bestPow = pow; best = f; }
  }
  return best;
}

// Kept in step with director.ts MAX_DETUNE — the ~1-semitone (2^(-1/12) ≈ 0.943) sag at full composure break.
const MAX_DETUNE = 0.057;

function load(name) {
  return parseWav(readFileSync(join(AUDIO_DIR, name)));
}

function fixed(n, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) : 'n/a';
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────────────────────
function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# AUDIO-TRUTH — acoustic measurement of the generated PCM (mandate 1, bible §7)');
  push('');
  push('Read from assets/audio/*.wav by scripts/audio-truth.mjs (Goertzel @ probe freqs, no FFT dep, no');
  push('device). The vitest src/audio/audioTruth.test.ts asserts these as CI bands. Deterministic.');
  push('');

  // Every asset: dominant Hz + RMS + purity over the whole buffer.
  const assets = [
    'room-tone.wav', 'pen-scratch.wav', 'door.wav', 'studio-signature.wav',
    'instrument-bowed.wav', 'instrument-musicbox.wav', 'instrument-breath.wav',
    'instrument-choir.wav', 'instrument-wire.wav',
  ];
  push('## Per-asset (whole buffer)');
  push('');
  push('| asset | seconds | dominant Hz | RMS | purity |');
  push('|---|---|---|---|---|');
  for (const a of assets) {
    const pcm = load(a);
    const { samples, sampleRate } = pcm;
    const secs = samples.length / sampleRate;
    const [wf, wt] = windowOf(pcm);
    const { freq, power, totalPower } = dominantFrequency(samples, sampleRate, PROBES, wf, wt);
    const pur = totalPower > 0 ? power / totalPower : 0;
    push(`| ${a} | ${fixed(secs, 2)} | ${freq} | ${fixed(rms(samples), 4)} | ${fixed(pur, 3)} |`);
  }
  push('');

  // The studio signature's TWO SEGMENTS (§5): wooden-settle (low) → high pure tone (near-monotone).
  const sig = load('studio-signature.wav');
  const sr = sig.sampleRate;
  const split = Math.floor(0.5 * sr); // the tone starts at 0.5s (gen-audio.mjs tStart)
  const segA = dominantFrequency(sig.samples, sr, PROBES, 0, split);
  const segB = dominantFrequency(sig.samples, sr, PROBES, split, sig.samples.length);
  const rmsA = rms(sig.samples, 0, split);
  const rmsB = rms(sig.samples, split, sig.samples.length);
  push('## Studio signature — the two segments (§5: low wooden settle → single high pure tone)');
  push('');
  push('| segment | window | dominant Hz | RMS | purity |');
  push('|---|---|---|---|---|');
  push(`| A settle | 0.00–0.50s | ${segA.freq} | ${fixed(rmsA, 4)} | ${fixed(segA.power / (segA.totalPower || 1), 3)} |`);
  push(`| B tone | 0.50s–end | ${segB.freq} | ${fixed(rmsB, 4)} | ${fixed(segB.power / (segB.totalPower || 1), 3)} |`);
  push(`- structure: settle dominant ${segA.freq} Hz → tone dominant ${segB.freq} Hz (ratio ${fixed(segB.freq / segA.freq, 2)}× up); tone purity ${fixed(segB.power / (segB.totalPower || 1), 3)} (near-monotone).`);
  push('');

  // The five per-mind instruments (§2 Audio): FIVE DISTINCT dominant fingerprints (no two collide).
  const minds = [
    ['Warden — bowed metal', 'instrument-bowed.wav'],
    ['Fence — music box', 'instrument-musicbox.wav'],
    ['Suspect — breath', 'instrument-breath.wav'],
    ['Oracle — choir', 'instrument-choir.wav'],
    ['Occupant — struck wire', 'instrument-wire.wav'],
  ];
  push('## The five minds — one distinct instrument each (§2 Audio)');
  push('');
  push('| mind | asset | dominant Hz | RMS |');
  push('|---|---|---|---|');
  const doms = [];
  for (const [label, file] of minds) {
    const pcm = load(file);
    const { samples, sampleRate } = pcm;
    const [wf, wt] = windowOf(pcm);
    const { freq } = dominantFrequency(samples, sampleRate, PROBES, wf, wt);
    doms.push(freq);
    push(`| ${label} | ${file} | ${freq} | ${fixed(rms(samples), 4)} |`);
  }
  const unique = new Set(doms).size;
  let minRatio = Infinity;
  const sorted = [...doms].sort((x, y) => x - y);
  for (let i = 1; i < sorted.length; i++) minRatio = Math.min(minRatio, sorted[i] / sorted[i - 1]);
  push('');
  push(`- distinct dominants: ${unique}/5 unique (${doms.join(', ')} Hz); closest pair ratio ${fixed(minRatio, 3)}× (>1 = no collision).`);
  push('');

  // The composure detune (§2 "detunes as Composure falls") measured as a real pitch ratio: resample the
  // Warden instrument by the director's full-break rate and read how far the dominant dropped.
  const bowed = load('instrument-bowed.wav');
  const [bf, bt] = windowOf(bowed);
  const d0 = refinePeak(bowed.samples, bowed.sampleRate, 90, 106, 0.05, bf, bt);
  const detuned = resamplePlayback(bowed.samples, 1 - MAX_DETUNE);
  const d1 = refinePeak(detuned, bowed.sampleRate, 84, 100, 0.05, bf, bt);
  const semitone = Math.pow(2, 1 / 12);
  push('## Composure detune — the room tone sinks as the séance breaks (§2, director MAX_DETUNE)');
  push('');
  push(`- Warden instrument dominant intact: ${fixed(d0, 1)} Hz; at full composure break (rate ${fixed(1 - MAX_DETUNE, 3)}): ${fixed(d1, 1)} Hz.`);
  push(`- pitch ratio intact/broken: ${fixed(d0 / d1, 4)}× (one semitone = ${fixed(semitone, 4)}× — the §2 "~1 semitone" claim).`);
  push('');
  push('_End of audio-truth. Regenerate with `npm run gen-audio` then `npm run audio-truth`; the bands are enforced by src/audio/audioTruth.test.ts._');

  const outFile = join(OUT_DIR, 'audio-truth.md');
  writeFileSync(outFile, lines.join('\n') + '\n');
  console.log(`• audio-truth → ${outFile}`);
  console.log(`  studio signature: settle ${segA.freq}Hz → tone ${segB.freq}Hz`);
  console.log(`  five minds: ${doms.join(', ')} Hz (${unique}/5 distinct)`);
  console.log(`  detune: ${fixed(d0, 1)}→${fixed(d1, 1)} Hz (${fixed(d0 / d1, 4)}× ≈ semitone ${fixed(semitone, 4)}×)`);
}

main();
