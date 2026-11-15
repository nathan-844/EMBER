import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import engineCode from "virtual:analysis-engine";
import { analyze, sensitivity, validateSpec, type AnalysisSpec, type Observation } from "./engine";
import { DEFAULT_SPEC, OBSERVATIONS, RAW_TABLE, makeObservations, scalar } from "./bass";
import { REFERENCES } from "./review";
import { packageFiles, sha256, zipFiles } from "./export";
import { readSharedSpec } from "../../pages/Compare";

const run = (patch: Partial<AnalysisSpec> = {}, rows = OBSERVATIONS) => analyze(rows, { ...DEFAULT_SPEC, ...patch });
const fake = (id: string, group: Observation["group"], delta: number, oxygen = 20): Observation => ({ ...OBSERVATIONS[0], id, group, coStart: 0, coEnd: delta, o2Start: oxygen, o2End: oxygen });

describe("BASS-II source reconciliation", () => {
  it("cross-checks all 188 gas cells against a separately transcribed NASA report reference", () => {
    expect(OBSERVATIONS).toHaveLength(47);
    expect(Object.keys(REFERENCES)).toHaveLength(47);
    expect(OBSERVATIONS.every((r) => r.review.matched)).toBe(true);
    expect(OBSERVATIONS.filter((r) => r.review.status === "unresolved").map((r) => r.test)).toEqual(["T23"]);
  });
  it("detects a changed source cell and withholds it from reconciled mode", () => {
    const raw = structuredClone(RAW_TABLE);
    raw.rows.find((r) => r.cells[1] === "M18")!.cells[16] = "999";
    const rows = makeObservations(raw);
    expect(rows.find((r) => r.test === "M18")!.review.matched).toBe(false);
    expect(run({}, rows).excluded.some((r) => r.id === "PSI-25-0:r45" && r.reasons.includes("Source review is unmatched or unresolved"))).toBe(true);
    expect(RAW_TABLE.rows.find((r) => r.cells[1] === "M18")!.cells[16]).toBe("335");
  });
  it("never turns bounds, ranges, lists or missing cells into exact measurements", () => {
    for (const s of ["", " ", "none", ">500", "OR", "over", "1–2", "1 2", "NaN", "Infinity", "9".repeat(400)]) expect(scalar(s)).toBeNull();
    expect(scalar("-1")).toBe(-1);
    expect(scalar(" 0.3 ")).toBe(.3);
    const m5 = OBSERVATIONS.find((r) => r.test === "M5")!;
    expect(m5.coEnd).toBeNull(); expect(m5.censored).toBe(true);
    expect(run().excluded.find((r) => r.id === m5.id)!.reasons).toContain("CO is censored; never substituted with its bound");
  });
  it("preserves repeated source anomalies instead of treating agreement as a correction", () => {
    for (const test of ["T28a", "T28b"]) {
      const row = OBSERVATIONS.find((r) => r.test === test)!;
      expect(row.review.matched).toBe(true);
      expect(run().excluded.find((r) => r.id === row.id)!.reasons).toContain("Implausible final oxygen; gas readings not trusted");
    }
  });
});
describe("comparison and sensitivity", () => {
  it("reproduces the raw F4 material medians with exactly the intended denominator", () => {
    const r = run({ sourceMode: "raw" });
    expect([r.a.n, r.a.median, r.b.n, r.b.median, r.difference]).toEqual([19, 335, 25, 20, 315]);
    expect(r.censored).toBe(1); expect(r.excluded).toHaveLength(3);
  });
  it("matches hand-calculated medians and keeps every candidate in exactly one ledger", () => {
    const rows = [fake("a1", "PMMA slab", 1), fake("a2", "PMMA slab", 9), fake("a3", "PMMA slab", 5), fake("b1", "SIBAL fabric", 0), fake("b2", "SIBAL fabric", 2)];
    const r = run({}, rows);
    expect([r.a.median, r.b.median, r.difference]).toEqual([5, 1, 4]);
    for (const { result } of sensitivity(OBSERVATIONS, DEFAULT_SPEC)) {
      const ids = [...result.used, ...result.excluded].map((r) => r.id);
      expect(ids).toHaveLength(47); expect(new Set(ids).size).toBe(47);
    }
  });
  it("shows the actual policy effects, including loss of sample support", () => {
    expect(sensitivity(OBSERVATIONS, DEFAULT_SPEC).map(({ result: r }) => [r.a.n, r.b.n, r.difference])).toEqual([[19, 25, 315], [19, 24, 314], [18, 20, 302], [12, 11, 319.5]]);
    expect(run().independentGroups).toBeNull();
    expect(run({ a: "SIBAL fabric", b: "PMMA slab" }).difference).toBe(-314);
  });
  it("is deterministic and does not mutate inputs; bootstrap includes every replicate", () => {
    const before = JSON.stringify(OBSERVATIONS), first = run();
    expect(run()).toEqual(first); expect(JSON.stringify(OBSERVATIONS)).toBe(before);
    expect(first.interval).toEqual([198.9875, 409]); expect(first.successfulReplicates).toBe(2000);
  });
  it("blocks identical cohorts, malformed policies, invalid ranges and empty subsets", () => {
    for (const patch of [{ a: "SIBAL fabric" }, { oxygen: [22, 18] }, { oxygen: [NaN, 22] }, { seed: -1 }, { replicates: 10001 }, { sourceMode: "invented" }, { oxygen: [80, 90] }]) {
      const r = run(patch as Partial<AnalysisSpec>); expect(r.status).toBe("blocked"); expect(r.interval).toBeNull(); expect(r.difference).toBeNull();
    }
    expect(validateSpec(null as unknown as AnalysisSpec).length).toBeGreaterThan(0);
  });
  it("withholds intervals for nonoverlap or degenerate data, keeping descriptive results", () => {
    const a = [fake("a1", "PMMA slab", 10, 18), fake("a2", "PMMA slab", 20, 18)];
    const b = [fake("b1", "SIBAL fabric", 1, 22), fake("b2", "SIBAL fabric", 2, 22)];
    const r = run({}, [...a, ...b]); expect(r.status).toBe("descriptive-only"); expect(r.interval).toBeNull(); expect(r.difference).toBe(13.5);
    const degenerate = run({}, [...a, fake("b1", "SIBAL fabric", 1, 18)]);
    expect(degenerate.status).toBe("descriptive-only"); expect(degenerate.interval).toBeNull();
  });
  it("roundtrips shared filters and rejects a stale snapshot or malformed link", () => {
    const spec = { ...DEFAULT_SPEC, oxygen: [18, 21] as [number, number], excludeQuestionable: true };
    const hash = (s: unknown) => "#compare?" + new URLSearchParams({ spec: JSON.stringify(s) });
    expect(readSharedSpec(hash(spec))).toEqual({ spec, error: "" });
    expect(readSharedSpec(hash({ ...spec, dataset: "old" })).error).toContain("different dataset");
    expect(readSharedSpec("#compare?spec=bad").error).toContain("could not be loaded");
  });
});
describe("standalone reproduction package", () => {
  it("reconstructs raw cells and reproduces full results with Node in an isolated directory, then detects corruption", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-m1-test-"));
    try {
      const spec = { ...DEFAULT_SPEC, oxygen: [18, 21] as [number, number], excludeQuestionable: true };
      const files = await packageFiles(spec, engineCode, [DEFAULT_SPEC, spec]);
      await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(directory, name), content)));
      const output = execFileSync(process.execPath, [join(directory, "reproduce.mjs")], { cwd: directory, encoding: "utf8", timeout: 20000 });
      expect(output).toContain("PASS:");
      expect(JSON.parse(await readFile(join(directory, "reproduced-results.json"), "utf8"))).toEqual(JSON.parse(files["expected-results.json"]));
      await writeFile(join(directory, "observations.json"), "[]");
      expect(() => execFileSync(process.execPath, [join(directory, "reproduce.mjs")], { cwd: directory, stdio: "pipe", timeout: 20000 })).toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("pins every payload hash, keeps raw bounds and makes deterministic ZIP bytes", async () => {
    const files = await packageFiles(DEFAULT_SPEC, engineCode);
    const checks = JSON.parse(files["checksums.json"]);
    for (const [name, hash] of Object.entries(checks)) expect(await sha256(files[name])).toBe(hash);
    expect(files["excluded.csv"]).toContain(">500");
    expect(files["LICENSE.txt"]).toContain("MIT");
    expect(zipFiles(files)).toEqual(zipFiles(files));
    expect(new DataView(zipFiles(files).buffer).getUint32(0, true)).toBe(0x04034b50);
    await expect(packageFiles({ ...DEFAULT_SPEC, a: DEFAULT_SPEC.b }, engineCode)).rejects.toThrow("different");
    await expect(packageFiles({ ...DEFAULT_SPEC, dataset: "old" }, engineCode)).rejects.toThrow("different dataset");
  });
});
