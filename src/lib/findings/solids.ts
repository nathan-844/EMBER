// F6: how far solid-material tests reach toward the exploration atmosphere, counted over every
// solid test in the atlas (PSI tables and the NTRS Saffire IV–VI paper).
import { INVESTIGATIONS } from "../../data/investigations";
import type { AtlasRow } from "../atlas/types";
import { EXPLORATION_ATMOSPHERE } from "./flex";
import type { Finding } from "./types";

/** Highest oxygen a row records: its single value, or the top of a listed range. */
const o2Of = (r: AtlasRow) => (typeof r.o2Pct?.v === "number" ? r.o2Pct.v : r.o2Pct?.values?.length ? Math.max(...r.o2Pct.values) : null);
const OUTCOME_WORDS: Record<string, string> = { burned: "burned", "burned-out": "burned away", "no-spread": "no flame spread", "not-recorded": "outcome not recorded" };
const NAMES = new Map(INVESTIGATIONS.map((i) => [i.id, i.name]));

export function f6SolidsAtHighOxygen(rows: AtlasRow[]): Finding {
  const solids = rows.filter((r) => r.rowKind === "test" && r.fuelClass === "solid");
  const withO2 = solids.filter((r) => o2Of(r) !== null);
  const withP = solids.filter((r) => typeof r.pressurePsi?.v === "number");
  const psi = withO2.filter((r) => r.source.kind === "psi");
  const psiMax = Math.max(...psi.map((r) => o2Of(r)!));
  const above = withO2.filter((r) => o2Of(r)! > psiMax).sort((a, b) => o2Of(b)! - o2Of(a)!);
  const inZone = above.filter((r) => o2Of(r)! >= EXPLORATION_ATMOSPHERE.minO2Pct && (r.pressurePsi?.v ?? Infinity) <= EXPLORATION_ATMOSPHERE.maxPsi);
  const numbers = {
    solidTests: solids.length,
    withOxygen: withO2.length,
    withPressure: withP.length,
    psiHighestO2: psiMax,
    aboveRuns: above.length,
    inZone: inZone.length,
    inZoneBurned: inZone.filter((r) => r.outcome.value === "burned" || r.outcome.value === "burned-out").length,
    inZoneList: inZone.map((r) => `${r.material.name} at ${o2Of(r)}% and ${r.pressurePsi!.v} psia`).join("; "),
    highestO2: o2Of(above[0] ?? psi[0])!,
  };
  // Table: every solid test above 21.9% O₂, grouped by source, material, oxygen and pressure.
  const groups = new Map<string, AtlasRow[]>();
  for (const r of withO2.filter((r) => o2Of(r)! > 21.9)) {
    const src = r.source.kind === "psi" ? `${NAMES.get(r.investigation) ?? r.investigation} (PSI table)` : "Saffire IV–VI (NTRS paper)";
    const k = [src, r.material.name ?? "not named", o2Of(r), r.pressurePsi?.v ?? "", r.outcome.value].join("|");
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return {
    id: "F6",
    title: "Almost no solid has burned in exploration air",
    claim:
      `Of ${solids.length} solid-material tests, ${withO2.length} record the oxygen level and only ${withP.length} the pressure. Solid tests in NASA's PSI tables stop at ${psiMax}% O₂; ` +
      `${above.length} samples from the Saffire IV–VI paper go higher, and ${inZone.length} of them reach the challenge's exploration atmosphere (${numbers.inZoneList}). ${numbers.inZoneBurned === inZone.length ? (inZone.length === 2 ? "Both" : "All") : numbers.inZoneBurned} burned.`,
    numbers,
    n: withO2.length,
    rows: withO2.map((r) => r.id),
    excluded: [{ reason: "solid tests that do not record oxygen (e.g. BASS, Saffire-III, SAME)", count: solids.length - withO2.length }],
    method:
      `1. Take every test in the atlas whose fuel is a solid. 2. Use its oxygen (the top of the range where NASA lists a range) and pressure where recorded. ` +
      `3. Find the highest oxygen in the PSI tables, then the tests above it, and those at ${EXPLORATION_ATMOSPHERE.minO2Pct}% O₂ or more and ${EXPLORATION_ATMOSPHERE.maxPsi} psi or less.`,
    confounders: [
      "PSI solid tests at 21–22% O₂ ran in the ISS cabin or glovebox at about 1 atm, but the tables do not record pressure, so they cannot be placed on both axes.",
      "The Saffire IV–VI values come from a NASA conference paper (NTRS 20240002981), not from PSI.",
    ],
    notClaimed:
      "Counts what has been tested, from these sources. It does not say how solids would burn in exploration air, or that tests outside these sources do not exist.",
    investigations: [...new Set(withO2.map((r) => r.investigation))].sort(),
    table: {
      columns: ["Source", "Material", "O₂ (%)", "Pressure (psia)", "Outcome", "Tests"],
      rows: [...groups.entries()]
        .map(([k, rs]) => {
          const [src, mat, o2, p, outcome] = k.split("|");
          return [src, mat, Number(o2), p === "" ? null : Number(p), OUTCOME_WORDS[outcome] ?? outcome, rs.length] as (string | number | null)[];
        })
        .sort((a, b) => (b[2] as number) - (a[2] as number)),
    },
  };
}
