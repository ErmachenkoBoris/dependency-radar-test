export interface Repository {
  id: number
  fullName: string
  webUrl: string
  defaultBranch: string | null
  empty?: boolean
}

export interface RepositorySource {
  // A null revision means the repository has no commits.
  revision(project: Repository): Promise<string | null>
  files(project: Repository, revision: string): AsyncIterable<string>
  readFile(project: Repository, revision: string, path: string): Promise<string>
  fileUrl(project: Repository, revision: string, path: string): string
}

export function isManifest(path: string) {
  const parts = path.split("/")
  return parts[parts.length - 1] === "package.json" && !parts.includes("node_modules")
}

export function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}
