import { Platform, TurboModuleRegistry } from 'react-native';
import type { BackendEnv } from './backendSelect';
import type { LlamaCompletionParams } from './completionParams';
import type { DownloadDeps } from './modelDownload';
import type { LlamaHandle } from './onDeviceLlama';
import { makeOnDeviceLlm } from './onDeviceLlama';
import type { LlmFn } from '../engine/types';
import type { DownloadState, ModelSpec } from './modelDownload';
import { createModelDownloader } from './modelDownload';
import { ModelLoadError } from './errors';
import { devlog } from './devlog';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// FFI BOUNDARY — the ONLY file that touches native modules. It is loaded lazily via `require` so this
// Windows dev box typechecks the whole app without the iOS pods, and every `unknown → typed` assertion
// (the single documented FFI exception the engineering rules permit) lives here and nowhere else.
//
// ✅ DEVICE-CONFIRMED 2026-07-05 on Matteo's iPhone 17 Pro (the spike): initLlama + completion call
// shape, the preformatted-prompt path, response_format→GBNF on the RATING call, n_gpu_layers=99 Metal
// offload, and the /legacy file-system download path all ran a full duel E2E. Remaining UNWIRED (not
// unconfirmed) pieces are marked below: the sha256 native hash and the real availableMemory read.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

interface LlamaRnContext {
  completion(params: Record<string, unknown>): Promise<{ text?: string }>;
  stopCompletion(): Promise<void>;
  release?(): Promise<void>;
}
interface LlamaRnModule {
  initLlama(params: Record<string, unknown>): Promise<LlamaRnContext>;
}
interface ExpoFileInfo {
  exists: boolean;
  size?: number;
}
interface ExpoDownloadResumable {
  downloadAsync(): Promise<{ uri: string } | undefined>;
  cancelAsync(): Promise<void>;
}
interface ExpoFileSystemModule {
  documentDirectory: string | null;
  getInfoAsync(uri: string, opts?: { size?: boolean }): Promise<ExpoFileInfo>;
  deleteAsync(uri: string, opts?: { idempotent?: boolean }): Promise<void>;
  createDownloadResumable(
    url: string,
    fileUri: string,
    options: Record<string, unknown>,
    callback?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
  ): ExpoDownloadResumable;
}
interface ExpoDeviceModule {
  isDevice: boolean;
}

// Metro requires STATIC string-literal `require`s (a dynamic `require(id)` fails to bundle), so each
// module is loaded by its own literal call wrapped in try/catch — null if it isn't linked (dev/Simulator).
// The `as` on each is the single documented FFI assertion the engineering rules allow, isolated here.
function guarded<T>(load: () => unknown): T | null {
  try {
    return load() as T;
  } catch {
    return null; // module not present in this build → caller degrades to the cloud path
  }
}

const llamaRn = guarded<LlamaRnModule>(() => require('llama.rn'));
// `require('llama.rn')` resolving only proves the JS package bundled — in Expo Go it resolves while the
// NATIVE side is absent (llama.rn's index then calls RNLlama.install() on null → "Cannot read property
// 'install' of null"). Mirror the lib's own lookup (TurboModuleRegistry.get('RNLlama')) to detect the
// native module itself; null in Expo Go/Simulator, present in dev/prod builds.
const llamaNativeLinked =
  llamaRn !== null && guarded<unknown>(() => TurboModuleRegistry.get('RNLlama')) != null;
// SDK 54's `expo-file-system` default export is the NEW File/Directory API and has no
// documentDirectory/getInfoAsync/createDownloadResumable — those live under the `/legacy` entry, which
// is the API this bridge uses. Requiring the bare package returned a module without documentDirectory,
// which surfaced as "expo-file-system is unavailable" on device.
const fileSystem = guarded<ExpoFileSystemModule>(() => require('expo-file-system/legacy'));
const device = guarded<ExpoDeviceModule>(() => require('expo-device'));

/** What backendSelect needs, read from the real platform. `forceCloud` via an app-level dev flag. */
export function getBackendEnv(forceCloud = false): BackendEnv {
  return {
    platformOS: Platform.OS,
    isDevice: device?.isDevice ?? false, // no expo-device → treat as Simulator (safe: routes to cloud)
    hasNativeModule: llamaNativeLinked,
    forceCloud,
  };
}

/** Build the DownloadDeps the state machine needs from expo-file-system. */
function buildDownloadDeps(): DownloadDeps {
  const fs = fileSystem;
  if (!fs || !fs.documentDirectory) {
    throw new ModelLoadError('expo-file-system is unavailable; cannot prepare the on-device model.');
  }
  return {
    docDir: fs.documentDirectory,
    fileExists: async (path) => (await fs.getInfoAsync(path)).exists,
    fileSize: async (path) => (await fs.getInfoAsync(path, { size: true })).size ?? 0,
    // UNWIRED (v1 decision): no app-level sha256 — JS can't hash a 2.6GB file; a native hash or
    // Background Assets integrity is the eventual fix. spec.sha256='' short-circuits the check (the size
    // check still gates); HF download is TLS so integrity risk = corrupted-not-malicious.
    sha256: async () => {
      throw new ModelLoadError('sha256 not wired — set ModelSpec.sha256 to "" to skip until the spike.');
    },
    deleteFile: async (path) => fs.deleteAsync(path, { idempotent: true }),
    startResumableDownload: async (url, dest, onProgress, signal) => {
      const task = fs.createDownloadResumable(url, dest, {}, (p) =>
        onProgress(p.totalBytesWritten, p.totalBytesExpectedToWrite),
      );
      signal.addEventListener('abort', () => {
        void task.cancelAsync();
      });
      await task.downloadAsync();
    },
    // ⚠ UNWIRED: the low-memory degrade gate always passes (no runtime-headroom read yet — needs
    // os_proc_available_memory via a tiny native module). A17+/A19 devices have ample RAM for the Q6 3B,
    // so v1 ships without it; wire before widening the device floor. The state machine + degraded UI
    // path exist and are unit-tested — only this read is fake.
    availableMemory: async () => Number.MAX_SAFE_INTEGER,
  };
}

