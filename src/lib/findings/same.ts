// F8: SAME and SAME-R measured each smoke sample twice: just after it was made, and again after it
// had aged in the chamber (rows numbered "…a" in NASA's results workbook). This compares the two.
import type { AtlasRow, Quantity } from "../atlas/types";
import { bootstrapCI, ciText, median, round, wilson, pctCi } from "./stats";
import type { Finding } from "./types";

const num = (q: unknown) => (q && typeof (q as Quantity).v === "number" ? (q as Quantity).v! : null);
const testNo = (r: AtlasRow) => String(r.measures.sameTest?.v ?? "").trim();

export function f8SmokeGrowsWithAge(rows: AtlasRow[]): Finding {
  const book = rows.filter((r) => r.source.kind === "psi" && r.source.table === "PSI-101-1");
  const byTest = new Map(book.map((r) => [testNo(r), r]));
  const pairs: { fresh: AtlasRow; aged: AtlasRow; d0: number; d1: number; t0: number | null; t1: number | null }[] = [];
  let missing = 0;
  for (const aged of book) {
    const n = testNo(aged);
    if (!/a$/i.test(n)) continue;
    const fresh = byTest.get(n.replace(/a$/i, ""));
    const d0 = fresh ? num(fresh.measures.amdUm) : null, d1 = num(aged.measures.amdUm);
    if (!fresh || d0 === null || d1 === null || d0 <= 0 || d1 <= 0) { missing++; continue; }
    pairs.push({ fresh, aged, d0, d1, t0: num(fresh.measures.netAgingS), t1: num(aged.measures.netAgingS) });
  }
  const ratios = pairs.map((p) => p.d1 / p.d0);
  const grew = ratios.filter((x) => x > 1).length;
  const flight = (p: (typeof pairs)[number]) => (p.fresh.investigation === "same" ? "SAME" : "SAME-R");
  const ratioCi = bootstrapCI([ratios], ([s]) => median(s));
  const numbers = {
    pairs: pairs.length,
    grew,
    grewCi: pctCi(wilson(grew, pairs.length)),
    sameRuns: pairs.filter((p) => flight(p) === "SAME").length,
    sameRRuns: pairs.filter((p) => flight(p) === "SAME-R").length,
    medianRatio: round(median(ratios)!, 2),
    ratioCi: ciText(ratioCi),
    medianFreshUm: round(median(pairs.map((p) => p.d0))!, 2),
    medianAgedUm: round(median(pairs.map((p) => p.d1))!, 2),
    medianFreshAgeS: round(median(pairs.map((p) => p.t0).filter((v): v is number => v !== null))!, 0),
    medianAgedAgeS: round(median(pairs.map((p) => p.t1).filter((v): v is number => v !== null))!, 0),
  };
  const groups = new Map<string, number[]>();
  for (const p of pairs) {
    const k = `${flight(p)}|${p.fresh.material.name ?? p.fresh.material.raw}`;
    groups.set(k, [...(groups.get(k) ?? []), p.d1 / p.d0]);
  }
  return {
    id: "F8",
    title: "Spacecraft smoke particles grew as the smoke aged",
    claim:
      `In ${grew} of ${pairs.length} SAME and SAME-R runs measured both fresh and after ageing, the smoke's mean particle diameter grew. ` +
      `The median run grew ${numbers.medianRatio} times, from ${numbers.medianFreshUm} µm about ${numbers.medianFreshAgeS} s after the smoke was made to ${numbers.medianAgedUm} µm after about ${numbers.medianAgedAgeS} s.`,
    numbers,
    n: pairs.length,
    rows: pairs.flatMap((p) => [p.fresh.id, p.aged.id]),
    excluded: [{ reason: "aged run without a measured diameter for it or its fresh run (NASA wrote 0)", count: missing }].filter((e) => e.count > 0),
    method:
      `1. Take NASA's SAME and SAME-R results workbook ("Reduced data sheet"). 2. Pair each run numbered "…a" (measured after ageing) with the run of the same number (measured fresh). ` +
      `3. Use NASA's "M1/M0 (micro-m)--AMD" column, the mean particle diameter from the first two moments of the size distribution; a 0 means nothing was measured and the pair is left out. 4. Divide aged by fresh diameter.`,
    uncertainty: {
      text: `Share of runs that grew: 95% interval ${numbers.grewCi}. Median growth: 95% bootstrap interval ${numbers.ratioCi} times.`,
      method: "Wilson score interval for the share; percentile bootstrap (2000 seeded resamples) for the median ratio.",
    },
    confounders: [
      `${numbers.sameRRuns} of the ${pairs.length} pairs are SAME-R and ${numbers.sameRuns} SAME; the two flights differ in materials and heater settings.`,
      "Ageing time, heater temperature and flow differ between runs; the ratio does not separate them.",
      "Some particles can deposit on chamber walls while the smoke ages, which also changes the measured mean size.",
    ],
    notClaimed:
      "Smoke from heated (not flaming) materials in an experiment chamber, not a cabin fire. It does not set a detector design or say how fast cabin smoke ages.",
    investigations: ["same", "same-r"],
    table: {
      columns: ["Flight", "Material", "Runs paired", "Grew", "Median growth (×)"],
      rows: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, rs]) => {
        const [f, m] = k.split("|");
        return [f, m, rs.length, rs.filter((x) => x > 1).length, round(median(rs)!, 2)];
      }),
    },
  };
}
