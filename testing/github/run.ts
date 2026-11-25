import { mkdirSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { packageNames, required } from "../../src/config"
import { scanRepositories } from "../../src/scan/scan"
import { aggregate } from "../../src/report/aggregate"
import { summary, details } from "../../src/report/markdown"
import { githubSource, publicProjects } from "./source"

async function main() {
  const owner = required("GITHUB_OWNER")
  const names = packageNames(required("DEPENDENCIES"))
  const repos = await publicProjects(owner)
  const scratch = await mkdtemp(join(tmpdir(), "dependency-radar-github-"))
  try {
    console.log("Публичных активных репозиториев: " + repos.length)
    const results = await scanRepositories(githubSource(scratch), repos, names)
    const scope = "GitHub · " + owner
    const packages = aggregate(names, results)
    const markdown = summary(scope, results, packages, { label: "Проекты и манифесты", url: "projects.md" })
    mkdirSync("testing/github/report", { recursive: true })
    writeFileSync("testing/github/report/summary.md", markdown)
    writeFileSync("testing/github/report/projects.md", details(scope, results, packages))
    console.log(markdown)
    if (results.some(r => r.errors.length)) process.exitCode = 1
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
