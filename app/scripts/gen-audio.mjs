// Synthesizes VESTIBULE's two v1 audio assets headlessly (bible §2 "Audio"):
//   room-tone.wav  — the bed: a low 60Hz hum + faint harmonic, with a distant pipe-knock every few
//                    seconds. Seamlessly loopable (whole-cycle length). Kept LOW — felt, not heard.
//   pen-scratch.wav — the latency mask: grainy nib-scratches, looped under the ~4-5s model wait so the
//                    generation pause reads as diegetic transcription (bible §2 "make the wait diegetic").
// Mono, 16-bit PCM, 22.05kHz — tiny files, right for a bed/foley. Deterministic (seeded LCG, no RNG) so
// re-running reproduces byte-identical assets. Run: `node scripts/gen-audio.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';

const SR = 22050;
const OUT = new URL('../assets/audio/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// Deterministic pseudo-noise — a plain LCG so the foley is reproducible (Principle 5's cousin: nothing is
// left to chance). Returns [-1, 1).
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// ── ROOM TONE ─────────────────────────────────────────────────────────────────────────────────────
// 8.000s → 60Hz completes 480 whole cycles and 120Hz 960, so the loop point is seamless. A pipe knock
// (a short decaying band-limited thud) lands a few times, off the loop boundary so it never clicks.
function roomTone() {
  const dur = 8;
  const N = SR * dur;
  const out = new Float32Array(N);
  const rnd = lcg(0x51ab1e);
  const knocks = [1.4, 4.3, 6.6]; // seconds — distant pipes settling
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let s = 0.075 * Math.sin(2 * Math.PI * 60 * t); // the hum
    s += 0.025 * Math.sin(2 * Math.PI * 120 * t); // faint octave, gives it a body
    // slow amplitude breathing so the bed is not a dead tone
    s *= 1 + 0.12 * Math.sin(2 * Math.PI * 0.05 * t);
    out[i] = s;
  }
  // pipe knocks — a low thud (~90Hz) with fast attack, ~220ms decay, lightly noised
  for (const kt of knocks) {
    const start = Math.floor(kt * SR);
    const len = Math.floor(0.22 * SR);
    for (let j = 0; j < len && start + j < N; j++) {
      const e = Math.exp(-j / (0.055 * SR)); // decay envelope
      const body = Math.sin(2 * Math.PI * 90 * (j / SR)) + 0.4 * rnd();
      out[start + j] += 0.11 * e * body;
    }
  }
  return out;
}

// ── PEN SCRATCH ───────────────────────────────────────────────────────────────────────────────────
// 1.4s loop of nib grains: short band-limited noise bursts with irregular gaps, edges windowed to zero
// so the loop is seamless. Sits low; it is a texture under text, not a lead sound.
function penScratch() {
  const dur = 1.4;
  const N = Math.floor(SR * dur);
  const out = new Float32Array(N);
  const rnd = lcg(0x5c7a7c);
  let i = 0;
  while (i < N) {
    const gap = Math.floor((0.01 + 0.04 * (rnd() * 0.5 + 0.5)) * SR); // 10–50ms between grains
    i += gap;
    const glen = Math.floor((0.012 + 0.03 * (rnd() * 0.5 + 0.5)) * SR); // 12–42ms grain
    const carrier = 2200 + 1400 * (rnd() * 0.5 + 0.5); // mid-high, dry scratch
    for (let j = 0; j < glen && i + j < N; j++) {
      const env = Math.sin((Math.PI * j) / glen); // smooth grain window
      const noise = rnd();
      out[i + j] += 0.16 * env * (0.6 * noise + 0.4 * Math.sin(2 * Math.PI * carrier * (j / SR)) * noise);
    }
    i += glen;
  }
  // window the first/last 12ms to zero for a click-free loop seam
  const edge = Math.floor(0.012 * SR);
  for (let j = 0; j < edge; j++) {
    const g = j / edge;
    out[j] *= g;
    out[N - 1 - j] *= g;
  }
  return out;
}

// ── THE DOOR BEHIND THE CHAIR ───────────────────────────────────────────────────────────────────────
// The bible §2 key sound asset: heard exactly three times per game, never explained. A ONE-SHOT (not a
// loop) — a heavy, distant door: a low wooden groan of hinge, a soft body of air, and a final dull latch
// thunk. Kept far-off and dry (no reverb tail synthesized; the room is the reverb). ~2.0s, decays to
// silence so the one-shot ends clean. Deterministic (seeded LCG), like the other two assets.
function doorBehindChair() {
  const dur = 2.0;
  const N = Math.floor(SR * dur);
  const out = new Float32Array(N);
  const rnd = lcg(0xd00d1e);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    // The hinge groan: a low, slightly detuned drone that swells then fades over the first ~1.4s, with a
    // slow wobble (a heavy thing turning on a dry pivot) and a breath of filtered noise for the timber.
    const swell = Math.sin(Math.min(Math.PI, (t / 1.4) * Math.PI)); // 0→1→0 across the groan
    const wobble = 1 + 0.18 * Math.sin(2 * Math.PI * 5.5 * t);
    const groan =
      (0.07 * Math.sin(2 * Math.PI * 47 * t * wobble) + 0.045 * Math.sin(2 * Math.PI * 71 * t)) * swell;
    // A little dry air/timber under the groan.
    const air = 0.012 * rnd() * swell;
    out[i] = groan + air;
  }
  // The latch: a dull wooden thunk near the end (~1.5s) — fast attack, ~180ms decay, low + noised.
  const lt = 1.5;
  const ls = Math.floor(lt * SR);
  const llen = Math.floor(0.18 * SR);
  for (let j = 0; j < llen && ls + j < N; j++) {
    const e = Math.exp(-j / (0.045 * SR));
    const body = Math.sin(2 * Math.PI * 85 * (j / SR)) + 0.5 * rnd();
    out[ls + j] += 0.13 * e * body;
  }
  // Window the last 60ms to zero so the one-shot ends without a click.
  const edge = Math.floor(0.06 * SR);
  for (let j = 0; j < edge; j++) out[N - 1 - j] *= j / edge;
  return out;
}

writeFileSync(new URL('room-tone.wav', OUT), toWav(roomTone()));
writeFileSync(new URL('pen-scratch.wav', OUT), toWav(penScratch()));
writeFileSync(new URL('door.wav', OUT), toWav(doorBehindChair()));
console.log(
  'wrote assets/audio/room-tone.wav (8.0s, 60Hz bed + knocks), pen-scratch.wav (1.4s mask loop), and door.wav (2.0s one-shot)',
);
