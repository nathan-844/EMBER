// F4: BASS-II (PSI-25) records O₂, CO₂ and CO in the Microgravity Science Glovebox before and
// after each burn. The change per burn shows how much each kind of sample fouled the air.
import type { AtlasRow, Quantity } from "../atlas/types";
import { bootstrapCI, ciText, median, round } from "./stats";
import type { Finding } from "./types";

const num = (q: unknown) => (q && typeof (q as Quantity).v === "number" ? (q as Quantity).v : null);
const censored = (q: unknown) => !!(q as Quantity | undefined)?.flags?.includes("censored");

const groupName = (r: AtlasRow) => {
  const m = r.material;
  if (!m.name) return `Not named (${m.form ?? "unknown form"})`;
  if (m.name === "PMMA") return `PMMA ${m.form}`;
  return m.name;
};

export function f4CarbonMonoxide(rows: AtlasRow[]): Finding {
  const tests = rows.filter((r) => r.investigation === "bass-ii" && r.rowKind === "test");
  const suspect = tests.filter((r) => r.flags.includes("o2-end-implausible"));
  const groups = new Map<string, { co: { id: string; v: number }[]; co2: number[]; offScale: string[]; inferred: number; tests: number }>();
  let missing = 0;
  for (const r of tests) {
    if (suspect.includes(r)) continue;
    const g = groups.get(groupName(r)) ?? { co: [], co2: [], offScale: [], inferred: 0, tests: 0 };
    groups.set(groupName(r), g);
    g.tests++;
    if (r.material.basis === "inferred") g.inferred++;
    const m = r.measures;
    if (censored(m.coEndPpm)) g.offScale.push(r.id);
    const c0 = num(m.coStartPpm), c1 = num(m.coEndPpm);
    if (c0 !== null && c1 !== null) g.co.push({ id: r.id, v: c1 - c0 });
    else if (!censored(m.coEndPpm)) missing++;
    const d0 = num(m.co2StartPct), d1 = num(m.co2EndPct);
    if (d0 !== null && d1 !== null) g.co2.push(d1 - d0);
  }
  const table = [...groups.entries()]
    .map(([name, g]) => ({ name, ...g, coMed: median(g.co.map((x) => x.v)), co2Med: median(g.co2) }))
    .sort((a, b) => (b.coMed ?? -Infinity) - (a.coMed ?? -Infinity));
  const slab = table.find((g) => g.name === "PMMA slab")!;
  const fabric = table.find((g) => g.name === "SIBAL cotton-fiberglass fabric")!;
  const offScale = table.reduce((n, g) => n + g.offScale.length, 0);
  const offScalePmma = table.filter((g) => g.name.startsWith("PMMA")).reduce((n, g) => n + g.offScale.length, 0);
  const used = table.flatMap((g) => g.co.map((x) => x.id));
  const slabV = slab.co.map((x) => x.v), fabricV = fabric.co.map((x) => x.v);
  const slabCi = bootstrapCI([slabV], ([s]) => median(s));
  const fabricCi = bootstrapCI([fabricV], ([f]) => median(f));
  const ratioCi = bootstrapCI([slabV, fabricV], ([s, f]) => { const fm = median(f); return fm && fm > 0 ? median(s)! / fm : null; });
  const numbers = {
    slabCoMedianPpm: round(slab.coMed!, 0),
    slabTests: slab.co.length,
    fabricCoMedianPpm: round(fabric.coMed!, 0),
    fabricTests: fabric.co.length,
    ratio: round(slab.coMed! / fabric.coMed!, 0),
    offScale,
    offScalePmma,
    tests: used.length,
    slabCi: ciText(slabCi, 0),
    fabricCi: ciText(fabricCi, 0),
    ratioCi: ciText(ratioCi, 0),
  };
  return {
    id: "F4",
    title: "Thick plastic fouled the air far more than fabric",
    claim:
      `In BASS-II's glovebox, a burn of thick PMMA (acrylic) slab raised carbon monoxide by a median ${numbers.slabCoMedianPpm} ppm (${numbers.slabTests} burns), about ${numbers.ratio} times the ${numbers.fabricCoMedianPpm} ppm of SIBAL fabric (${numbers.fabricTests} burns). ` +
      `${offScale} more burns pushed CO off the sensor's scale${offScale ? `, ${offScalePmma === offScale ? "all" : offScalePmma} of them PMMA` : ""}.`,
    numbers,
    n: used.length,
    rows: [...used, ...table.flatMap((g) => g.offScale)],
    excluded: [
      { reason: "final O₂ implausible (a likely transcription slip), so the row's gas readings are not trusted", count: suspect.length },
      { reason: "CO not recorded before or after the burn", count: missing },
    ].filter((e) => e.count > 0),
    method:
      `1. Take every BASS-II burn. 2. Subtract NASA's "Initial CO (ppm)" from "Final CO (ppm)", and initial from final CO₂ (% by volume). ` +
      `3. Group burns by material and form from the atlas material dictionary (PMMA slab, rod or film; SIBAL; Nomex; wax). 4. Report the median change per group. ` +
      `Readings NASA marks as off the scale (">500", "OR", "over") are counted separately, never given a number.`,
    uncertainty: {
      text:
        `95% bootstrap intervals: PMMA slab median ${numbers.slabCi} ppm, SIBAL fabric median ${numbers.fabricCi} ppm, ratio ${numbers.ratioCi} times. ` +
        (offScale
          ? `The ${offScale} burns that pushed CO off the sensor's scale${offScalePmma === offScale ? " (all PMMA)" : ""} are left out of the medians${offScalePmma === offScale ? "; counting them could only raise PMMA's figures" : ""}.`
          : ""),
      method: "Percentile bootstrap: each group's burns resampled with replacement 2000 times (seeded), medians and their ratio recomputed, middle 95% kept.",
    },
    confounders: [
      "Burns differ in length, sample size, airflow and starting oxygen; the change is per burn, not per gram of fuel.",
      "All burns share one glovebox volume, but the glovebox air was not always refreshed between burns, so starting levels differ.",
      "NASA's headers call the O₂ readings calibrated but say nothing about the CO and CO₂ sensors.",
      "Many PMMA rods and some films do not name their material; EMBER infers PMMA for them from the BASS-II record (marked in the table).",
    ],
    notClaimed:
      "A glovebox, not a cabin, and not a toxicity rating. It shows which BASS-II samples changed the glovebox air most, not how dangerous a cabin fire would be.",
    investigations: ["bass-ii"],
    table: {
      columns: ["Material", "Burns", "Material inferred", "Median CO change (ppm)", "Median CO₂ change (% points)", "CO off scale"],
      rows: table.map((g) => [g.name, g.tests, g.inferred, g.coMed === null ? null : round(g.coMed, 0), g.co2Med === null ? null : round(g.co2Med, 2), g.offScale.length]),
    },
  };
}
