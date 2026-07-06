import { describe, it, expect, vi } from 'vitest';
import { selectBackend, type BackendEnv } from './backendSelect';
import { toCompletionParams } from './completionParams';
import { createModelDownloader, type DownloadDeps, type DownloadState, type ModelSpec } from './modelDownload';
import { makeOnDeviceLlm, type LlamaHandle } from './onDeviceLlama';
import { createLlmProvider, type ProviderState } from './provider';
import {
  InsufficientMemoryError,
  ModelIntegrityError,
  ModelDownloadError,
  InferenceTimeoutError,
  InferenceError,
  LlmError,
} from './errors';
import { RATING_JSON_SCHEMA } from '../engine/schema';
import type { LlmFn } from '../engine/types';

// ─── backend selection (pure, exhaustive) ─────────────────────────────────────────────────────────
describe('selectBackend', () => {
  const base: BackendEnv = { platformOS: 'ios', isDevice: true, hasNativeModule: true, forceCloud: false };
  it('picks on-device only when iOS + real device + native module + not forced', () => {
    expect(selectBackend(base)).toBe('on-device');
  });
  it('falls back to cloud for every disqualifier', () => {
    expect(selectBackend({ ...base, forceCloud: true })).toBe('cloud'); // dev override
    expect(selectBackend({ ...base, platformOS: 'android' })).toBe('cloud');
    expect(selectBackend({ ...base, platformOS: 'web' })).toBe('cloud');
    expect(selectBackend({ ...base, isDevice: false })).toBe('cloud'); // Simulator — Metal can't run
    expect(selectBackend({ ...base, hasNativeModule: false })).toBe('cloud');
  });
});

