import { Result } from "../scan/scan"
import { PackageReport } from "./aggregate"

function code(value: string) {
  const text = value.replace(/[\r\n]/g, " ").replace(/\|/g, "\\|")
  const ticks: string[] = text.match(/`+/g) || []
  const fence = "`".repeat(1 + ticks.reduce((longest, s) => Math.max(longest, s.length), 0))
  return fence + " " + text + " " + fence
}
export function summary(scope: string, results: Result[], packages: PackageReport[], link: { label: string; url: string }, pipeline?: string) {
  const total = results.length
  const partial = results.filter(r => r.errors.length).length
  const lines = ["# Dependency Radar · " + scope, "",
    "Активных доступных проектов: **" + total + "**. Полностью проверено: **" + (total - partial) +
    "**. С ошибками: **" + partial + "**.", "",
    "[" + link.label + "](" + link.url + ")", "",
    "Доля считается от всех активных доступных проектов. Проект с несколькими мажорами учитывается в каждой соответствующей строке."]
  for (const pkg of packages) {
    lines.push("", "## " + code(pkg.name), "", "| Мажор | Проектов | Доля от всех проектов |", "|---|---:|---:|")
    for (const [major, ids] of [...pkg.majors].sort(([a], [b]) => b - a)) {
      const percent = (100 * ids.size / total).toLocaleString("ru-RU", { maximumFractionDigits: 2 })
      lines.push("| " + major + " | " + ids.size + " | " + percent + "% |")
    }
    if (!pkg.majors.size) lines.push("| — | 0 | " + (total ? "0%" : "—") + " |")
    lines.push("", "Без однозначного мажора: " + pkg.unknown.size + ". Объявляют peerDependencies: " +
      pkg.peers.size + ". Полностью проверены, пакет отсутствует: " + pkg.absent + ".")
  }
  if (pipeline) lines.push("", "<!-- dependency-radar pipeline=" + pipeline + " -->")
  lines.push("")
  return lines.join("\n")
}

export function details(scope: string, results: Result[], packages: PackageReport[]) {
  const lines = ["# Dependency Radar · " + scope + " · проекты"]
  for (const pkg of packages) {
    lines.push("", "## " + code(pkg.name), "")
    if (!pkg.entries.length) {
      lines.push("Совпадений в прочитанных манифестах нет.")
      continue
    }
    lines.push("| Мажор | Проект | Манифест | Секция | Объявлено |", "|---|---|---|---|---|")
    const entries = [...pkg.entries].sort((a, b) =>
      (b.hit.major ?? -1) - (a.hit.major ?? -1) ||
      a.result.project.fullName.localeCompare(b.result.project.fullName, "en") ||
      a.hit.path.localeCompare(b.hit.path, "en") || a.hit.section.localeCompare(b.hit.section, "en"))
    for (const { hit, result } of entries) {
      const p = result.project
      const file = hit.fileUrl
      const projectLink = "[" + code(p.fullName) + "](<" + p.webUrl + ">)"
      const fileLink = "[" + code(hit.path) + "](<" + file + ">)"
      lines.push("| " + [hit.major ?? "—", projectLink, fileLink, hit.section, code(hit.spec)].join(" | ") + " |")
    }
  }
  const failed = results.filter(r => r.errors.length)
  if (failed.length) {
    lines.push("", "## Ошибки проверки", "")
    for (const r of failed) {
      for (const msg of r.errors) lines.push("- " + code(r.project.fullName) + " — " + code(msg))
    }
  }
  return lines.join("\n") + "\n"
}
