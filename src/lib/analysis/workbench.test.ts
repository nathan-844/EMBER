import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import engine from "virtual:research-engine";
import { TABLES } from "../../data/tables";
import committed from "../../data/findings.json";
import { computeFindings } from "../findings";
import { researchAtlas, quantitySemantics } from "../atlas/research";
import { RESEARCH_ATLAS } from "./research-data";
import { researchPackage } from "./research-export";
import { compareWorkbench, defaultWorkbench, type WorkbenchSpec } from "./workbench";
import { BENCHMARK_CASES, runBenchmark } from "./benchmark";
import { SNAPSHOT } from "../snapshot";

const rows = RESEARCH_ATLAS.rows;
const spec = (template: WorkbenchSpec["template"] = "saffire") => defaultWorkbench(SNAPSHOT.id, template);
describe("M2 scientific comparisons", () => {
  it("reconciles every Saffire pair with independently read source cells", () => {
    // Hand transcription from PSI-99, in sample order: ground category minus orbit category.
    const expected = { "2-1": 1, "2-2": 1, "2-3": 0, "2-4": 1, "2-5": 0, "2-6": 0, "2-8": 1, "2-9": 1 };
    const actual = compareWorkbench(rows, spec());
    for (const r of actual.used) {
      const raw = TABLES["PSI-99-0"].rows.find((x) => `PSI-99-0:r${x.sourceRow}` === r.id)!;
      expect(r.value).toBe(expected[raw.cells[0] as keyof typeof expected]);
    }
    expect(actual.used).toHaveLength(8); expect(actual.excluded).toEqual([{ id: "PSI-99-0:r8", reason: "Composite reports different component endpoints" }]);
    expect(actual.counts).toMatchObject({ groundFurther: 5, orbitFurther: 0, ties: 3, twoSidedSignTestP: .0625 });
    expect(compareWorkbench(rows, { ...spec(), material: "Silicone rubber" }).counts.pairs).toBe(4);
  });
  it("matches an independent raw-cell FLEX reference calculation and includes only extinction endpoints", () => {
    const raw = TABLES["PSI-69-0"].rows;
    const eligible = raw.filter(({ cells: c }) => c[4] === "Methanol" && c[14] === "Extinction" && Number(c[8]) === 0 && Number(c[9]) === 0 && Number(c[5]) / 760 >= 12 / 14.6959 && Number(c[5]) / 760 <= 16 / 14.6959 && Number(c[10]) > 0 && Number(c[11]) > 0);
    const a = eligible.filter(({ cells: c }) => Number(c[6]) >= .12 && Number(c[6]) <= .16);
    const b = eligible.filter(({ cells: c }) => Number(c[6]) >= .20 && Number(c[6]) <= .22);
    const referenceMedian = (rs: typeof raw) => { const values = rs.map(({ cells: c }) => Number(c[11]) / Number(c[10])).sort((x, y) => x - y); return (values[Math.floor((values.length - 1) / 2)] + values[Math.ceil((values.length - 1) / 2)]) / 2; };
    const result = compareWorkbench(rows, spec("flex"));
    expect(result.counts).toEqual({ A: a.length, B: b.length });
    expect(result.estimate).toBeCloseTo(referenceMedian(a) - referenceMedian(b), 14);
    expect(result.used.map((r) => r.id).sort()).toEqual([...a, ...b].map((r) => `PSI-69-0:r${r.sourceRow}`).sort());
    expect(result.used.length + result.excluded.length).toBe(274);
    expect(result.limitations.join(" ")).toContain("not extinction probability");
  });
  it("preserves whole smoke pairs and matches direct workbook ratios by run labels", () => {
    const table = TABLES["PSI-101-1"], col = (name: string) => table.header.indexOf(name);
    const rawPairs = table.rows.filter((r) => /a$/.test(r.cells[col("SAME #")])).flatMap((aged) => {
      const test = aged.cells[col("SAME #")].replace(/a$/, "");
      const fresh = table.rows.find((r) => r.cells[0] === aged.cells[0] && r.cells[1] === aged.cells[1] && r.cells[col("SAME #")] === test);
      const d0 = fresh ? Number(fresh.cells[col("M1/M0 (micro-m)--AMD")]) : 0, d1 = Number(aged.cells[col("M1/M0 (micro-m)--AMD")]);
      return fresh && d0 > 0 && d1 > 0 ? [{ ids: [`PSI-101-1:r${fresh.sourceRow}`, `PSI-101-1:r${aged.sourceRow}`], ratio: d1 / d0 }] : [];
    });
    const result = compareWorkbench(rows, spec("smoke"));
    expect(result.counts).toEqual({ pairs: 48, observations: 96, grew: 46 });
    expect(rawPairs).toHaveLength(48);
    expect(result.excluded.some((r) => r.reason.startsWith("No aged observation"))).toBe(true);
    // Atlas v1 normalizes to 10 significant figures; the independent reference keeps
    // full workbook precision. This 1e-8 comparison tolerance is not sensor uncertainty.
    for (const pair of result.used) expect(pair.value).toBeCloseTo(rawPairs.find((p) => p.ids.join() === pair.observationIds.join())!.ratio, 8);
    expect(compareWorkbench(rows, { ...spec("smoke"), flight: "same" }).used).toHaveLength(8);
    expect(compareWorkbench(rows, { ...spec("smoke"), flight: "same-r" }).used).toHaveLength(40);
  });
  it.each(["saffire", "flex", "smoke"] as const)("deterministically recomputes %s without mutating source data", (template) => {
    const before = JSON.stringify(rows), s = spec(template);
    expect(compareWorkbench(rows, s)).toEqual(compareWorkbench(rows, s)); expect(JSON.stringify(rows)).toBe(before);
  });
  it("refuses empty or overlapping FLEX cohorts and preserves missing context", () => {
    expect(compareWorkbench(rows, { ...spec("flex"), oxygenA: [20, 22], oxygenB: [21, 24] }).status).toBe("blocked");
    expect(compareWorkbench(rows, { ...spec("flex"), oxygenA: [90, 95] }).status).toBe("blocked");
    const copy = structuredClone(rows.filter((r) => r.investigation === "flex"));
    copy.forEach((r) => { delete r.diluent; });
    const result = compareWorkbench(copy, spec("flex"));
    expect(result.status).toBe("blocked"); expect(result.used).toHaveLength(0); expect(result.excluded.every((r) => r.reason.startsWith("Missing diluent"))).toBe(true);
  });
  it("does not count a duplicated smoke observation as another independent pair", () => {
    const original = compareWorkbench(rows, spec("smoke"));
    const duplicate = rows.find((r) => r.id === original.used[0].observationIds[0])!;
    const next = compareWorkbench([...rows, duplicate], spec("smoke"));
    expect(next.used).toHaveLength(47); expect(next.excluded.some((r) => r.reason.includes("more than one"))).toBe(true);
  });
  it.each(["saffire", "flex"] as const)("blocks duplicate observation IDs in %s", (template) => {
    const result = compareWorkbench(rows, spec(template));
    const duplicate = rows.find((r) => r.id === result.used[0].id)!;
    expect(compareWorkbench([...rows, duplicate], spec(template)).status).toBe("blocked");
  });
});
describe("research schema v2 and published finding parity", () => {
  it("reproduces every committed finding unchanged", () => { expect(computeFindings(RESEARCH_ATLAS)).toEqual(committed); });
  it("preserves unknown numeric gravity, uncertainty and sessions and links paired endpoints", () => {
    const v2 = researchAtlas(RESEARCH_ATLAS, TABLES);
    expect(v2.rows).toHaveLength(rows.length);
    expect(v2.rows.every((r) => r.gravity.g === null && r.sessionId === null)).toBe(true);
    expect(v2.rows.find((r) => r.observationId === "PSI-99-0:r2")!.relationships[0].kind).toBe("paired-ground-orbit-endpoints");
    expect(v2.rows.find((r) => r.observationId === "PSI-25-0:r28")!.stableSourceKey).toBe("PSI-25-0:label:M1");
  });
  it("does not advertise duplicate source labels as stable identities", () => {
    const table = structuredClone(TABLES["PSI-25-0"]); table.rows.find((r) => r.sourceRow === 29)!.cells[1] = "M1";
    const v2 = researchAtlas(RESEARCH_ATLAS, { ...TABLES, "PSI-25-0": table });
    expect(v2.rows.find((r) => r.observationId === "PSI-25-0:r28")!.stableSourceKey).toBeNull();
    expect(v2.rows.find((r) => r.observationId === "PSI-25-0:r29")!.stableSourceKey).toBeNull();
  });
  it.each(["range", "list", "trajectory"] as const)("roundtrips %s semantics without collapsing values", (shape) => {
    const q = JSON.parse(JSON.stringify(quantitySemantics({ col: "x", raw: "21 22", v: null, values: [21, 22], shape, unit: "%" })));
    expect(q.kind).toBe(shape); expect(q.value).toBeNull(); expect(q.values).toEqual([21, 22]);
  });
  it("preserves bounds separately from exact values and marks their source-unit basis", () => {
    expect(quantitySemantics({ col: "CO", raw: ">500", v: null, unit: "ppm", status: "bound" })).toMatchObject({ kind: "lower-bound", value: null, rawBound: 500 });
    expect(quantitySemantics(undefined)).toMatchObject({ kind: "unknown", value: null });
  });
});
describe("M2 benchmark and offline reproduction", () => {
  it("runs 30 development and 30 evaluation cases, without claiming live-AI evaluation", () => {
    const report = runBenchmark(); expect(report.passed).toBe(60); expect(BENCHMARK_CASES.filter((c) => c.split === "evaluation")).toHaveLength(30);
    expect(report.liveAI).toBe("not run"); expect(report.results.every((r) => r.source && r.question && r.latencyMs >= 0)).toBe(true);
  });
  it.each([null, "saffire", "flex", "smoke"] as const)("independently executes the %s package, including all eight findings", async (template) => {
    const dir = await mkdtemp(join(tmpdir(), "ember-m2-test-"));
    try {
      const files = await researchPackage(engine, template ? spec(template) : null);
      await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(dir, name), data)));
      expect(execFileSync(process.execPath, [join(dir, "reproduce.mjs")], { cwd: dir, encoding: "utf8", timeout: 30000 })).toContain("PASS:");
      const result = JSON.parse(await readFile(join(dir, "reproduced-results.json"), "utf8"));
      expect(result.findings).toEqual(committed);
      const metadata = JSON.parse(files["source-manifest.json"]);
      expect(metadata.psi.records.find((r: { accession: string }) => r.accession === "PSI-10").license).toBeNull();
      expect(metadata.workbook.sheet).toBe("Reduced data sheet"); expect(metadata.workbook.values).toContain("not recalculated");
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30000);
  it("blocks invalid or mismatched-snapshot exports", async () => {
    await expect(researchPackage(engine, { ...spec(), snapshot: "wrong" })).rejects.toThrow("snapshot mismatch");
    await expect(researchPackage(engine, { ...spec(), material: "imaginary" })).rejects.toThrow("No eligible");
  });
});
