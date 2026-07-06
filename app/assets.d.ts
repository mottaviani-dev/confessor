// Metro static image assets resolve to an opaque asset id (number) at bundle time.
declare module '*.jpg' {
  const assetId: number;
  export default assetId;
}
declare module '*.png' {
  const assetId: number;
  export default assetId;
}
