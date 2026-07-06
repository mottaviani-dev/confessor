// Typed error hierarchy for the model backend. One throw channel per failure (never a reject AND a
// callback); callers branch on `instanceof`. Fields are readonly and set in the constructor — an Error
// is never mutated after the fact.

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** No usable backend: not iOS, a Simulator (Metal can't run there), or the native module is absent. */
export class BackendUnavailableError extends LlmError {}

/** The first-run model download failed at a named stage (network, write, resume). */
export class ModelDownloadError extends LlmError {
  constructor(message: string, readonly stage: string, readonly cause?: unknown) {
    super(message);
  }
}

/** The downloaded file is the wrong size or hash — corrupt or truncated; it is deleted before throwing. */
export class ModelIntegrityError extends LlmError {
  constructor(message: string, readonly expected: string, readonly actual: string) {
    super(message);
  }
}

/** Not enough headroom to load the model on this device — degrade gracefully, do not hard-crash. */
export class InsufficientMemoryError extends LlmError {
  constructor(message: string, readonly availableBytes: number, readonly requiredBytes: number) {
    super(message);
  }
}

/** llama.cpp could not initialize a context from the weights. */
export class ModelLoadError extends LlmError {}

/** A completion call failed at runtime. */
export class InferenceError extends LlmError {}

/** A completion exceeded its time budget and was cancelled. */
export class InferenceTimeoutError extends InferenceError {}
