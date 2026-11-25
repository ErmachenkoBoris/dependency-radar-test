import { minVersion, Range, satisfies } from "semver"

// Each OR branch must permit the same single major. Within an AND branch,
// a larger stable major must include its first stable version. Prerelease
// exceptions can only be introduced by explicit prerelease comparators.
export function singleMajor(spec: string): number | null {
  // Bound input passed to the pinned legacy semver parser. Longer declarations
  // remain visible verbatim in the detailed report.
  if (spec.length > 256 || !spec.trim()) return null
  try {
    const majors = new Set<number>()
    for (const comparators of new Range(spec).set) {
      const clause = comparators.map(c => c.value).join(" ")
      const min = minVersion(clause)
      if (!min || !satisfies(min.version, clause)) continue
      majors.add(min.major)
      if (majors.size > 1 || satisfies((min.major + 1) + ".0.0", clause)) return null
      for (const { semver: ver } of comparators) {
        if (ver.prerelease?.length && ver.major > min.major) {
          const base = ver.version.split("-")[0]
          if ([base + "-0", ver.version, ver.version + ".0"].some(v => satisfies(v, clause))) return null
        }
      }
    }
    return majors.size === 1 ? [...majors][0] : null
  } catch {
    return null
  }
}