// ─── VOICE vs RATING → completion params (the schema→grammar mapping) ──────────────────────────────
describe('toCompletionParams', () => {
  it('VOICE (no jsonSchema) → warm, freeform, no grammar', () => {
    const p = toCompletionParams('sys', 'usr', { temperature: 0.7, maxTokens: 200 });
    expect(p.temperature).toBe(0.7);
    expect(p.n_predict).toBe(200);
    expect(p.json_schema).toBeUndefined();
    expect(p.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });
  it('RATING (jsonSchema set) → cold, capped, grammar-constrained', () => {
    const p = toCompletionParams('sys', 'usr', { temperature: 0, maxTokens: 160, jsonSchema: RATING_JSON_SCHEMA });
    expect(p.temperature).toBe(0);
    expect(p.n_predict).toBe(160);
    expect(p.json_schema).toBe(RATING_JSON_SCHEMA);
  });
  it('defaults match the cloud stub when options are omitted', () => {
    const p = toCompletionParams('s', 'u');
    expect(p.temperature).toBe(0.7);
    expect(p.n_predict).toBe(200);
    expect(p.json_schema).toBeUndefined();
  });
});

// ─── typed error hierarchy ────────────────────────────────────────────────────────────────────────
describe('errors', () => {
  it('are instanceof LlmError and carry their fields', () => {
    const mem = new InsufficientMemoryError('m', 100, 200);
    expect(mem).toBeInstanceOf(LlmError);
    expect(mem.availableBytes).toBe(100);
    expect(mem.requiredBytes).toBe(200);
    expect(new InferenceTimeoutError('t')).toBeInstanceOf(InferenceError);
    const integ = new ModelIntegrityError('bad', 'aaa', 'bbb');
    expect(integ.expected).toBe('aaa');
    expect(integ.actual).toBe('bbb');
    expect(new ModelIntegrityError('x', 'a', 'b').name).toBe('ModelIntegrityError');
  });
});

// ─── download state machine (exhaustive transitions, fully faked deps) ─────────────────────────────
const SPEC: ModelSpec = {
  url: 'https://example/model.gguf',
  fileName: 'model.gguf',
  sha256: 'GOOD',
  sizeBytes: 1000,
  minAvailableBytes: 500,
};

function fakeDeps(over: Partial<DownloadDeps>): DownloadDeps {
  return {
    fileExists: async () => false,
    fileSize: async () => 1000,
    sha256: async () => 'GOOD',
    deleteFile: async () => undefined,
    startResumableDownload: async (_u, _d, onProgress) => {
      onProgress(500, 1000);
      onProgress(1000, 1000);
    },
    availableMemory: async () => 1_000_000,
    docDir: '/docs',
    ...over,
  };
}

describe('createModelDownloader', () => {
  it('downloads fresh, verifies, and reaches ready — emitting the full state sequence', async () => {
    const states: DownloadState[] = [];
    const dl = createModelDownloader(SPEC, fakeDeps({}), { onState: (s) => states.push(s) });
    const ready = await dl.ensure();
    expect(ready.path).toBe('/docs/model.gguf');
    expect(dl.state.kind).toBe('ready');
    // checking → downloading(start) → downloading(50%) → downloading(100%) → verifying → ready
    expect(states.map((s) => s.kind)).toEqual([
      'checking',
      'downloading',
      'downloading',
      'downloading',
      'verifying',
      'ready',
    ]);
  });

  it('short-circuits to ready when a valid file already exists (no download)', async () => {
    const startResumableDownload = vi.fn(async () => undefined);
    const dl = createModelDownloader(SPEC, fakeDeps({ fileExists: async () => true, startResumableDownload }));
    const ready = await dl.ensure();
    expect(ready.kind).toBe('ready');
    expect(startResumableDownload).not.toHaveBeenCalled();
  });

  it('re-downloads (delete + fetch) when an existing file has the wrong size', async () => {
    const deleteFile = vi.fn(async () => undefined);
    const start = vi.fn(async () => undefined);
    const dl = createModelDownloader(
      SPEC,
      fakeDeps({
        fileExists: async () => true,
        fileSize: async () => 999, // wrong size → invalid → must delete + re-download
        startResumableDownload: start,
        deleteFile,
      }),
    );
    const ready = await dl.ensure();
    expect(ready.kind).toBe('ready');
    expect(deleteFile).toHaveBeenCalledWith('/docs/model.gguf');
    expect(start).toHaveBeenCalled();
  });

  it('degrades on low memory and throws InsufficientMemoryError', async () => {
    const dl = createModelDownloader(SPEC, fakeDeps({ availableMemory: async () => 100 }));
    await expect(dl.ensure()).rejects.toBeInstanceOf(InsufficientMemoryError);
    expect(dl.state.kind).toBe('degraded');
  });

  it('deletes and throws ModelIntegrityError on a sha mismatch', async () => {
    const deleteFile = vi.fn(async () => undefined);
    const dl = createModelDownloader(SPEC, fakeDeps({ sha256: async () => 'BAD', deleteFile }));
    await expect(dl.ensure()).rejects.toBeInstanceOf(ModelIntegrityError);
    expect(deleteFile).toHaveBeenCalled();
    expect(dl.state.kind).toBe('failed');
  });

  it('wraps a transfer failure in ModelDownloadError', async () => {
    const dl = createModelDownloader(
      SPEC,
      fakeDeps({
        startResumableDownload: async () => {
          throw new Error('socket reset');
        },
      }),
    );
    await expect(dl.ensure()).rejects.toBeInstanceOf(ModelDownloadError);
    expect(dl.state.kind).toBe('failed');
  });
});

// ─── on-device adapter (timeout + error wrapping, via a fake handle) ────────────────────────────────
describe('makeOnDeviceLlm', () => {
  const okHandle = (text: string): LlamaHandle => ({ complete: async () => text, stop: async () => undefined });

  it('passes params through and returns the raw text', async () => {
    const seen: unknown[] = [];
    const handle: LlamaHandle = { complete: async (p) => (seen.push(p), 'reply'), stop: async () => undefined };
    const llm = makeOnDeviceLlm(handle);
    expect(await llm('sys', 'usr', { temperature: 0, maxTokens: 160, jsonSchema: RATING_JSON_SCHEMA })).toBe('reply');
    expect(seen[0]).toMatchObject({ temperature: 0, n_predict: 160, json_schema: RATING_JSON_SCHEMA });
  });

  it('wraps a native failure in InferenceError', async () => {
    const handle: LlamaHandle = {
      complete: async () => {
        throw new Error('metal oom');
      },
      stop: async () => undefined,
    };
    await expect(makeOnDeviceLlm(handle)('s', 'u')).rejects.toBeInstanceOf(InferenceError);
  });

  it('times out a hung completion, stops it, and rejects InferenceTimeoutError', async () => {
    vi.useFakeTimers();
    try {
      const stop = vi.fn(async () => undefined);
      const handle: LlamaHandle = { complete: () => new Promise<string>(() => {}), stop };
      const p = makeOnDeviceLlm(handle, { timeoutMs: 1000 })('s', 'u');
      const assertion = expect(p).rejects.toBeInstanceOf(InferenceTimeoutError);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing suspicious for a fast completion (baseline)', async () => {
    expect(await makeOnDeviceLlm(okHandle('hi'))('s', 'u')).toBe('hi');
  });
});

// ─── provider orchestration (backend routing + lifecycle states, via injected deps) ─────────────────
describe('createLlmProvider', () => {
  const cloudEnv: BackendEnv = { platformOS: 'android', isDevice: true, hasNativeModule: false, forceCloud: false };
  const deviceEnv: BackendEnv = { platformOS: 'ios', isDevice: true, hasNativeModule: true, forceCloud: false };
  const cloudLlm: LlmFn = async () => 'cloud';
  const deviceLlm: LlmFn = async () => 'device';

  it('routes to the cloud backend instantly and reports ready', async () => {
    const states: ProviderState[] = [];
    const p = createLlmProvider(
      { env: cloudEnv, makeCloudLlm: () => cloudLlm, prepareOnDeviceLlm: async () => deviceLlm },
      { onState: (s) => states.push(s) },
    );
    const llm = await p.prepare();
    expect(await llm('s', 'u')).toBe('cloud');
    expect(p.state).toEqual({ kind: 'ready', backend: 'cloud' });
    expect(states.map((s) => s.kind)).toEqual(['selecting', 'ready']);
  });

  it('routes to on-device, streaming the download state through to ready', async () => {
    const states: ProviderState[] = [];
    const p = createLlmProvider(
      {
        env: deviceEnv,
        makeCloudLlm: () => cloudLlm,
        prepareOnDeviceLlm: async (onDownload) => {
          onDownload({ kind: 'downloading', received: 5, total: 10 });
          onDownload({ kind: 'ready', path: '/m.gguf' });
          return deviceLlm;
        },
      },
      { onState: (s) => states.push(s) },
    );
    const llm = await p.prepare();
    expect(await llm('s', 'u')).toBe('device');
    expect(p.state).toEqual({ kind: 'ready', backend: 'on-device' });
    expect(states.map((s) => s.kind)).toEqual(['selecting', 'preparing-model', 'preparing-model', 'loading', 'ready']);
  });

  it('surfaces a typed failure with no silent cloud fallback', async () => {
    const err = new InsufficientMemoryError('too small', 1, 2);
    const p = createLlmProvider({
      env: deviceEnv,
      makeCloudLlm: () => cloudLlm,
      prepareOnDeviceLlm: async () => {
        throw err;
      },
    });
    await expect(p.prepare()).rejects.toBe(err);
    expect(p.state).toEqual({ kind: 'failed', error: err });
  });
});
