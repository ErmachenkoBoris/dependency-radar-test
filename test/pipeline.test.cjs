const test = require("node:test")
const assert = require("node:assert/strict")
const { createServer } = require("node:http")
const { mkdtemp, readFile, rm } = require("node:fs/promises")
const { tmpdir } = require("node:os")
const { join, resolve } = require("node:path")
const { promisify } = require("node:util")
const run = promisify(require("node:child_process").execFile)
const { singleMajor } = require("../dist/scan/version")

test("определение единственного допустимого мажора", () => {
  for (const [spec, major] of [
    ["18.2.1", 18], ["^18 || ~18.2", 18], ["^0.3.1", 0], ["3.0.0-beta.1", 3],
    [">=17 <19", null], ["^17 || ^18", null], ["workspace:*", null], ["latest", null],
    ["1".repeat(257), null], ["*", null], ["", null], [">=18 <19.0.0-beta.2", null]
  ]) assert.equal(singleMajor(spec), major, spec)
})

test("один обход, несколько таблиц, артефакт и последовательная публикация", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "radar-"))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const paths = new Map()
  const wiki = new Map()
  const writes = []
  let failAllTrees = false
  const project = (id, name, group, archived = false) => ({
    id, path_with_namespace: name, web_url: "https://gitlab.test/" + name,
    default_branch: "develop", namespace: { id: group }, archived
  })
  const entry = path => ({ path, name: "package.json", type: "blob" })
  const replies = {
    "/groups/42/projects": [project(1, "team/mono", 42), project(2, "team/archived", 42, true), project(6, "outside/shared", 99)],
    "/groups/42/subgroups": [{ id: 43 }],
    "/groups/43/subgroups": [],
    "/groups/43/projects": [project(3, "team/sub/broken", 43), project(4, "team/sub/plain", 43)],
    "/projects/1/repository/tree": [entry("apps/web/package.json"), entry("node_modules/x/package.json"), { ...entry("alias/package.json"), mode: "120000" }],
    "/projects/1/repository/files/apps%2Fweb%2Fpackage.json/raw": { dependencies: { "@angular/core": "^18", ui: "~3.1" } },
    "/projects/1/repository/files/libs%2Fold%2Fpackage.json/raw": { devDependencies: { "@angular/core": "17", ui: "^3" } },
    "/projects/3/repository/tree": [entry("package.json")],
    "/projects/4/repository/tree": []
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost")
    const path = url.pathname.replace(/^\/api\/v4/, "")
    const key = req.method + " " + path
    paths.set(key, (paths.get(key) ?? 0) + 1)
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    }
    if (req.headers["private-token"] !== "test") return send(401, {})
    if (/\/repository\/branches\/develop$/.test(path)) return send(200, { commit: { id: "abc123" } })
    if (path.includes("/repository/") && url.searchParams.get("ref") !== "abc123") return send(400, {})
    if (failAllTrees && path.endsWith("/repository/tree")) return send(403, {})
    if (path === "/projects/1/repository/tree") {
      if (url.searchParams.get("recursive") !== "true") return send(400, {})
      if (url.searchParams.get("page") === "2") return send(200, [entry("libs/old/package.json")])
      res.setHeader("x-next-page", "2")
    }
    if (path === "/projects/3/repository/files/package.json/raw") return res.end("{")
    if (path.startsWith("/projects/90/wikis")) {
      const slug = path.split("/")[4]
      if (req.method === "GET") return wiki.has(slug) ? send(200, { content: wiki.get(slug) }) : send(404, {})
      let input = ""
      for await (const chunk of req) input += chunk
      const data = JSON.parse(input)
      wiki.set(slug || data.title, data.content)
      writes.push(req.method)
      return send(200, {})
    }
    if (Object.hasOwn(replies, path)) return send(200, replies[path])
    send(404, {})
  })
  await new Promise((ok, fail) => server.once("error", fail).listen(0, "127.0.0.1", ok))
  t.after(() => new Promise(ok => server.close(ok)))
  const env = { ...process.env, CI_API_V4_URL: "http://127.0.0.1:" + server.address().port + "/api/v4",
    NO_PROXY: "127.0.0.1", CI_JOB_URL: "https://gitlab.test/jobs/20", GITLAB_TOKEN: "test",
    GROUP_ID: "42", CI_PROJECT_ID: "90", CI_PIPELINE_ID: "20", DEPENDENCIES: "ui, @angular/core, absent, ui" }
  const cli = command => run(process.execPath, [resolve(__dirname, "../dist/cli.js"), command], { cwd, env })
  await cli("scan")
  const summary = await readFile(join(cwd, "report/summary.md"), "utf8")
  const details = await readFile(join(cwd, "report/projects.md"), "utf8")
  assert.equal((summary.match(/^## /gm) || []).length, 3)
  assert.equal((summary.match(/^\| Мажор /gm) || []).length, 3)
  assert.match(summary, /активных доступных проектов: \*\*3\*\*/i)
  assert.match(summary, /С ошибками: \*\*1\*\*/)
  for (const major of [18, 17, 3]) assert.ok(summary.includes("| " + major + " | 1 | 33,33% |"))
  assert.match(summary, /\| — \| 0 \| 0% \|/)
  assert.match(summary, /jobs\/20\/artifacts\/download/)
  assert.doesNotMatch(summary, /team\/mono|apps\/web/)
  assert.match(details, /team\/mono/)
  assert.match(details, /abc123\/apps\/web\/package\.json/)
  assert.match(details, /Некорректный JSON/)
  assert.doesNotMatch(details, /team\/archived|outside\/shared/)
  assert.equal(paths.get("GET /projects/1/repository/files/apps%2Fweb%2Fpackage.json/raw"), 1)
  assert.equal(paths.get("GET /projects/1/repository/tree"), 2)
  assert.equal([...paths.keys()].some(k => k.includes("node_modules") || k.includes("alias%2F") || /\/projects\/(2|6)\//.test(k)), false)
  await cli("publish")
  env.DEPENDENCIES = "absent, ui,@angular/core"
  env.CI_PIPELINE_ID = "21"
  await cli("scan")
  await cli("publish")
  assert.equal(wiki.size, 1)
  assert.deepEqual(writes, ["POST", "PUT"])
  env.CI_PIPELINE_ID = "20"
  await cli("publish")
  assert.deepEqual(writes, ["POST", "PUT"])
  failAllTrees = true
  await assert.rejects(cli("scan"), /Ни один проект не проверен/)
  assert.match(await readFile(join(cwd, "report/projects.md"), "utf8"), /GitLab HTTP 403/)
})

test("ошибка в одной записи сохраняет корректные находки из того же манифеста", async () => {
  const { scanRepositories } = require("../dist/scan/scan")
  const { aggregate } = require("../dist/report/aggregate")
  const names = ["bad", "good", "later", "missing"]
  const results = await scanRepositories({
    revision: async () => "abc",
    async *files() { yield "app/package.json" },
    readFile: async () => JSON.stringify({
      dependencies: { bad: 42, good: "^18" }, devDependencies: [], optionalDependencies: { later: "^2" }
    }),
    fileUrl: () => "https://example.test/file"
  }, [{ id: 1, fullName: "team/app" }], names)
  assert.equal(results[0].errors.length, 2)
  assert.deepEqual(results[0].hits.map(h => [h.name, h.major]), [["good", 18], ["later", 2]])
  assert.equal(aggregate(names, results).find(p => p.name === "missing").absent, 0)
})
