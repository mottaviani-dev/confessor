// AUDIO-TRUTH — the acoustic instrument's CI bands (director mandate 1, bible §7 "measurement law").
//
// The whole audio axis shipped asserted-not-heard: the studio signature "wooden-settle → high pure tone"
// (§5), each mind's "OWN instrument" (§2), the bed detuning "~1 semitone as Composure falls" (§2). A
// headless loop cannot hear it, and until now nothing MEASURED the acoustic content — only which sound
// plays when (director.test.ts) and that the PCM is non-silent. These tests read the generated WAVs and
// assert the design INTENTS as frequency/energy bands, so a regenerated asset that drifts off-doctrine
// fails CI, not a device. The DSP is src/audio/audioTruth.ts; the human/judge dump is scripts/audio-truth.mjs.
//
// Bands are set with margin around the measured values (see .judge/audio-truth/audio-truth.md), so they
// pin the DESIGN (low settle vs high pure tone; five distinct pitches; a one-semitone sag) without being
// brittle to a harmless one-bin wobble.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_DETUNE } from './director';
import {
  ANALYSIS_SECONDS,
  analysisWindow,
  dominantFrequency,
  parseWav,
  PROBES,
  purity,
  refinePeak,
  resamplePlayback,
  rms,
  type Pcm,
} from './audioTruth';

/** Load a generated asset from assets/audio/ (relative to this test file), decoded to PCM. */
function loadAsset(name: string): Pcm {
  const here = dirname(fileURLToPath(import.meta.url));
  return parseWav(new Uint8Array(readFileSync(join(here, '..', '..', 'assets', 'audio', name))));
}

/** The dominant frequency over the stable analysis window (see ANALYSIS_SECONDS). */
function dominantHz(pcm: Pcm): number {
  const [from, to] = analysisWindow(pcm);
  return dominantFrequency(pcm.samples, pcm.sampleRate, PROBES, from, to).freq;
}

const SEMITONE = Math.pow(2, 1 / 12); // 1.0595…

