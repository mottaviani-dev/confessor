// Which model backend to use — pure decision, no I/O, so it is exhaustively unit-testable on any box.
// The engine never sees this; the provider resolves a concrete LlmFn and injects it.

export type BackendKind = 'on-device' | 'cloud';

export interface BackendEnv {
  /** Platform.OS */
  readonly platformOS: string;
  /** Device.isDevice — false on a Simulator, where Metal (and thus llama.rn inference) cannot run. */
  readonly isDevice: boolean;
  /** Whether `require('llama.rn')` resolved (the native module is linked into this build). */
  readonly hasNativeModule: boolean;
  /** Dev override: keep using the cloud stub even on a capable device (e.g. iterating in a dev build). */
  readonly forceCloud: boolean;
}

/**
 * On-device only when every condition holds: not forced to cloud, real iOS hardware (not a Simulator),
 * and the native module is present. Anything else → the cloud stub. Ships as the dev/fallback path;
 * production builds simply never satisfy `forceCloud` and always carry the native module.
 */
export function selectBackend(env: BackendEnv): BackendKind {
  if (env.forceCloud) return 'cloud';
  if (env.platformOS !== 'ios') return 'cloud';
  if (!env.isDevice) return 'cloud';
  if (!env.hasNativeModule) return 'cloud';
  return 'on-device';
}
