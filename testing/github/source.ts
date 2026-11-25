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

async function repositoryPage(url: string): Promise<PublicRepo[]> {
  const headers: Record<string, string> = { "User-Agent": "dependency-radar-dry-run" }
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
    if (response.ok) return response.json()

    const body = await response.json().catch(() => null)
    const reason = typeof body?.message === "string" ? body.message : response.statusText
    const remaining = response.headers.get("x-ratelimit-remaining")
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000
    const retry = Number(response.headers.get("retry-after")) * 1000
    const limited = response.status === 429 || (response.status === 403 &&
      (remaining === "0" || retry > 0 || /rate limit/i.test(reason)))
    if (limited && attempt === 0) {
      const wait = Math.max(1000, retry, remaining === "0" && reset > 0 ? reset - Date.now() + 1000 : 0)
      const delay = retry > 0 || (remaining === "0" && reset > 0) ? wait : 60000
      if (delay <= 60000) {
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
    }
    const quota = remaining === null ? "" : ", remaining=" + remaining
    const resetTime = remaining === "0" && reset > 0 ? ", reset=" + new Date(reset).toISOString() : ""
    throw new Error("GitHub repositories: HTTP " + response.status + " — " + reason + quota + resetTime)
  }
}

export async function publicProjects(owner: string): Promise<Repository[]> {
  if (!/^[a-z0-9-]+$/i.test(owner)) throw new Error("Некорректное имя пользователя GitHub")
  const projects = new Map<number, Repository>()
  for (let page = 1; ; page++) {
    const url = "https://api.github.com/users/" + owner + "/repos?per_page=100&type=owner&page=" + page
    const batch = await repositoryPage(url)
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
      env: { ...process.env, GITHUB_TOKEN: undefined, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }
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
