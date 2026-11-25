declare module "node:child_process" {
  export function execFile(command: string, args: string[],
    options: { encoding: "utf8"; maxBuffer: number; timeout: number; env: Record<string, string | undefined> },
    callback: (error: Error | null, stdout: string, stderr: string) => void): unknown
}
declare module "node:path" { export function join(...parts: string[]): string }
declare module "node:os" { export function tmpdir(): string }
declare module "node:fs/promises" {
  export function mkdtemp(prefix: string): Promise<string>
  export function rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>
}
