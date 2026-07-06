# Expo SDK 54

This app targets **Expo SDK 54** (to match the Expo Go on Matteo's phone). Read the exact versioned docs
at https://docs.expo.dev/versions/v54.0.0/ before writing Expo/React-Native code — APIs move between SDKs.

`llama.rn` (the on-device model) needs a dev build / prebuild — it does NOT run in Expo Go. The cloud
backend in `src/llm/config.local.ts` is the dev stand-in until the native shell is built.

## Ship decisions (2026-07-06)
- **iOS-only launch.** No Android build/submit: `android.package` intentionally absent and
  `backendSelect` routes non-iOS to the (keyless) cloud path. Wire Android properly or not at all.
- `config.local.ts` is COMMITTED and key-free (EAS remote builds need the module); the key lives only in
  gitignored `.env.local` (EXPO_PUBLIC_LLM_KEY). Judge harnesses load it via `.judge/env.mjs`.
- v1 ships without an app-level sha256 on the model download (size check + TLS only); the low-memory
  degrade gate is present but its memory read is unwired (fine on A17+; wire before widening the floor).
- Apple portal capabilities (Increased Memory Limit + Extended Virtual Addressing) were synced by EAS on
  2026-07-05 — already enabled for com.mottaviani.confessor.
- **App Store record created 2026-07-06 (Matteo): name "Confessor: Duel of Wits"**, bundle
  `com.mottaviani.confessor`, SKU CONFESSOR, ascAppId 6787791425 (wired in eas.json submit). THE STORE
  NAME IS DECIDED — the bible's VESTIBULE rebrand is superseded for the app title; "Vestibule" survives
  only if repurposed as in-fiction flavor (the room), never as the product name.
