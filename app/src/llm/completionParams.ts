import type { LlmOptions } from '../engine/types';

// The VOICE/RATING → llama.rn completion mapping, kept pure and OUT of the native adapter so it is
// unit-testable on any box. The engine's per-call LlmOptions are the only difference between the two
// calls; this turns them into concrete llama.cpp completion params.

export interface LlamaMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export interface LlamaCompletionParams {
  readonly messages: readonly LlamaMessage[];
  readonly temperature: number;
  readonly n_predict: number;
  /** Present ONLY for the RATING call — llama.rn converts it to a GBNF grammar and constrains tokens.
   *  Absent for VOICE → freeform prose. Same defaults as the cloud stub so behavior matches. */
  readonly json_schema?: Readonly<Record<string, unknown>>;
}

export function toCompletionParams(system: string, user: string, options?: LlmOptions): LlamaCompletionParams {
  const base: LlamaCompletionParams = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: options?.temperature ?? 0.7,
    n_predict: options?.maxTokens ?? 200,
  };
  // Only attach json_schema when the engine asked for it, so VOICE stays unconstrained.
  return options?.jsonSchema ? { ...base, json_schema: options.jsonSchema } : base;
}
