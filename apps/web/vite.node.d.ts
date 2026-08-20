declare module 'node:fs' {
  const fs: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string): void;
    rmSync(path: string, options: { recursive?: boolean; force?: boolean }): void;
    mkdirSync(path: string, options: { recursive?: boolean }): void;
    cpSync(source: string, destination: string, options?: { recursive?: boolean }): void;
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

declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  toString(): string;
}
declare class URL {
  constructor(input: string, base?: string);
  protocol: string;
  hostname: string;
  searchParams: URLSearchParams;
}
