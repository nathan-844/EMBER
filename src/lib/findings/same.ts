// F8: SAME and SAME-R measured each smoke sample twice: just after it was made, and again after it
// had aged in the chamber. NASA's results workbook lists both; the atlas groups the two rows of a
// run under one experiment identity (sample type + SAME test number). This compares them.
import type { AtlasRow, Quantity } from "../atlas/types";
import { bootstrapCI, ciText, median, round, wilson, pctCi } from "./stats";
import type { Finding } from "./types";

const num = (q: unknown) => (q && typeof (q as Quantity).v === "number" ? (q as Quantity).v! : null);
const flight = (r: AtlasRow) => (r.investigation === "same" ? "SAME" : "SAME-R");
/** Conditions that must be the same on the fresh and aged rows of one run. */
const SAME_RUN_FIELDS: [string, (r: AtlasRow) => unknown][] = [
  ["flight", (r) => r.investigation],
  ["material", (r) => r.material.raw.trim().toLowerCase()],
  ["inlet velocity", (r) => r.flowCms?.v ?? null],
  ["heater setting (Rt/R0)", (r) => num(r.measures.rtOverR0)],
];

export interface AgePair { id: string; fresh: AtlasRow; aged: AtlasRow; d0: number; d1: number; t0: number | null; t1: number | null }

/**
 * Fresh/aged pairs from the workbook, one per run. A run is left out, with its id and the reason,
 * when its identity is ambiguous, a row is missing, a condition differs between its two rows, or a
 * diameter is not in the sheet. Nothing is paired by position or guessed.
 */
