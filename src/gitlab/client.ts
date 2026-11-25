import axios from "axios"
import { required } from "../config"

export class ApiError extends Error {
  constructor(readonly status: number, path: string) {
    super("GitLab HTTP " + status + " (" + path + ")")
  }
}

export function gitlabClient() {
  const http = axios.create({
    baseURL: required("CI_API_V4_URL").replace(/\/$/, ""),
    headers: { "PRIVATE-TOKEN": required("GITLAB_TOKEN") },
    maxRedirects: 0,
    timeout: 30000,
    validateStatus: () => true
  })

  async function request<T>(method: "GET" | "POST" | "PUT", path: string,
    params?: Record<string, string | number>, data?: object, raw = false) {
    for (let attempt = 0; ; attempt++) {
      let response
      try {
        response = await http.request<T>({ method, url: path, params, data,
          ...(raw ? { transformResponse: [(body: string) => body], responseType: "text" as const } : {}) })
      } catch {
        if (method !== "GET" || attempt >= 3) throw new Error("Сбой соединения с GitLab (" + path + ")")
        await delay(500 * 2 ** attempt)
        continue
      }
      if (response.status >= 200 && response.status < 300) return response
      if (method !== "GET" || attempt >= 3 || ![429, 500, 502, 503, 504].includes(response.status)) {
        throw new ApiError(response.status, path)
      }
      const retry = response.headers["retry-after"]
      const millis = retry && (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now())
      await delay(Math.max(500 * 2 ** attempt, Number(millis) || 0))
    }
  }

  async function* pages<T>(path: string, params: Record<string, string | number> = {}) {
    let page = 1
    for (;;) {
      const response = await request<T[]>("GET", path, { ...params, page, per_page: 100 })
      if (!Array.isArray(response.data)) throw new Error("GitLab вернул неожиданный формат: " + path)
      yield* response.data
      const next: unknown = response.headers["x-next-page"]
      if (next === "" || (next == null && response.data.length < 100)) return
      const nextPage = next == null ? page + 1 : Number(next)
      if (!Number.isSafeInteger(nextPage) || nextPage <= page) throw new Error("Ошибка пагинации: " + path)
      page = nextPage
    }
  }
  return { request, pages }
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
export type GitLab = ReturnType<typeof gitlabClient>
