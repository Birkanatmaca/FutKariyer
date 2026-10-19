// Image imports: Metro returns an asset id, Vite a URL.
declare module '*.png' {
  const asset: number | string;
  export default asset;
}
