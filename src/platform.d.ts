// Narrow declarations for the Node and package APIs used by this CLI.
declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exitCode?: number
}
declare module "node:fs" {
  export function mkdirSync(path: string, options: { recursive: true }): unknown
  export function writeFileSync(path: string, data: string): void
  export function readFileSync(path: string, encoding: "utf8"): string
}
declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(value: string): { digest(format: "hex"): string }
  }
}
declare module "semver" {
  interface Version { version: string; major: number; prerelease: unknown[] }
  export class Range {
    constructor(spec: string)
    set: { value: string; semver: Version }[][]
  }
  export function minVersion(spec: string): Version | null
  export function satisfies(value: string, spec: string): boolean
}
declare module "yargs" {
  interface Option { type: "string"; demandOption?: boolean; default?: string }
  export interface CommandModule<T = {}, U = T> {
    command: string
    describe: string
    builder: Record<string, Option>
    handler(args: U): Promise<void>
  }
  interface Cli {
    command<U>(cmd: CommandModule<{}, U>): Cli
    demandCommand(min: number): Cli
    strict(): Cli
    help(): Cli
    parseAsync(): Promise<unknown>
  }
  export default function yargs(args: string[]): Cli
}
