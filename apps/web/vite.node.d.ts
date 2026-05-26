declare module 'node:fs' {
  const fs: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string): void;
  };
  export default fs;
}

declare module 'node:path' {
  const path: {
    resolve(...segments: string[]): string;
  };
  export default path;
}

declare const Buffer: {
  from(value: Uint8Array | string): Uint8Array;
  concat(values: Uint8Array[]): { toString(encoding: string): string };
};
declare const __dirname: string;
declare const process: {
  env: Record<string, string | undefined>;
};
declare const fetch: (url: string, init?: unknown) => Promise<{
  ok: boolean;
  statusText: string;
  text(): Promise<string>;
}>;
