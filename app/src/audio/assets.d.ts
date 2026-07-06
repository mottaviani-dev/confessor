// Metro bundles `.wav` as an asset (it is in Metro's default `assetExts`); a static `import` of one
// resolves to the opaque asset module id expo-audio's `createAudioPlayer` accepts. Typed as `number`
// (the runtime asset registry id) so the source flows to `createAudioPlayer` without a cast.
declare module '*.wav' {
  const asset: number;
  export default asset;
}