// Llama 3.2 Instruct chat format, built by hand so we pass a preformatted `prompt` and bypass llama.rn's
// `messages`→getFormattedChat path (jinja/chat-template resolution — fragile on-device). Full control +
// deterministic, which is what a small-model game wants. If the model is ever swapped (e.g. Gemma 3),
// this template changes with it.
function formatLlama3Prompt(messages: readonly { role: string; content: string }[]): string {
  let out = '<|begin_of_text|>';
  for (const m of messages) {
    out += `<|start_header_id|>${m.role}<|end_header_id|>\n\n${m.content}<|eot_id|>`;
  }
  out += '<|start_header_id|>assistant<|end_header_id|>\n\n';
  return out;
}

const STOP_TOKENS = ['<|eot_id|>', '<|end_of_text|>'];

/** Wrap a llama.rn context into the LlamaHandle onDeviceLlama depends on, mapping our completion params
 *  (a preformatted prompt + json_schema → response_format) to llama.rn's call shape. */
function wrapContext(ctx: LlamaRnContext): LlamaHandle {
  return {
    complete: async (params: LlamaCompletionParams) => {
      const native: Record<string, unknown> = {
        prompt: formatLlama3Prompt(params.messages),
        temperature: params.temperature,
        n_predict: params.n_predict,
        stop: STOP_TOKENS,
      };
      // DIAGNOSTIC: confirm the context + method exist and log the call shape.
      // eslint-disable-next-line no-console
      devlog('[confessor] completion call — ctx?', typeof ctx, 'completion?', typeof ctx?.completion, 'promptLen', String(native.prompt).length, 'hasSchema', !!params.json_schema);
      const t0 = Date.now();
      // DEVICE-CONFIRMED: llama.rn reads response_format.json_schema.schema → GBNF grammar and the
      // RATING call completed constrained on-device (hasSchema=true, 2026-07-05). Schema uses no regex
      // shorthands, so the converter's silent \d \w \s drop doesn't bite.
      if (params.json_schema) {
        native.response_format = { type: 'json_schema', json_schema: { schema: params.json_schema } };
      }
      const result = await ctx.completion(native).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        devlog('[confessor] completion THREW after', Date.now() - t0, 'ms:', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        throw err;
      });
      // eslint-disable-next-line no-console
      devlog('[confessor] completion OK after', Date.now() - t0, 'ms — textLen', (result.text ?? '').length);
      return result.text ?? '';
    },
    stop: async () => {
      await ctx.stopCompletion();
    },
  };
}

/**
 * Full on-device path: download+verify the model (streaming DownloadState), init a warm llama context,
 * and return the engine's LlmFn. Injected into the provider as `prepareOnDeviceLlm`.
 */
export function prepareOnDeviceLlm(spec: ModelSpec) {
  return async (onDownload: (s: DownloadState) => void, signal?: AbortSignal): Promise<LlmFn> => {
    if (!llamaRn || !llamaNativeLinked)
      throw new ModelLoadError('llama.rn native module is not linked into this build (Expo Go/Simulator) — use the cloud backend.');
    const deps = buildDownloadDeps();
    // Skip the (unwired) hash check when the spec opts out with an empty sha — size-only until the spike.
    const effectiveDeps: DownloadDeps = spec.sha256 === '' ? { ...deps, sha256: async () => '' } : deps;

    const downloader = createModelDownloader(spec, effectiveDeps, { onState: onDownload });
    const ready = await downloader.ensure(signal);

    // DEVICE-CONFIRMED: n_gpu_layers=99 full Metal offload ≈1.2-2.8s/call warm on the A19 Pro
    // (CPU-only was ~9.5s). n_ctx 2048 fits the short-context engine design.
    // Full Metal offload (A17+/A19 Pro GPU). 99 ≫ the 3B's layer count so every layer runs on the GPU.
    // (The earlier CPU test was to rule out a Metal crash that turned out to be the React setState bug.)
    // eslint-disable-next-line no-console
    devlog('[confessor] initLlama — model', ready.path, '(n_gpu_layers=99 Metal)');
    const ctx = await llamaRn.initLlama({ model: ready.path, n_ctx: 2048, n_gpu_layers: 99 }).catch((e: unknown) => {
      throw new ModelLoadError(`Failed to init llama context: ${e instanceof Error ? e.message : String(e)}`);
    });
    // eslint-disable-next-line no-console
    devlog('[confessor] initLlama OK — ctx', typeof ctx, 'completion?', typeof ctx?.completion, 'stopCompletion?', typeof ctx?.stopCompletion);
    // Longer timeout: first on-device inference includes prefill + (on Metal) shader compile — 30s is too tight.
    return makeOnDeviceLlm(wrapContext(ctx), { timeoutMs: 120_000 });
  };
}
