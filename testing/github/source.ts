import { execFile } from "node:child_process"
import { join } from "node:path"
import { Repository, RepositorySource, encodePath } from "../../src/scan/source"

interface PublicRepo {
  id: number
  full_name: string
  archived: boolean
  private: boolean
  default_branch: string
}

export async function publicProjects(owner: string): Promise<Repository[]> {
  if (!/^[a-z0-9-]+$/i.test(owner)) throw new Error("Некорректное имя пользователя GitHub")
  const projects = new Map<number, Repository>()
  for (let page = 1; ; page++) {
    const url = "https://api.github.com/users/" + owner + "/repos?per_page=100&type=owner&page=" + page
    const response = await fetch(url, { headers: { "User-Agent": "dependency-radar-dry-run" }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error("GitHub repositories: HTTP " + response.status)
    const batch: PublicRepo[] = await response.json()
    for (const repo of batch) {
      if (repo.private || repo.archived) continue
      projects.set(repo.id, { id: repo.id, fullName: repo.full_name, defaultBranch: repo.default_branch,
        webUrl: "https://github.com/" + repo.full_name })
    }
    if (batch.length < 100) break
  }
  return [...projects.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "en"))
}

function git(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", ["-c", "credential.helper=", ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }
    }, (error, stdout, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout))
  })
}

export function githubSource(tempDir: string): RepositorySource {
  const dir = (p: Repository) => join(tempDir, String(p.id))
  return {
    async revision(p) {
      // Bare partial clones fetch the shallow snapshot and tree. Git lazily
      // loads blob contents only for files selected by the shared scanner.
      await git(["clone", "--bare", "--depth=1", "--filter=blob:none", "--no-tags",
        "--single-branch", "--", p.webUrl + ".git", dir(p)])
      const head = await git(["-C", dir(p), "for-each-ref", "--count=1", "--format=%(objectname)", "refs/heads/"])
      return head.trim() || null
    },
    async *files(p, sha) {
      const tree = await git(["-C", dir(p), "ls-tree", "-r", "-z", sha])
      for (const entry of tree.split("\0")) {
        const split = entry.indexOf("\t")
        if (entry.startsWith("100") && split !== -1) yield entry.slice(split + 1)
      }
    },
    readFile(p, sha, path) {
      return git(["-C", dir(p), "cat-file", "blob", sha + ":" + path])
    },
    fileUrl(p, sha, path) {
      return p.webUrl + "/blob/" + sha + "/" + encodePath(path)
    }
  }
}
