import { mkdirSync, writeFileSync } from "node:fs"
import type { CommandModule } from "yargs"
import { numericId, packageNames, required } from "../config"
import { gitlabClient } from "../gitlab/client"
import { aggregate } from "../report/aggregate"
import { details, summary } from "../report/markdown"
import { listProjects } from "../gitlab/projects"
import { gitlabSource } from "../gitlab/repository"
import { scanRepositories } from "../scan/scan"

export const scan: CommandModule<{}, { group: string; dependencies: string }> = {
  command: "scan",
  describe: "Проверить зависимости и подготовить отчёт",
  builder: {
    group: { type: "string", default: process.env.GROUP_ID, demandOption: true },
    dependencies: { type: "string", default: process.env.DEPENDENCIES, demandOption: true }
  },
  async handler(args) {
    const group = numericId(args.group)
    const names = packageNames(args.dependencies)
    const job = required("CI_JOB_URL")
    const pipeline = numericId(required("CI_PIPELINE_ID"))
    const api = gitlabClient()
    const results = await scanRepositories(gitlabSource(api), await listProjects(api, group), names)
    const packages = aggregate(names, results)
    const scope = "группа " + group
    const wiki = summary(scope, results, packages, {
      label: "Скачать список проектов и манифестов · pipeline " + pipeline, url: job + "/artifacts/download"
    }, pipeline)
    mkdirSync("report", { recursive: true })
    writeFileSync("report/projects.md", details(scope, results, packages))
    writeFileSync("report/summary.md", wiki)
    console.log(wiki)
    if (results.length && results.every(r => r.errors.length > 0 && r.hits.length === 0)) {
      throw new Error("Ни один проект не проверен полностью и нет подтверждённых совпадений. Подробности в артефакте.")
    }
  }
}
