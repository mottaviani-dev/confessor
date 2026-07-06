import { InsufficientMemoryError, LlmError, ModelDownloadError, ModelIntegrityError } from './errors';

// First-run model delivery as an explicit state machine (named states + transitions, not scattered
// flags). The GGUF weights (1–2GB) are NOT bundled in the binary — App Store rejects that — so they are
// downloaded to the app document directory on first launch, resumably, verified by sha256, and gated on
// a runtime memory precheck. All OS/native I/O is injected via `DownloadDeps` so the machine is fully
// unit-testable on any box; the real deps live behind the native bridge.

export type DownloadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'downloading'; readonly received: number; readonly total: number }
  | { readonly kind: 'verifying' }
  | { readonly kind: 'ready'; readonly path: string }
  | { readonly kind: 'degraded'; readonly reason: 'memory'; readonly availableBytes: number }
  | { readonly kind: 'failed'; readonly error: LlmError };

export interface ModelSpec {
  readonly url: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  /** Refuse to even download/load below this much runtime headroom — degrade instead of OOM-crashing. */
  readonly minAvailableBytes: number;
}

/** Every OS touch the machine needs, injected so tests run without native modules. */
export interface DownloadDeps {
  readonly fileExists: (path: string) => Promise<boolean>;
  readonly fileSize: (path: string) => Promise<number>;
  readonly sha256: (path: string) => Promise<string>;
  readonly deleteFile: (path: string) => Promise<void>;
  readonly startResumableDownload: (
    url: string,
    dest: string,
    onProgress: (received: number, total: number) => void,
    signal: AbortSignal,
  ) => Promise<void>;
  readonly availableMemory: () => Promise<number>;
  readonly docDir: string;
}

export interface DownloadHooks {
  /** Telemetry/lifecycle — every state transition is emitted here for the UI. */
  readonly onState?: (state: DownloadState) => void;
}

export interface ModelDownloader {
  /** Resolve the model to a ready file, or throw a typed LlmError. Idempotent: a valid existing file
   *  short-circuits straight to `ready`. Cancellable via the optional signal. */
  ensure(signal?: AbortSignal): Promise<Extract<DownloadState, { kind: 'ready' }>>;
  readonly state: DownloadState;
}

export function createModelDownloader(spec: ModelSpec, deps: DownloadDeps, hooks?: DownloadHooks): ModelDownloader {
  const path = joinPath(deps.docDir, spec.fileName);
  let state: DownloadState = { kind: 'idle' };

  const set = (next: DownloadState): DownloadState => {
    state = next;
    hooks?.onState?.(next);
    return next;
  };

  // A single failure channel: record the state (telemetry) AND throw the SAME error object. Callers get
  // one thing to catch; the UI reads `state`. Never a reject-and-callback split for one failure.
  const fail = (error: LlmError): never => {
    set({ kind: 'failed', error });
    throw error;
  };

  const isValidExisting = async (): Promise<boolean> => {
    if (!(await deps.fileExists(path))) return false;
    if ((await deps.fileSize(path)) !== spec.sizeBytes) return false;
    return (await deps.sha256(path)) === spec.sha256;
  };

  const ensure = async (signal?: AbortSignal): Promise<Extract<DownloadState, { kind: 'ready' }>> => {
    try {
      set({ kind: 'checking' });
      if (await isValidExisting()) {
        return set({ kind: 'ready', path }) as Extract<DownloadState, { kind: 'ready' }>;
      }

      const available = await deps.availableMemory();
      if (available < spec.minAvailableBytes) {
        // `degraded` is its own terminal state (a distinct UI: "this device can't run the model"), so it
        // must NOT be overwritten by `failed` — throw the typed error directly, leaving state = degraded.
        set({ kind: 'degraded', reason: 'memory', availableBytes: available });
        throw new InsufficientMemoryError(
          `Not enough memory to run the on-device model (have ${available}, need ${spec.minAvailableBytes}).`,
          available,
          spec.minAvailableBytes,
        );
      }

      // A stale/partial or wrong-size file must not poison a resume; clear it before a fresh pull.
      if (await deps.fileExists(path)) await deps.deleteFile(path);

      const ctl = new AbortController();
      const onAbort = () => ctl.abort();
      signal?.addEventListener('abort', onAbort);
      try {
        set({ kind: 'downloading', received: 0, total: spec.sizeBytes });
        await deps.startResumableDownload(
          spec.url,
          path,
          (received, total) => set({ kind: 'downloading', received, total: total || spec.sizeBytes }),
          ctl.signal,
        );
      } catch (cause) {
        return fail(new ModelDownloadError('Model download failed.', 'transfer', cause));
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }

      set({ kind: 'verifying' });
      const actual = await deps.sha256(path);
      if (actual !== spec.sha256) {
        await deps.deleteFile(path).catch(() => undefined); // best-effort cleanup; the integrity error is the signal
        return fail(new ModelIntegrityError('Downloaded model failed its integrity check.', spec.sha256, actual));
      }

      return set({ kind: 'ready', path }) as Extract<DownloadState, { kind: 'ready' }>;
    } catch (err) {
      // A typed LlmError was thrown deliberately (via fail(), or the degraded branch) with state already
      // set — rethrow it untouched. Anything else is an unexpected fault: wrap it so the one channel
      // stays typed, and never swallow it.
      if (err instanceof LlmError) throw err;
      return fail(new ModelDownloadError('Unexpected error preparing the model.', 'unknown', err));
    }
  };

  return {
    ensure,
    get state() {
      return state;
    },
  };
}

/** Join a dir + file with exactly one slash, tolerant of a trailing slash on the dir. */
function joinPath(dir: string, file: string): string {
  return `${dir.replace(/\/+$/, '')}/${file}`;
}
