import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../data/table-manifest.json";
import { TABLES } from "../../data/tables";
import { buildAtlas } from "../atlas/build";
import { COMPUTE, computeFindings } from ".";
import { citedRows } from "./rows";
import { groundExtent } from "./saffire";
import { bootstrapCI, median, ranks, signTestP, spearman, wilson } from "./stats";
import type { Finding } from "./types";

const atlas = buildAtlas(TABLES, manifest);
const file = computeFindings(atlas);
const byId = (id: string): Finding => file.findings.find((f) => f.id === id)!;
const atlasIds = new Set(atlas.rows.map((r) => r.id));

/** Raw cells of a stored NASA table, by header (whitespace-insensitive). */
function rawTable(id: string) {
  const t = TABLES[id];
  const norm = (h: string) => h.replace(/\s+/g, " ").trim();
  return t.rows.map((r) => (col: string) => r.cells[t.header.findIndex((h) => norm(h) === norm(col))] ?? "");
}

describe("stats", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("ranks average ties", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
  it("spearman: perfect, reversed and with ties (worked by hand: 1.5 / √3)", () => {
    expect(spearman([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(spearman([1, 2, 3], [1, 1, 2])).toBeCloseTo(1.5 / Math.sqrt(3), 10);
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});

describe("every finding", () => {
  it("matches the committed findings file (run npm run data:findings after changing a rule)", () => {
    expect(JSON.parse(readFileSync("src/data/findings.json", "utf8"))).toEqual(JSON.parse(JSON.stringify(file)));
  });

  it("ships every cited row, with NASA's raw cells, for the Findings page", () => {
    const committed = JSON.parse(readFileSync("src/data/findings-rows.json", "utf8"));
    expect(committed).toEqual(JSON.parse(JSON.stringify(citedRows(atlas, file))));
    for (const f of file.findings) for (const id of f.rows) expect(committed[id]?.cells.length, `${f.id} ${id}`).toBeGreaterThan(0);
  });

  it("has unique ids, cites only atlas rows, and states its method, limits and what it does not claim", () => {
    expect(new Set(file.findings.map((f) => f.id)).size).toBe(file.findings.length);
    for (const f of file.findings) {
      expect(f.n, f.id).toBeGreaterThan(0);
      expect(f.rows.length, f.id).toBeGreaterThan(0);
      for (const id of f.rows) expect(atlasIds.has(id), `${f.id} ${id}`).toBe(true);
      expect(f.method.length, f.id).toBeGreaterThan(40);
      expect(f.confounders.length, f.id).toBeGreaterThan(0);
      expect(f.notClaimed.length, f.id).toBeGreaterThan(20);
      for (const e of f.excluded) expect(e.count, `${f.id} ${e.reason}`).toBeGreaterThan(0);
      for (const row of f.table.rows) expect(row, f.id).toHaveLength(f.table.columns.length);
    }
  });

  it("uses only numbers it computed: every number in a claim is one of the finding's numbers", () => {
    // Fixed names that contain digits are not data: "1 atm" (a band name), "1-g", O₂/CO₂ subscripts.
    const FIXED = /\b1 atm\b|\b1-g\b/g;
    for (const f of file.findings) {
      const allowed = new Set(
        Object.values(f.numbers).flatMap((v) => (typeof v === "number" ? [String(v)] : (String(v).match(/-?\d+(\.\d+)?/g) ?? []))),
      );
      const used = f.claim.replace(FIXED, "").match(/-?\d+(\.\d+)?/g) ?? [];
      for (const n of used) expect(allowed.has(n) || allowed.has(n.replace(/^-/, "")), `${f.id}: "${n}" in the claim is not in its numbers`).toBe(true);
    }
  });

  it("can be recomputed from the rows it cites alone", () => {
    const rows = new Map(atlas.rows.map((r) => [r.id, r]));
    // Counts of everything looked at (not just the rows used) naturally differ on a subset.
    const WHOLE_SET: Record<string, string[]> = { F6: ["solidTests"] };
    file.findings.forEach((f, i) => {
      const again = COMPUTE[i](f.rows.map((id) => rows.get(id)!));
      const pick = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => !(WHOLE_SET[f.id] ?? []).includes(k)));
      expect(pick(again.numbers), f.id).toEqual(pick(f.numbers));
    });
  });
});

// Independent checks: each recomputes a headline number straight from NASA's raw cells, without
// the atlas, using the column meanings documented in the finding.
describe("headline numbers, rechecked from NASA's raw cells", () => {
  it("F2: FLEX flames that went out, in air at 1 atm and at ≥30% O₂ near 10.4 psia", () => {
    const flex = rawTable("PSI-69-0").filter((c) => Number(c("CO initial ambient composition; mole fraction")) === 0 && Number(c("He initial ambient composition; mole fraction")) === 0);
    const psi = (c: (k: string) => string) => (Number(c("Ambient pressure; mmHg")) * 14.6959) / 760;
    const air = flex.filter((c) => Number(c("O initial ambient composition; mole fraction")) === 0.21 && psi(c) >= 12 && psi(c) < 16);
    const high = flex.filter((c) => Number(c("O initial ambient composition; mole fraction")) >= 0.3 && psi(c) >= 9 && psi(c) < 12);
    const out = (cs: typeof flex) => cs.filter((c) => c("Test end").trim() === "Extinction").length;
    expect(byId("F2").numbers).toMatchObject({ airRuns: air.length, airWentOut: out(air), runs: high.length, wentOut: out(high) });
    expect([air.length, out(air), high.length, out(high)]).toEqual([29, 14, 17, 0]);
  });

  it("F3: Saffire-II ground vs orbit, read directly from the burn-length columns", () => {
    const pairs = rawTable("PSI-99-0")
      .filter((c) => c("Burn Time (s)").trim() && !/nomex/i.test(c("Material")))
      .map((c) => ({ orbit: /^~\s*0/.test(c("?-g Burn Length")) ? 0 : /^29 cm$/.test(c("?-g Burn Length").trim()) ? 2 : 1, ground: groundExtent(c("1-g Burn Length")) }));
    expect(pairs).toHaveLength(8);
    expect(pairs.filter((p) => p.ground! > p.orbit)).toHaveLength(byId("F3").numbers.earthFurther as number);
    expect(byId("F3").numbers).toMatchObject({ samples: 8, earthFurther: 5, same: 3, orbitFurther: 0 });
  });

  it("F4: median CO rise of BASS-II PMMA slabs and SIBAL, from the CO columns", () => {
    const rows = rawTable("PSI-25-0").filter((c) => Math.abs(Number(c("Calibrated  initial O2 % by vol ")) - Number(c("Calibrated final O2 % by vol"))) <= 5 || !c("Calibrated final O2 % by vol").trim());
    const rise = (re: RegExp) =>
      median(
        rows
          .filter((c) => re.test(c("Fuel Sample Material")))
          .map((c) => [c("Initial CO (ppm)"), c("Final CO (ppm)")].map((s) => s.trim()))
          .filter(([a, b]) => /^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(b))
          .map(([a, b]) => Number(b) - Number(a)),
      );
    // Slabs: PMMA labels with a thickness in mm (not microns, films, rods or spheres).
    expect(rise(/^(?!.*(micron|film|rod|sphere)).*\d\s*mm.*pmma|pmma.*\d\s*mm(?!.*(micron|film|rod|sphere))/i)).toBe(byId("F4").numbers.slabCoMedianPpm);
    expect(rise(/sibal/i)).toBe(byId("F4").numbers.fabricCoMedianPpm);
    expect(byId("F4").numbers).toMatchObject({ slabCoMedianPpm: 335, fabricCoMedianPpm: 20 });
  });

  it("F7: CO rise per BASS-II burn, from the CO columns", () => {
    const rows = rawTable("PSI-25-0").filter((c) => Math.abs(Number(c("Calibrated  initial O2 % by vol ")) - Number(c("Calibrated final O2 % by vol"))) <= 5 || !c("Calibrated final O2 % by vol").trim());
    const rises = rows
      .map((c) => [c("Initial CO (ppm)"), c("Final CO (ppm)")].map((s) => s.trim()))
      .filter(([a, b]) => /^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(b))
      .map(([a, b]) => Number(b) - Number(a));
    expect(rises.filter((v) => v > 0).length).toBe(byId("F7").numbers.rose);
    expect(median(rises)).toBe(byId("F7").numbers.medianRisePpm);
    expect(Math.max(...rises)).toBe(byId("F7").numbers.maxRisePpm);
    expect(byId("F7").numbers).toMatchObject({ burns: 118, rose: 117, medianRisePpm: 45, maxRisePpm: 575, offScale: 4 });
  });

  it("F8: SAME and SAME-R smoke before and after ageing, from the results workbook's diameter column", () => {
    const rows = rawTable("PSI-101-1");
    const amd = new Map(rows.map((c) => [c("SAME #").trim(), Number(c("M1/M0 (micro-m)--AMD"))]));
    const ratios = [...amd.entries()]
      .filter(([k]) => /a$/.test(k))
      .map(([k, aged]) => [amd.get(k.slice(0, -1)), aged] as const)
      .filter(([fresh, aged]) => fresh! > 0 && aged > 0)
      .map(([fresh, aged]) => aged / fresh!);
    expect(ratios).toHaveLength(byId("F8").numbers.pairs as number);
    expect(ratios.filter((x) => x > 1)).toHaveLength(byId("F8").numbers.grew as number);
    expect(byId("F8").numbers).toMatchObject({ pairs: 48, grew: 46, medianRatio: 1.5 });
  });

  it("F5: cool flames in CFI-G, from the \"Cool flame?\" column", () => {
    const rows = rawTable("PSI-159-0");
    const cool = rows.filter((c) => /^yes/i.test(c("Cool flame?").trim()));
    expect(cool).toHaveLength(7);
    expect(new Set(cool.map((c) => `${c("Fuel")}|${c("approx p (bar)")}`))).toEqual(new Set(["30% butane|2.0266"]));
    expect(byId("F5").numbers).toMatchObject({ runs: rows.length, coolFlames: 7, sameSettingRuns: 17 });
  });

  it("F6: the highest solid-material oxygen in the PSI tables is 22.2%", () => {
    const o2 = [
      ...rawTable("PSI-25-0").map((c) => Number(c("Calibrated  initial O2 % by vol "))),
      ...rawTable("PSI-98-0").flatMap((c) => (c("Percent O2").match(/\d+(\.\d+)?/g) ?? []).map(Number)),
      ...rawTable("PSI-99-0").flatMap((c) => (c("Percent O2 (Note 1)").match(/\d+(\.\d+)?/g) ?? []).map(Number)),
    ].filter((v) => Number.isFinite(v));
    expect(Math.max(...o2)).toBe(22.2);
    expect(byId("F6").numbers).toMatchObject({ psiHighestO2: 22.2, inZone: 2, inZoneBurned: 2 });
  });

  it("F1: methanol in nitrogen at 1 atm, extinction ratio at 12% and 30% O₂", () => {
    const rows = rawTable("PSI-69-0").filter(
      (c) =>
        c("Fuel") === "Methanol" && c("Test end").trim() === "Extinction" &&
        Number(c("CO initial ambient composition; mole fraction")) === 0 && Number(c("He initial ambient composition; mole fraction")) === 0 &&
        /^\d/.test(c("Visible flame extinction diameter; mm")) && (Number(c("Ambient pressure; mmHg")) * 14.6959) / 760 >= 12 && (Number(c("Ambient pressure; mmHg")) * 14.6959) / 760 < 16,
    );
    const at = (o2: number) => median(rows.filter((c) => Number(c("O initial ambient composition; mole fraction")) === o2).map((c) => Number(c("Visible flame extinction diameter; mm")) / Number(c("Droplet initial diameter; mm"))))!;
    expect(Number(at(0.12).toFixed(2))).toBe(byId("F1").numbers.refLowRatio);
    expect(Number(at(0.3).toFixed(2))).toBe(byId("F1").numbers.refHighRatio);
  });
});

describe("uncertainty", () => {
  it("matches hand-worked Wilson intervals and sign tests", () => {
    const [lo, hi] = wilson(6, 13);
    expect(lo).toBeCloseTo(0.2321, 3);
    expect(hi).toBeCloseTo(0.7086, 3);
    expect(wilson(0, 13)[1]).toBeCloseTo(0.2281, 3);
    expect(signTestP(6, 0)).toBeCloseTo(0.03125, 6);
    expect(signTestP(5, 1)).toBeCloseTo(0.21875, 6);
    expect(signTestP(0, 0)).toBe(1);
  });

  it("gives the same bootstrap interval on every run, and one that holds the estimate", () => {
    const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    const a = bootstrapCI([xs], ([s]) => median(s)), b = bootstrapCI([xs], ([s]) => median(s));
    expect(a).toEqual(b);
    expect(a![0]).toBeLessThanOrEqual(median(xs)!);
    expect(a![1]).toBeGreaterThanOrEqual(median(xs)!);
  });

  it("states how sure every finding is, and how that was worked out", () => {
    const file = JSON.parse(readFileSync("src/data/findings.json", "utf8")) as { findings: Finding[] };
    for (const f of file.findings) {
      expect(f.uncertainty.text.length, f.id).toBeGreaterThan(40);
      expect(f.uncertainty.method.length, f.id).toBeGreaterThan(20);
    }
    const f1 = file.findings.find((f) => f.id === "F1")!;
    expect(f1.numbers.groupsIntervalBelowZero as number).toBeLessThanOrEqual(f1.numbers.groupsFallingOxygenMoreFuelLeft as number);
    expect(file.findings.find((f) => f.id === "F3")!.uncertainty.text).toMatch(/sign test/);
  });
});
