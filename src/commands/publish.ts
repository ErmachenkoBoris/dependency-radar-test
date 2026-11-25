import { readFileSync } from "node:fs"
import type { CommandModule } from "yargs"
import { numericId, packageNames, required } from "../config"
import { gitlabClient } from "../gitlab/client"
import { publishWiki, wikiTitle } from "../gitlab/wiki"

export const publish: CommandModule = {
  command: "publish",
  describe: "Опубликовать сводку текущего запуска в Wiki",
  builder: {},
  async handler() {
    const title = wikiTitle(numericId(required("GROUP_ID")), packageNames(required("DEPENDENCIES")))
    const status = await publishWiki(gitlabClient(), numericId(required("CI_PROJECT_ID")), title,
      readFileSync("report/summary.md", "utf8"), numericId(required("CI_PIPELINE_ID")))
    console.log(status + ": " + title)
  }
}
