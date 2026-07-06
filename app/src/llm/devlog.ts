// Dev-only diagnostics. The spike-era console logging, gated so production builds are silent.
// (__DEV__ is Metro's build-time flag; the typeof guard keeps node/tsx harness runs working.)
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export function devlog(...args: readonly unknown[]): void {
  // eslint-disable-next-line no-console
  if (DEV) console.log(...args);
}
