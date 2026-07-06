import type { LlmFn } from '../engine/types';
import { selectBackend, type BackendEnv, type BackendKind } from './backendSelect';
import type { DownloadState } from './modelDownload';
import { LlmError } from './errors';

// Orchestrates backend selection → model preparation → a ready LlmFn, surfacing typed lifecycle states
// to the UI. The engine never sees any of this: the provider resolves a concrete LlmFn and App.tsx
// injects it into resolveTurn. All native work is injected via ProviderDeps, so the flow is testable
// on any box; nativeBridge.ts supplies the real deps in the app.

export type ProviderState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'selecting' }
  | { readonly kind: 'preparing-model'; readonly download: DownloadState }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly backend: BackendKind }
  | { readonly kind: 'failed'; readonly error: LlmError };

export interface ProviderDeps {
  readonly env: BackendEnv;
  /** Instant — the OpenAI-compatible dev/fallback backend. */
  readonly makeCloudLlm: () => LlmFn;
  /** Download (streaming its state via onDownload) + load the context + build the on-device LlmFn. */
  readonly prepareOnDeviceLlm: (onDownload: (s: DownloadState) => void, signal?: AbortSignal) => Promise<LlmFn>;
}

export interface LlmProvider {
  /** Resolve a ready LlmFn, or throw a typed LlmError (state also reflects the failure). */
  prepare(signal?: AbortSignal): Promise<LlmFn>;
  readonly state: ProviderState;
}

export function createLlmProvider(deps: ProviderDeps, hooks?: { readonly onState?: (s: ProviderState) => void }): LlmProvider {
  let state: ProviderState = { kind: 'idle' };
  const set = (next: ProviderState): ProviderState => {
    state = next;
    hooks?.onState?.(next);
    return next;
  };

  const prepare = async (signal?: AbortSignal): Promise<LlmFn> => {
    set({ kind: 'selecting' });
    const backend = selectBackend(deps.env);

    if (backend === 'cloud') {
      const llm = deps.makeCloudLlm();
      set({ kind: 'ready', backend });
      return llm;
    }

    try {
      const llm = await deps.prepareOnDeviceLlm((download) => set({ kind: 'preparing-model', download }), signal);
      set({ kind: 'loading' }); // the adapter is built; context is warm
      set({ kind: 'ready', backend });
      return llm;
    } catch (err) {
      // No silent cloud fallback in production: a shipped build carries no API key, so falling back would
      // just fail differently and hide the real cause. Surface the typed error; the UI decides what to show.
      const error = err instanceof LlmError ? err : new LlmError(err instanceof Error ? err.message : String(err));
      set({ kind: 'failed', error });
      throw error;
    }
  };

  return {
    prepare,
    get state() {
      return state;
    },
  };
}
