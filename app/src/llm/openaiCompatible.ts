import type { LlmFn } from '../engine/types';

// Phase-1 model backend: any OpenAI-compatible chat endpoint. Default = OpenRouter serving the EXACT
// on-device target model (Llama 3.2 3B), so the game-design playtest uses representative model quality.
// Phase 2 swaps this whole file for a llama.rn on-device call — the engine never changes (injected LlmFn).

export interface LlmConfig {
  endpoint: string; // e.g. https://openrouter.ai/api/v1
  apiKey: string;
  model: string; // e.g. meta-llama/llama-3.2-3b-instruct
}

// Config comes from the gitignored src/llm/config.local.ts (imported, deterministic — Metro's env
// inlining proved flaky). DEV/TEST cloud backend only; the SHIPPED product runs on-device (no key).
// Phase 2 swaps this whole file for a llama.rn on-device call.
import { LLM } from './config.local';
export const BUILD_LLM_CONFIG: LlmConfig = LLM;

// Some OpenRouter providers (Cloudflare Workers AI, sole llama-3.2-3b host as of 2026-07-05) run an
// always-on function-call parser over the completion: a reply that IS a bare JSON object gets eaten
// into a phantom tool_call and `content` comes back null/empty — with `tools` absent, `tool_choice:
// 'none'`, and even with `response_format: json_schema`. A fenced JSON reply passes through intact, and
// the engine's parseRating/extractJson already tolerates fences. So for constrained calls this cloud
// stand-in asks for the fence; on-device (llama.rn GBNF / @Generable) never sees this file.
const FENCE_HINT = '\nWrap the JSON object in a ```json code fence.';

export function makeLlm(cfg: LlmConfig): LlmFn {
  return async (systemPrompt, userPrompt, options) => {
    const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        // Per-call sampling: the engine runs VOICE warm (creative) and RATING cold (a consistent
        // referee). Defaults match the old shared values so any two-arg caller is unchanged.
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 200,
        // Function-calling-tuned models (Llama 3.x) otherwise route a JSON-output prompt into an empty
        // tool_call. Forbid tools → the model returns the JSON as plain text content, which we parse.
        tool_choice: 'none',
        // Deliberately NO `response_format: json_schema` here: the current sole provider for the
        // ship-target 3B routes ANY schema-constrained call into a phantom tool_call with null content
        // (verified 2026-07-05 — it broke every rating, freezing trust at 0 across all scenarios). The
        // constrained-decode hint instead becomes the FENCE_HINT above; on-device GBNF still enforces
        // the schema for real. The tolerant parse boundary (schema.parseRating) covers the cloud gap.
        messages: [
          { role: 'system', content: options?.jsonSchema ? systemPrompt + FENCE_HINT : systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  };
}
