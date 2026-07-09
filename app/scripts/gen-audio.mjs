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

// ── PER-SCENARIO INSTRUMENTS ────────────────────────────────────────────────────────────────────────
// Bible §2 "Audio": one single instrument per mind, layered LOW under the room-tone bed for the whole
// scene — the sonic twin of the visual `accent`. All 8.0s and seamlessly loopable: the continuous drones
// (bowed / choir) use only frequencies that complete WHOLE cycles in 8s (a multiple of 1/8 = 0.125Hz) so
// the waveform meets itself at the seam with no click; the event-based voices (musicbox / breath / wire)
// decay to silence away from the loop boundary and are edge-windowed. Kept quiet here AND mixed low in
// nativeAudioPort (TRACK_VOLUME) — a tint that colours the room, never the sound of it. Deterministic
// (seeded LCG per asset), like the three v1 sounds.
const IDUR = 8;
const IN = SR * IDUR;

/** Window the first/last `ms` milliseconds of a buffer to zero — a click-free loop seam for the event
 *  voices (whose edges are already near-silent). */
function edgeWindow(out, ms = 12) {
  const edge = Math.floor((ms / 1000) * SR);
  for (let j = 0; j < edge; j++) {
    const g = j / edge;
    out[j] *= g;
    out[out.length - 1 - j] *= g;
  }
  return out;
}

// WARDEN — bowed metal. A low, cold drone: fundamental + faint octave + two INHARMONIC partials (the
// metallic ring of a bowed bar, at ~2.76× and ~5.40× the fundamental, rounded to whole-cycle freqs) under
// a slow bow-pressure tremolo. Continuous — no gaps — so seamlessness rides on the whole-cycle frequencies.
function bowedMetal() {
  const out = new Float32Array(IN);
  for (let i = 0; i < IN; i++) {
    const t = i / SR;
    const f0 = 98; // G2 — 784 whole cycles in 8s
    let s = 0.06 * Math.sin(2 * Math.PI * f0 * t);
    s += 0.03 * Math.sin(2 * Math.PI * (f0 * 2) * t); // faint octave for body
    s += 0.028 * Math.sin(2 * Math.PI * 270.5 * t); // inharmonic partial ~2.76× (2164 cycles)
    s += 0.014 * Math.sin(2 * Math.PI * 529.25 * t); // inharmonic partial ~5.40× (4234 cycles)
    s *= 1 + 0.22 * Math.sin(2 * Math.PI * 0.75 * t); // bow-pressure tremolo (6 cycles — whole)
    out[i] = s;
  }
  return out;
}

// FENCE — music box. Sparse plucked high tines: a short pentatonic figure, each note a sine + two faint
// harmonics under a fast exponential decay, spaced with silence between so the room breathes. The last
// note dies well before the seam.
function musicBox() {
  const out = new Float32Array(IN);
  const notes = [
    { t: 0.3, f: 1046.5 }, // C6
    { t: 1.5, f: 1568.0 }, // G6
    { t: 2.4, f: 1318.5 }, // E6
    { t: 3.8, f: 1760.0 }, // A6
    { t: 5.2, f: 1174.7 }, // D6
    { t: 6.3, f: 1046.5 }, // C6 — resolves, then silence to the seam
  ];
  for (const { t: nt, f } of notes) {
    const start = Math.floor(nt * SR);
    const len = Math.floor(1.1 * SR);
    for (let j = 0; j < len && start + j < IN; j++) {
      const tt = j / SR;
      const env = Math.exp(-tt / 0.18); // bright pluck, fast decay
      const body =
        Math.sin(2 * Math.PI * f * tt) +
        0.32 * Math.sin(2 * Math.PI * f * 2 * tt) + // tine harmonics
        0.14 * Math.sin(2 * Math.PI * f * 3 * tt);
      out[start + j] += 0.11 * env * body;
    }
  }
  return edgeWindow(out);
}

