import { Repository, RepositorySource, isManifest } from "./source"
import { singleMajor } from "./version"

const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const
export interface Hit {
  name: string
  path: string
  section: typeof sections[number]
  fileUrl: string
  spec: string
  major: number | null
}
export interface Result {
  project: Repository
  hits: Hit[]
  errors: string[]
  revision?: string
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function inspect(raw: string, path: string, fileUrl: string, names: string[], result: Result) {
  const manifest: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""))
  if (!object(manifest)) throw new Error("Некорректный package.json")
  for (const section of sections) {
    const deps = manifest[section]
    if (deps === undefined) continue
    if (!object(deps)) {
      result.errors.push(path + " — некорректная секция " + section)
      continue
    }
    for (const name of names) {
      if (!Object.prototype.hasOwnProperty.call(deps, name)) continue
      const spec = deps[name]
      if (typeof spec !== "string") {
        result.errors.push(path + " — некорректное значение " + name + " в " + section)
        continue
      }
      result.hits.push({ name, path, fileUrl, section, spec, major: singleMajor(spec) })
    }
  }
}

async function scanProject(source: RepositorySource, project: Repository, names: string[]): Promise<Result> {
  const result: Result = { project, hits: [], errors: [] }
  if (project.empty) return result
  try {
    const ref = await source.revision(project)
    if (ref === null) return result
    result.revision = ref
    for await (const path of source.files(project, ref)) {
      if (!isManifest(path)) continue
      try {
        const raw = await source.readFile(project, ref, path)
        inspect(raw, path, source.fileUrl(project, ref, path), names, result)
      } catch (error) {
        // Do not include raw JSON snippets in reports.
        const reason = error instanceof SyntaxError ? "Некорректный JSON" : String(error)
        result.errors.push(path + " — " + reason)
      }
    }
  } catch (error) {
    result.errors.push(String(error))
  }
  return result
}

export async function scanRepositories(source: RepositorySource, projects: Repository[], names: string[]) {
  const results: Result[] = []
  let cursor = 0
  async function worker() {
    while (cursor < projects.length) {
      const i = cursor++
      results[i] = await scanProject(source, projects[i], names)
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, projects.length) }, worker))
  return results
}
