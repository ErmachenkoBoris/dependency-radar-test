import { Repository } from "../scan/source"
import { GitLab } from "./client"

interface Project {
  id: number
  path_with_namespace: string
  web_url: string
  default_branch: string | null
  empty_repo?: boolean
  archived: boolean
  namespace: { id: number }
}

export async function listProjects(api: GitLab, root: string): Promise<Repository[]> {
  const groups = [Number(root)]
  const seen = new Set(groups)
  const projects = new Map<number, Project>()
  for (const id of groups) {
    const base = "/groups/" + id
    for await (const p of api.pages<Project>(base + "/projects", { with_shared: "false" })) {
      if (!p.archived && p.namespace.id === id) projects.set(p.id, p)
    }
    for await (const group of api.pages<{ id: number }>(base + "/subgroups")) {
      if (!seen.has(group.id)) {
        seen.add(group.id)
        groups.push(group.id)
      }
    }
  }
  return [...projects.values()].map(p => ({
    id: p.id, fullName: p.path_with_namespace, webUrl: p.web_url,
    defaultBranch: p.default_branch, empty: p.empty_repo
  })).sort((a, b) => a.fullName.localeCompare(b.fullName, "en"))
}
