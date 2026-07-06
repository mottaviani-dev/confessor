import type { LlmConfig } from './openaiCompatible';

// DEV/TEST cloud backend config — COMMITTED and key-free (was gitignored, which broke fresh EAS remote
// builds: Metro can't resolve a module that isn't in the repo). The secret lives ONLY in the gitignored
// `.env.local` as EXPO_PUBLIC_LLM_KEY (inlined by Expo at bundle time; loaded by expo/tsx runs alike).
// Without a key this backend is present but unusable (401 at call time) — which is correct: the SHIPPED
// product runs the model ON-DEVICE via llama.rn and never touches this path.
// Ship-target rule (Somnia bible §7): the dev model MUST be the exact on-device target class.
export const LLM: LlmConfig = {
  endpoint: process.env.EXPO_PUBLIC_LLM_ENDPOINT ?? 'https://openrouter.ai/api/v1',
  model: process.env.EXPO_PUBLIC_LLM_MODEL ?? 'meta-llama/llama-3.2-3b-instruct',
  apiKey: process.env.EXPO_PUBLIC_LLM_KEY ?? '',
};
