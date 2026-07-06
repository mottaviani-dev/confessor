import type { ModelSpec } from './modelDownload';

// The on-device model downloaded on first launch. Baseline pick for the first device spike: Llama 3.2 3B
// Instruct Q6_K (2.64GB) — fastest path that validates the whole pipeline on an A17+ phone. The 17 Pro
// (A19 Pro, ~12GB) can later carry a bigger/better model (Gemma 3 4B, or Q8) — swap the url/size here.
// The HF `resolve/main` URL is stable and 302-redirects to a signed CDN link; the downloader follows it.
//
// sha256: '' intentionally SKIPS the integrity check for now (JS can't hash a 2.6GB file; a native hash
// or Background Assets integrity gets wired post-spike). Size gates the "already downloaded?" check.
export const MODEL_SPEC: ModelSpec = {
  url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q6_K.gguf',
  fileName: 'llama-3.2-3b-instruct-q6_k.gguf',
  sha256: '',
  sizeBytes: 2_643_853_856, // real content-length (HEAD 2026-07-05)
  minAvailableBytes: 3_200_000_000, // ~2.64GB weights + kv-cache headroom before we degrade instead of OOM
};
