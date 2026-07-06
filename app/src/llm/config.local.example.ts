import type { LlmConfig } from './openaiCompatible';

// Copy to config.local.ts (gitignored) and fill in a key. DEV/TEST backend only — the shipped app
// runs the model ON-DEVICE via llama.rn (no cloud, no key). Any OpenAI-compatible endpoint works.
export const LLM: LlmConfig = {
  endpoint: 'https://openrouter.ai/api/v1',
  model: 'meta-llama/llama-3.1-8b-instruct', // dev stand-in; on-device target is Llama 3.2 3B / Gemma 3 4B
  apiKey: 'YOUR_KEY_HERE',
};