export function agePairs(rows: AtlasRow[]): { pairs: AgePair[]; excluded: { reason: string; count: number; ids: string[] }[] } {
  const book = rows.filter((r) => r.source.kind === "psi" && r.source.table === "PSI-101-1" && r.experiment);
  const runs = new Map<string, AtlasRow[]>();
  for (const r of book) runs.set(r.experiment!.id, [...(runs.get(r.experiment!.id) ?? []), r]);
  const pairs: AgePair[] = [];
  const out = new Map<string, string[]>();
  const drop = (reason: string, id: string) => out.set(reason, [...(out.get(reason) ?? []), id]);
  for (const [id, rs] of [...runs.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const fresh = rs.filter((r) => r.experiment!.role === "run"), aged = rs.filter((r) => r.experiment!.role === "aged");
    if (!aged.length) continue; // measured once: not part of this comparison
    if (fresh.length !== 1 || aged.length !== 1) { drop("more than one fresh or aged row carries this run's identity, or the fresh row is missing", id); continue; }
    const [f, a] = [fresh[0], aged[0]];
    const differs = SAME_RUN_FIELDS.filter(([, get]) => get(f) !== get(a)).map(([name]) => name);
    if (differs.length) { drop(`the fresh and aged rows disagree on ${differs.join(", ")}`, id); continue; }
    const d0 = num(f.measures.amdUm), d1 = num(a.measures.amdUm);
    if (d0 === null || d1 === null || d0 <= 0 || d1 <= 0) { drop("the sheet holds no mean diameter for the fresh or the aged row (NASA wrote 0 or an error value)", id); continue; }
    pairs.push({ id, fresh: f, aged: a, d0, d1, t0: num(f.measures.netAgingS), t1: num(a.measures.netAgingS) });
  }
  return { pairs, excluded: [...out.entries()].map(([reason, ids]) => ({ reason, count: ids.length, ids })) };
}

export function f8SmokeGrowsWithAge(rows: AtlasRow[]): Finding {
  const { pairs, excluded } = agePairs(rows);
  const ratios = pairs.map((p) => p.d1 / p.d0);
  const grew = ratios.filter((x) => x > 1).length;
  const ratioCi = bootstrapCI([ratios], ([s]) => median(s));
  const timed = pairs.filter((p) => p.t0 !== null && p.t1 !== null);
  const byFlight = (name: string) => pairs.filter((p) => flight(p.fresh) === name);
  const flightMedian = (name: string) => { const rs = byFlight(name).map((p) => p.d1 / p.d0); return rs.length ? round(median(rs)!, 2) : "n/a"; };
  const numbers = {
    pairs: pairs.length,
    grew,
    grewCi: pctCi(wilson(grew, pairs.length)),
    sameRuns: byFlight("SAME").length,
    sameRRuns: byFlight("SAME-R").length,
    sameMedianRatio: flightMedian("SAME"),
    sameRMedianRatio: flightMedian("SAME-R"),
    medianRatio: round(median(ratios)!, 2),
    ratioCi: ciText(ratioCi),
    medianFreshUm: round(median(pairs.map((p) => p.d0))!, 2),
    medianAgedUm: round(median(pairs.map((p) => p.d1))!, 2),
    pairsWithTimes: timed.length,
    medianFreshAgeS: round(median(timed.map((p) => p.t0!))!, 0),
    medianAgedAgeS: round(median(timed.map((p) => p.t1!))!, 0),
  };
  const groups = new Map<string, number[]>();
  for (const p of pairs) {
    const k = `${flight(p.fresh)}|${p.fresh.material.name ?? p.fresh.material.raw}`;
    groups.set(k, [...(groups.get(k) ?? []), p.d1 / p.d0]);
  }
  return {
    id: "F8",
    title: "Spacecraft smoke particles grew as the smoke aged",
    claim:
      `In ${grew} of ${pairs.length} SAME and SAME-R runs measured both fresh and after ageing, the smoke's mean particle diameter grew. ` +
      `The median run grew ${numbers.medianRatio} times (SAME ${numbers.sameMedianRatio} times over ${numbers.sameRuns} runs, SAME-R ${numbers.sameRMedianRatio} times over ${numbers.sameRRuns}). ` +
      `Across the runs, the median fresh diameter was ${numbers.medianFreshUm} µm and the median aged diameter ${numbers.medianAgedUm} µm; fresh smoke was measured a median ${numbers.medianFreshAgeS} s after it was made and aged smoke ${numbers.medianAgedAgeS} s.`,
    numbers,
    // Each pair is one run observed twice: n counts runs, and both rows of each run are cited.
    n: pairs.length,
    unit: "runs, each measured fresh and aged",
    rows: pairs.flatMap((p) => [p.fresh.id, p.aged.id]),
    excluded,
    method:
      `1. Take NASA's SAME and SAME-R results workbook ("Reduced data sheet"). 2. Group its rows by run: sample type plus SAME test number, where a number ending in "a" is the aged measurement of that run. ` +
      `3. Keep runs with exactly one fresh and one aged row whose flight, material, inlet velocity and heater setting agree. ` +
      `4. Use NASA's "M1/M0 (micro-m)--AMD" column, the mean particle diameter from the first two moments of the size distribution; a 0 or an error value means the sheet holds no diameter for that row, and the run is left out. ` +
      `5. Divide aged by fresh diameter for each run, then take the median of those ratios. The two median diameters and the two median times are each taken across runs and do not describe one run.`,
    uncertainty: {
      text: `Share of runs that grew: 95% interval ${numbers.grewCi}. Median growth: 95% bootstrap interval ${numbers.ratioCi} times.`,
      method: "Wilson score interval for the share; percentile bootstrap (2000 seeded resamples) of whole runs for the median ratio. Both treat each run as independent; runs made on the same day or from the same sample carousel may not be, which would make the intervals too narrow.",
    },
    confounders: [
      `${numbers.sameRRuns} of the ${pairs.length} runs are SAME-R and ${numbers.sameRuns} SAME; the two flights differ in materials and heater settings.`,
      "Ageing time, heater temperature and flow differ between runs; the ratio does not separate them.",
      "Some particles can deposit on chamber walls while the smoke ages, which also changes the measured mean size.",
      "This is the count-weighted mean diameter. NASA's mass-based diameter is a different measure and is not used here.",
    ],
    notClaimed:
      "Smoke from heated (not flaming) materials in an experiment chamber, not a cabin fire. It does not set a detector design, give a growth rate, or say how fast cabin smoke ages.",
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
