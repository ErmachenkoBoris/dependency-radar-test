import yargs from "yargs"
import { scan } from "./commands/scan"
import { publish } from "./commands/publish"

yargs(process.argv.slice(2)).command(scan).command(publish).demandCommand(1).strict().help()
  .parseAsync().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