describe('audio-truth — the generated assets carry their designed acoustic content', () => {
  it('every asset decodes as non-silent 16-bit mono PCM at 22.05kHz', () => {
    for (const name of ['room-tone', 'pen-scratch', 'door', 'studio-signature']) {
      const pcm = loadAsset(`${name}.wav`);
      expect(pcm.sampleRate).toBe(22050);
      expect(pcm.samples.length).toBeGreaterThan(0);
      expect(rms(pcm.samples)).toBeGreaterThan(0.001); // audible energy, not a dead file
    }
  });

  // ── §5 STUDIO SIGNATURE — low wooden settle → single high pure tone ──────────────────────────────
  describe('the studio signature is two segments: low wooden settle → high pure tone (§5)', () => {
    const sig = loadAsset('studio-signature.wav');
    const sr = sig.sampleRate;
    const split = Math.floor(0.5 * sr); // the high tone starts at 0.5s (gen-audio.mjs tStart)
    const settle = { from: 0, to: split };
    const tone = { from: split, to: sig.samples.length };

    const settleDom = dominantFrequency(sig.samples, sr, PROBES, settle.from, settle.to).freq;
    const toneDom = dominantFrequency(sig.samples, sr, PROBES, tone.from, tone.to).freq;

    it('segment A (0–0.5s) is a LOW wooden settle', () => {
      expect(settleDom).toBeLessThan(200); // measured 82 Hz — a low thud, not a tone
      expect(rms(sig.samples, settle.from, settle.to)).toBeGreaterThan(0.005);
    });

    it('segment B (0.5s–end) is a HIGH tone, an order above the settle', () => {
      expect(toneDom).toBeGreaterThan(600); // measured 880 Hz (A5)
      expect(toneDom / settleDom).toBeGreaterThan(3); // measured ~10.7× — the settle→tone leap
      expect(rms(sig.samples, tone.from, tone.to)).toBeGreaterThan(0.005);
    });

    it('segment B is near-monotone — a single PURE tone, not a chord/noise (§5)', () => {
      const p = purity(sig.samples, sr, PROBES, tone.from, tone.to);
      expect(p).toBeGreaterThan(0.9); // measured 0.999 — one bin holds the energy
    });
  });

  // ── §2 THE FIVE MINDS — one distinct instrument each ─────────────────────────────────────────────
  describe('the five per-mind instruments resolve to five DISTINCT dominant fingerprints (§2 Audio)', () => {
    const minds: Array<[string, string]> = [
      ['Warden', 'instrument-bowed.wav'],
      ['Fence', 'instrument-musicbox.wav'],
      ['Suspect', 'instrument-breath.wav'],
      ['Oracle', 'instrument-choir.wav'],
      ['Occupant', 'instrument-wire.wav'],
    ];
    const doms = minds.map(([, file]) => dominantHz(loadAsset(file)));

    it('all five dominant frequencies are unique — no two minds collide', () => {
      expect(new Set(doms).size).toBe(5);
    });

    it('every neighbouring pair is separated (closest pair still a clear >1% pitch gap)', () => {
      const sorted = [...doms].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] / sorted[i - 1]).toBeGreaterThan(1.01); // measured closest 98↔110 = 1.12×
      }
    });

    it('each instrument sits in its designed register (§2: bowed low ↔ music-box high tines)', () => {
      const by = Object.fromEntries(minds.map(([m], i) => [m, doms[i]]));
      expect(by.Warden).toBeLessThan(200); // bowed metal — a low cold drone (98 Hz)
      expect(by.Occupant).toBeLessThan(200); // struck wire — low (110 Hz)
      expect(by.Oracle).toBeGreaterThan(180); // sine choir — mid (~220 Hz)
      expect(by.Fence).toBeGreaterThan(900); // music box — high tines (>1kHz)
    });
  });

  // ── §2 COMPOSURE DETUNE — the tone sinks ~1 semitone as the séance breaks ─────────────────────────
  describe('composure detune sags the pitch ~1 semitone at full break (§2, director MAX_DETUNE)', () => {
    const bowed = loadAsset('instrument-bowed.wav');
    const [from, to] = analysisWindow(bowed);
    // Resample the instrument as the AudioDirector's setRate would at full composure break, then measure
    // how far the dominant dropped — proves the detune is a real pitch shift, not just a constant in code.
    const intact = refinePeak(bowed.samples, bowed.sampleRate, 90, 106, 0.05, from, to);
    const broken = resamplePlayback(bowed.samples, 1 - MAX_DETUNE);
    const detuned = refinePeak(broken, bowed.sampleRate, 84, 100, 0.05, from, to);

    it('MAX_DETUNE is a ~1-semitone downward sag (2^(-1/12) ≈ 0.943)', () => {
      const rate = 1 - MAX_DETUNE;
      expect(rate).toBeGreaterThan(2 ** (-1.5 / 12)); // within half a semitone of one semitone down
      expect(rate).toBeLessThan(2 ** (-0.5 / 12));
    });

    it('the resampled instrument really drops ~1 semitone in dominant pitch', () => {
      const ratio = intact / detuned; // measured 1.0606×
      expect(ratio).toBeGreaterThan(2 ** (0.5 / 12)); // >½ semitone up (intact vs broken)
      expect(ratio).toBeLessThan(2 ** (1.5 / 12)); // <1½ semitone — a ~1-semitone sag, band-checked
      expect(Math.abs(ratio - SEMITONE)).toBeLessThan(0.02); // clusters on exactly one semitone
    });
  });

  it('the analysis window is bounded (numerical stability of the low bins over the 8s drones)', () => {
    expect(ANALYSIS_SECONDS).toBeGreaterThan(0);
    expect(ANALYSIS_SECONDS).toBeLessThanOrEqual(4);
  });
});
