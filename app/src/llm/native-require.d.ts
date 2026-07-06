// Metro provides `require` at runtime. We load the native modules (llama.rn, expo-file-system,
// expo-device) through it inside the FFI boundary (nativeBridge.ts) so this Windows box can typecheck
// the whole app WITHOUT the iOS pods installed. Typed as `unknown` (never `any`) — the boundary narrows
// each module to a hand-written interface and performs the single documented assertion the rules allow.
declare function require(moduleId: string): unknown;
