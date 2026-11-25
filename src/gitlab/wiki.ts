import { createHash } from "node:crypto"
import { ApiError, GitLab } from "./client"

export function wikiTitle(group: string, names: string[]) {
  const signature = createHash("sha256").update(JSON.stringify(names)).digest("hex").slice(0, 16)
  const label = names[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "")
  return "dependency-radar-" + group + "-" + label + "-" + signature
}

export async function publishWiki(api: GitLab, project: string, title: string, content: string, pipeline: string) {
  const collection = "/projects/" + project + "/wikis"
  const path = collection + "/" + encodeURIComponent(title)
  let previous: string
  try {
    previous = (await api.request<{ content: string }>("GET", path)).data.content
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e
    await api.request("POST", collection, undefined, { title, format: "markdown", content })
    return "Сводка создана"
  }
  const marker = /<!-- dependency-radar pipeline=(\d+) -->\s*$/.exec(previous)
  if (marker && BigInt(marker[1]) > BigInt(pipeline)) return "Уже опубликован более новый отчёт"
  if (previous === content) return "Сводка уже опубликована"
  await api.request("PUT", path, undefined, { content })
  return "Сводка обновлена"
}
