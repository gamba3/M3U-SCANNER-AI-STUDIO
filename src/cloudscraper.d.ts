declare module 'cloudscraper' {
  interface CloudscraperOptions {
    headers?: Record<string, string>;
    timeout?: number;
  }
  function get(url: string, options?: CloudscraperOptions): Promise<string>;
  export { get };
  export default { get };
}
