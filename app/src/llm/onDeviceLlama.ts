import type { LlmFn } from '../engine/types';
import type { LlamaCompletionParams } from './completionParams';
import { toCompletionParams } from './completionParams';
import { InferenceError, InferenceTimeoutError } from './errors';
import { devlog } from './devlog';

// The on-device adapter: turns a loaded llama.cpp context into the engine's injected `LlmFn`. It depends
// only on the small `LlamaHandle` interface (not on llama.rn directly), so its timeout/cancellation and
// error-wrapping are unit-testable on any box; the real handle is built in nativeBridge.ts.

export interface LlamaHandle {
  /** Run one completion, returning the raw generated text (the engine parses it). */
  complete(params: LlamaCompletionParams): Promise<string>;
  /** Interrupt the in-flight completion (used by the timeout). */
  stop(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Build an `LlmFn` over a warm, persistent context (loaded once — VOICE stays warm between calls). Adds
 * a built-in timeout/cancellation (not caller-only): a completion that overruns is stopped and rejects
 * `InferenceTimeoutError`. Any other native failure is wrapped in `InferenceError` — one error channel.
 */
export function makeOnDeviceLlm(handle: LlamaHandle, opts?: { readonly timeoutMs?: number }): LlmFn {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (systemPrompt, userPrompt, options) => {
    const params = toCompletionParams(systemPrompt, userPrompt, options);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await new Promise<string>((resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          // eslint-disable-next-line no-console
          devlog('[confessor] TIMEOUT fired after', timeoutMs, 'ms — stopping completion');
          handle.stop().catch(() => undefined); // best-effort interrupt; the timeout error is the signal
          reject(new InferenceTimeoutError(`On-device completion exceeded ${timeoutMs}ms.`));
        }, timeoutMs);
        handle.complete(params).then(resolve, reject);
      });
    } catch (e) {
      if (timedOut || e instanceof InferenceTimeoutError) {
        throw e instanceof InferenceTimeoutError ? e : new InferenceTimeoutError(`On-device completion exceeded ${timeoutMs}ms.`);
      }
      // DIAGNOSTIC: surface the raw error name + message + stack so we can see WHERE it dies.
      const name = e instanceof Error ? e.name : typeof e;
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      devlog('[confessor] inference error:', name, '::', msg, '\n', e instanceof Error ? e.stack : e);
      throw new InferenceError(`${name}: ${msg}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
