// F3: Saffire-II (PSI-99) records, for each sample, the burn length in orbit and the burn length
// of a matching ground test in 1 g. This compares the two, sample by sample.
import type { AtlasRow } from "../atlas/types";
import { signTestP, round } from "./stats";
import type { Finding } from "./types";

/** 0 = no flame spread, 1 = partial burn, 2 = the whole sample burned. */
type Extent = 0 | 1 | 2;
const EXTENT_WORDS = ["no spread", "partial burn", "whole sample"] as const;

/** Orbit: from the atlas outcome, which reads NASA's µ-g burn length. */
function orbitExtent(r: AtlasRow): Extent | null {
  return r.outcome.value === "no-spread" ? 0 : r.outcome.value === "burned" ? 1 : r.outcome.value === "burned-out" ? 2 : null;
}

/** Ground: from NASA's "1-g Burn Length" text ("Complete", "7.6 cm", "~ 0"). */
export function groundExtent(text: string | undefined): Extent | null {
  const t = (text ?? "").trim();
  if (/^complete$/i.test(t)) return 2;
  if (/^~?\s*0(\s|$)/.test(t)) return 0;
  if (/^~?\s*\d*\.?\d+\s*cm$/i.test(t)) return 1;
  return null;
}

export function f3EarthVsOrbit(rows: AtlasRow[]): Finding {
  const tests = rows.filter((r) => r.investigation === "saffire-ii" && r.rowKind === "test");
  const composite = tests.filter((r) => /composite/i.test(r.material.name ?? ""));
  const pairs = tests
    .filter((r) => !composite.includes(r))
    .map((r) => ({ r, orbit: orbitExtent(r), ground: groundExtent(String(r.measures.burnLength1g?.v ?? "")) }))
    .filter((p): p is { r: AtlasRow; orbit: Extent; ground: Extent } => p.orbit !== null && p.ground !== null);
  const earthFurther = pairs.filter((p) => p.ground > p.orbit);
  const same = pairs.filter((p) => p.ground === p.orbit);
  const orbitFurther = pairs.filter((p) => p.ground < p.orbit);
  const silicone = pairs.filter((p) => p.r.material.name === "Silicone rubber");
  const o2 = [...new Set(pairs.flatMap((p) => (p.r.o2Pct?.v != null ? [p.r.o2Pct.v] : p.r.o2Pct?.values ?? [])))].sort((a, b) => a - b);
  const flows = [...new Set(pairs.map((p) => p.r.flowCms?.v).filter((v): v is number => typeof v === "number"))];
  const numbers = {
    samples: pairs.length,
    earthFurther: earthFurther.length,
    same: same.length,
    orbitFurther: orbitFurther.length,
    siliconeSamples: silicone.length,
    siliconeEarthFurther: silicone.filter((p) => p.ground > p.orbit).length,
    o2Min: Math.min(...o2),
    o2Max: Math.max(...o2),
    flowCms: flows.join(", "),
    signTestP: round(signTestP(earthFurther.length, orbitFurther.length), 3),
  };
  const sampleNo = (r: AtlasRow) => String(r.measures.sample?.v ?? r.id.replace(/^.*:r/, "row "));
  return {
    id: "F3",
    title: "Earth's test burned further than orbit, sample for sample",
    claim:
      `In ${numbers.earthFurther} of ${numbers.samples} Saffire-II samples the 1-g ground test burned further than the same material did in orbit, ${numbers.same} burned the same, and none burned further in orbit. ` +
      `${numbers.siliconeEarthFurther} of the ${numbers.siliconeSamples} silicone samples spread a flame on the ground but not in orbit (about ${numbers.o2Min}–${numbers.o2Max}% O₂, ${numbers.flowCms} cm/s air flow in orbit).`,
    numbers,
    n: pairs.length,
    rows: pairs.map((p) => p.r.id),
    excluded: [
      { reason: "composite PMMA + Nomex sample: NASA reports the two materials differently in the orbit and ground columns", count: composite.length },
      { reason: "burn length missing in orbit or on the ground", count: tests.length - composite.length - pairs.length },
    ].filter((e) => e.count > 0),
    method:
      `1. For each Saffire-II sample, read NASA's µ-g burn length (orbit) and 1-g burn length (ground). ` +
      `2. Put each on the same three-step scale: no spread (about 0), partial burn (a length in cm, short of the sample), whole sample ("Complete", or a µ-g length equal to the 29 cm sample). ` +
      `3. Compare the two for the same sample.`,
    uncertainty: {
      text:
        `If ground and orbit were equally likely to burn further, a split of ${numbers.earthFurther} to ${numbers.orbitFurther} (ties left out) would happen by chance with probability ${numbers.signTestP} (two-sided sign test). ` +
        `${numbers.signTestP < 0.05 ? "That is unlikely by chance for these samples, but they are" : "That could be chance; these are"} only ${numbers.samples} samples of mostly different materials.`,
      method: "Exact two-sided sign test on the samples that differ; samples that burned the same on the ground and in orbit are left out. Each sample is treated as an independent pair.",
    },
    confounders: [
      "The table does not say how the 1-g tests were set up (orientation, flow), so the ground flame may have been driven by buoyant flow rather than the 20 cm/s forced flow used in orbit.",
      "One sample per material and thickness, at one oxygen level (about 22%).",
      "Two samples have no material named in NASA's table; they are compared as pairs but not named.",
    ],
    notClaimed:
      "Eight samples at about 22% O₂ and 20 cm/s. This does not show that Earth tests are conservative in general: other NASA work suggests some materials burn more readily in low gravity under other flows and oxygen levels.",
    investigations: ["saffire-ii"],
    table: {
      columns: ["Sample", "Material", "Thickness (mm)", "In orbit", "On the ground (1 g)", "Ground vs orbit"],
      rows: pairs.map((p) => [
        sampleNo(p.r),
        p.r.material.name ?? "not stated in NASA's table",
        typeof p.r.measures.thicknessMm?.v === "number" ? p.r.measures.thicknessMm.v : null,
        EXTENT_WORDS[p.orbit],
        EXTENT_WORDS[p.ground],
        p.ground > p.orbit ? "ground further" : p.ground === p.orbit ? "same" : "orbit further",
      ]),
    },
  };
}