// SUSPECT — breath. Low band-limited noise (one-pole lowpass) under a slow inhale/exhale envelope — two
// breaths across the loop, the envelope zero at both ends so the seam is silent. A cornered person's own
// held breath under the table light.
function breath() {
  const out = new Float32Array(IN);
  const rnd = lcg(0xb2ea7e);
  let lp = 0;
  for (let i = 0; i < IN; i++) {
    const t = i / SR;
    lp += (rnd() - lp) * 0.045; // one-pole lowpass → soft, airy noise
    const env = 0.5 - 0.5 * Math.cos(2 * Math.PI * 0.25 * t); // 0→1→0→1→0 over 8s (two breaths, zero ends)
    out[i] = 0.13 * env * lp;
  }
  return edgeWindow(out);
}

// ORACLE — sine-tone choir. Stacked PURE sines in a bodiless quartal chord, one pair slightly detuned so
// the whole thing beats slowly (0.5Hz), a faint high shimmer above, a slow tremolo. Continuous and
// ethereal — whole-cycle freqs keep the seam clean. No trance-word, no voice: just the chord it speaks from.
function choir() {
  const out = new Float32Array(IN);
  const partials = [
    { f: 220.0, a: 0.05 }, // A3
    { f: 220.5, a: 0.05 }, // detuned twin → 0.5Hz beat (1764 whole cycles)
    { f: 293.75, a: 0.04 }, // ~D4 (2350 cycles)
    { f: 330.0, a: 0.035 }, // E4
    { f: 440.0, a: 0.02 }, // high shimmer
  ];
  for (let i = 0; i < IN; i++) {
    const t = i / SR;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t); // faint vibrato (44 cycles)
    let s = 0;
    for (const { f, a } of partials) s += a * Math.sin(2 * Math.PI * f * vib * t);
    s *= 1 + 0.18 * Math.sin(2 * Math.PI * 0.375 * t); // slow swell (3 cycles)
    out[i] = s;
  }
  return out;
}

// OCCUPANT — struck wire. A low plucked string that rings and dies: fundamental + decaying harmonics with
// a long exponential tail, struck a few times across the loop and left to decay to silence before the
// seam. Kinship struck once, the chair remembering a hand that already sat here.
function struckWire() {
  const out = new Float32Array(IN);
  const rnd = lcg(0x217e3a);
  const strikes = [0.2, 3.0, 5.6];
  const f0 = 110; // A2
  for (const st of strikes) {
    const start = Math.floor(st * SR);
    const len = Math.floor(2.0 * SR);
    for (let j = 0; j < len && start + j < IN; j++) {
      const tt = j / SR;
      const env = Math.exp(-tt / 0.55); // long ringing decay
      const body =
        Math.sin(2 * Math.PI * f0 * tt) +
        0.5 * Math.exp(-tt / 0.35) * Math.sin(2 * Math.PI * f0 * 2 * tt) + // harmonics decay faster
        0.28 * Math.exp(-tt / 0.22) * Math.sin(2 * Math.PI * f0 * 3 * tt);
      const pluck = j < 60 ? 0.4 * rnd() * (1 - j / 60) : 0; // a little attack noise at the strike
      out[start + j] += 0.12 * env * body + 0.12 * pluck;
    }
  }
  return edgeWindow(out);
}

writeFileSync(new URL('room-tone.wav', OUT), toWav(roomTone()));
writeFileSync(new URL('pen-scratch.wav', OUT), toWav(penScratch()));
writeFileSync(new URL('door.wav', OUT), toWav(doorBehindChair()));
writeFileSync(new URL('instrument-bowed.wav', OUT), toWav(bowedMetal()));
writeFileSync(new URL('instrument-musicbox.wav', OUT), toWav(musicBox()));
writeFileSync(new URL('instrument-breath.wav', OUT), toWav(breath()));
writeFileSync(new URL('instrument-choir.wav', OUT), toWav(choir()));
writeFileSync(new URL('instrument-wire.wav', OUT), toWav(struckWire()));
console.log(
  'wrote assets/audio/room-tone.wav (8.0s bed), pen-scratch.wav (1.4s mask), door.wav (2.0s one-shot), and ' +
    'the 5 per-scenario instruments: instrument-{bowed,musicbox,breath,choir,wire}.wav (8.0s loops)',
);
