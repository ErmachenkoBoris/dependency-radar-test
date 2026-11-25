import { Hit, Result } from "../scan/scan"

export interface Entry { hit: Hit; result: Result }
export interface PackageReport {
  name: string
  majors: Map<number, Set<number>>
  entries: Entry[]
  unknown: Set<number>
  peers: Set<number>
  absent: number
}

export function aggregate(names: string[], results: Result[]) {
  const packages = names.map((name): PackageReport => ({
    name, majors: new Map(), entries: [], unknown: new Set(), peers: new Set(), absent: 0
  }))
  const byName = new Map(packages.map(p => [p.name, p]))
  for (const result of results) {
    const id = result.project.id
    const declared = new Set<string>()
    for (const hit of result.hits) {
      const pkg = byName.get(hit.name)!
      declared.add(hit.name)
      pkg.entries.push({ result, hit })
      if (hit.section === "peerDependencies") {
        pkg.peers.add(id)
      } else if (hit.major === null) {
        pkg.unknown.add(id)
      } else {
        const ids = pkg.majors.get(hit.major) ?? new Set<number>()
        ids.add(id)
        pkg.majors.set(hit.major, ids)
      }
    }
    if (!result.errors.length) {
      for (const pkg of packages) if (!declared.has(pkg.name)) pkg.absent++
    }
  }
  return packages
}
