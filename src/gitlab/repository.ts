import { GitLab } from "./client"
import { RepositorySource, encodePath } from "../scan/source"

export function gitlabSource(api: GitLab): RepositorySource {
  return {
    async revision(project) {
      if (!project.defaultBranch) throw new Error("Нет доступной ветки по умолчанию")
      const branch = encodeURIComponent(project.defaultBranch)
      const { data } = await api.request<{ commit: { id: string } }>("GET",
        "/projects/" + project.id + "/repository/branches/" + branch)
      return data.commit.id
    },
    async *files(project, ref) {
      const items = api.pages<{ type: string; path: string; mode?: string }>(
        "/projects/" + project.id + "/repository/tree", { ref, recursive: "true" })
      for await (const item of items) {
        if (item.type === "blob" && item.mode !== "120000") yield item.path
      }
    },
    async readFile(project, ref, path) {
      const url = "/projects/" + project.id + "/repository/files/" + encodeURIComponent(path) + "/raw"
      return (await api.request<string>("GET", url, { ref }, undefined, true)).data
    },
    fileUrl(project, ref, path) {
      return project.webUrl + "/-/blob/" + ref + "/" + encodePath(path)
    }
  }
}
