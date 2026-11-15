import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import engine from "virtual:mission-engine";
import { DEFAULT_MISSION, assessRow, missionReport, pareto, planCoverage, thicknessFor, validateMission, type MissionSpec } from "./mission";
import { RESEARCH_ATLAS } from "./research-data";
import { missionPackage } from "./mission-export";
import { missionLink } from "./mission-link";
import { DEFAULT_SCENARIO } from "../scenario";
import type { Quantity } from "../atlas/types";

const rows = RESEARCH_ATLAS.rows;
const spec = (): MissionSpec => structuredClone(DEFAULT_MISSION);
const source = () => structuredClone(rows.find(r => r.id === "NTRS-20240002981:VI-4")!);
const q = (v: number | null): Quantity => ({ v, col: "synthetic test fixture", raw: String(v), unit: "%" });
function assess(r = source(), s = spec()) { return assessRow(r, s.inventory[0], s.a, s.endpoint, s.windows); }
describe("M3 applicability gates and source recovery", () => {
  it("recovers the explicit 0.5 and 1 cm labels as 5 and 10 mm without mutating the Atlas", () => {
    expect(source().material.thicknessMm).toBeUndefined();
    expect(thicknessFor(source())).toMatchObject({ v: 5, unit: "mm", raw: "One-sided PMMA (0.5 cm thick)", col: "Table 1: Material" });
    expect(thicknessFor(rows.find(r => r.id === "NTRS-20240002981:VI-3")!)?.v).toBe(10);
    expect(assess().tier).toBe("documented");
  });
  it("uses per-row geometry measurements with their original cells and units", () => {
    const r = source(); r.measures.thicknessCm = { ...q(0.2), unit: "cm" };
    expect(thicknessFor(r)).toMatchObject({ v: 2, raw: "0.2", unit: "mm", status: "converted" });
    r.measures.thicknessCm = { ...q(null), unit: "cm", values: [0.1, 0.3], shape: "range" };
    expect(thicknessFor(r)?.values).toEqual([1, 3]);
  });
  it.each(["material", "form", "thickness", "direction", "gravity", "endpoint"])("makes %s affect eligibility", field => {
    const s = spec();
    if (field === "material") s.inventory[0].material = "Unmatched insulation";
    if (field === "form") s.inventory[0].form = "film";
    if (field === "thickness") s.inventory[0].thicknessMm = 10;
    if (field === "direction") s.inventory[0].flowDirection = "opposed";
    if (field === "gravity") s.a.gravity = "partial";
    if (field === "endpoint") s.endpoint = "spread-rate";
    const r = assess(source(), s); expect(r.tier).not.toBe("documented"); expect(r.reasons.length).toBeGreaterThan(0);
    if (field === "gravity" || field === "form") expect(r.tier).toBe("analogue");
  });
  it("distinguishes inferred material and missing pressure from a documented match", () => {
    const r = source(); r.material.basis = "inferred"; expect(assess(r).tier).toBe("analogue");
    r.material.basis = "stated"; delete r.pressurePsi;
    expect(assess(r)).toMatchObject({ tier: "partial", missing: ["pressurePsi"], distances: { pressurePsi: null } });
  });
  it("does not borrow a composite sample's result for one constituent", () => {
    const r = source(); r.material.name = "PMMA + Nomex (one composite sample)";
    expect(assess(r).tier).toBe("excluded");
  });
  it.each(["session", "matrix", "supplement", "aside"] as const)("does not count %s rows as test observations", kind => {
    const r = source(); r.rowKind = kind; expect(assess(r).tier).toBe("excluded");
  });
  it.each(["range", "list", "trajectory"] as const)("requires all %s values to fit, not just a midpoint", shape => {
    const r = source(); r.o2Pct = { ...q(null), values: [27, 32], shape };
    expect(assess(r).tier).toBe("outside");
    r.o2Pct.values = [28, 29]; expect(assess(r).tier).toBe("documented");
  });
  it("checks the final oxygen cell and preserves bounds/missing conditions", () => {
    const r = source(); r.o2PctEnd = q(10); expect(assess(r).tier).toBe("outside");
    r.o2PctEnd = { ...q(null), status: "bound" }; expect(assess(r).tier).toBe("partial");
  });
  it("does not treat equal oxygen partial pressure as equal atmospheres", () => {
    const s = spec(); s.a.oxygenPct /= 2; s.a.pressurePsi *= 2;
    expect(assess(source(), s).tier).toBe("outside");
  });
  it("requires gas composition when a diluent is selected", () => {
    const s = spec(); s.a.diluent = "nitrogen"; const r = source();
    expect(assess(r, s).missing).toContain("diluent composition");
    r.diluent = { n2: q(0.7), he: q(0), co2: q(0) }; expect(assess(r, s).tier).toBe("documented");
    r.diluent.co2 = q(0.1); expect(assess(r, s).tier).toBe("outside");
  });
  it("never silently fills pressure or numeric gravity from profile envelopes", () => {
    const actual = missionReport(rows, spec());
    expect(actual.inventory[0].a.filter(r => r.tier === "documented").map(r => r.id)).toEqual(["NTRS-20240002981:VI-4"]);
    expect(actual.inventory[0].countsB.documented).toBe(0);
    expect(actual.inventory[0].sensitivity.map(s => s.a.documented)).toEqual([1, 1, 1]);
  });
  it("widening windows retains previously eligible observations", () => {
    const s = spec(); const narrow = rows.filter(r => assess(r, s).tier === "documented").map(r => r.id);
    s.windows = { oxygenPct: 20, pressurePsi: 10, flowCms: 100, thicknessMm: 100 };
    const wide = new Set(rows.filter(r => assess(r, s).tier === "documented").map(r => r.id));
    expect(narrow.every(id => wide.has(id))).toBe(true);
  });
  it("preserves non-dominated tradeoffs and ties, excluding missing-condition rows", () => {
    const base = assess(); const make = (id: string, x: number, y: number) => ({ ...base, id, distances: { oxygenPct: x, pressurePsi: y, flowCms: 0, thicknessMm: 0 } });
    const a = make("a", 0.1, 0.8), b = make("b", 0.8, 0.1), dominated = make("c", 0.9, 0.9);
    expect(pareto([a, b, dominated, { ...a, id: "tie" }, { ...a, id: "missing", tier: "partial" }], true)).toEqual(["a", "b", "tie"]);
  });
});
function plannerSpec() {
  const s = spec(); s.a = { ...s.a, oxygenPct: 20 }; s.windows.oxygenPct = 1;
  s.targets = [20, 21, 30].map((oxygenPct, i) => ({ id: `t${i}`, itemId: "panel", atmosphere: { ...s.a, oxygenPct } }));
  s.candidates = [
    { id: "a", itemId: "panel", atmosphere: { ...s.a, oxygenPct: 20.5 }, cost: 1, feasibility: "assumed-feasible" },
    { id: "b", itemId: "panel", atmosphere: { ...s.a, oxygenPct: 30 }, cost: 2, feasibility: "unknown" },
  ];
  s.budget = 3; return s;
}
describe("M3 greedy coverage planner", () => {
  it("selects marginal gain per cost and accounts for every target and budget unit", () => {
    const p = planCoverage([], plannerSpec());
    expect(p.steps.map(s => [s.candidate.id, s.gained, s.cumulativeCost])).toEqual([["a", ["t0", "t1"], 1], ["b", ["t2"], 3]]);
    expect(p.remaining).toEqual([]); expect(p.resultsObserved).toBe(false);
    expect(new Set(p.steps.flatMap(s => s.gained)).size).toBe(3);
  });
  it("does not credit partial observations as existing coverage", () => {
    const s = plannerSpec(), r = source(); r.o2Pct = q(20); delete r.pressurePsi;
    expect(planCoverage([r], s).existing).toEqual([]);
    r.pressurePsi = source().pressurePsi; expect(planCoverage([r], s).existing).toEqual(["t0", "t1"]);
  });
  it("honors budget, impossible candidates and optional unknown feasibility", () => {
    const s = plannerSpec(); s.budget = 0; expect(planCoverage([], s).steps).toHaveLength(0);
    s.budget = 3; s.allowUnknownFeasibility = false; expect(planCoverage([], s).remaining).toEqual(["t2"]);
    s.candidates[0].feasibility = "infeasible"; expect(planCoverage([], s).steps).toHaveLength(0);
  });
  it("does not bridge inventory items, gravity or diluent, and breaks ties by ID", () => {
    const s = plannerSpec(); s.candidates.push({ ...s.candidates[0], id: "0" });
    expect(planCoverage([], s).steps[0].candidate.id).toBe("0");
    s.candidates = [{ ...s.candidates[0], atmosphere: { ...s.a, gravity: "earth" } }]; expect(planCoverage([], s).steps).toHaveLength(0);
    s.candidates[0] = { ...s.candidates[0], atmosphere: { ...s.a, diluent: "helium" } }; expect(planCoverage([], s).steps).toHaveLength(0);
    s.candidates[0] = { ...s.candidates[0], atmosphere: s.a, itemId: "other" }; expect(planCoverage([], s).steps).toHaveLength(0);
  });
  it("rejects malformed specs, impossible numeric bounds, zero windows and oversized grids", () => {
    expect(validateMission(null as unknown as MissionSpec).length).toBeGreaterThan(0);
    const s = spec(); s.a.oxygenPct = NaN; s.windows.flowCms = 0; s.b.pressurePsi = -1;
    expect(validateMission(s).length).toBeGreaterThan(1); expect(() => missionReport(rows, s)).toThrow();
    const many = plannerSpec(); many.candidates = Array.from({ length: 97 }, (_, i) => ({ ...many.candidates[0], id: String(i) })); expect(validateMission(many).join(" ")).toContain("96");
    const bad = plannerSpec(); bad.candidates[0].cost = 0; expect(validateMission(bad).join(" ")).toContain("positive costs");
  });
  it("counts any test of the material when no particular result is required", () => {
    // A stated PMMA slab row that records oxygen but no burning outcome.
    const row = rows.find(r => r.rowKind === "test" && r.material.name === "PMMA" && r.material.form === "slab" && r.material.basis === "stated" && r.outcome.value === "not-recorded" && r.o2Pct?.v != null)!;
    const item = { ...spec().inventory[0], thicknessMm: null, flowDirection: "unspecified" as const };
    const air = { ...spec().a, oxygenPct: row.o2Pct!.v! };
    expect(assessRow(row, item, air, "burning-outcome", spec().windows).tier).toBe("excluded");
    const any = assessRow(row, item, air, "any-test", spec().windows);
    expect(any.tier).not.toBe("excluded");
    expect(any.distances.oxygenPct).not.toBeNull();
    expect(validateMission({ ...spec(), endpoint: "any-test" })).toEqual([]);
    // The stricter rule never admits a test the looser one leaves out.
    const strict = missionReport(rows, spec()).inventory[0].a, loose = missionReport(rows, { ...spec(), endpoint: "any-test" }).inventory[0].a;
    strict.forEach((a, n) => { if (a.tier !== "excluded") expect(loose[n].tier).toBe(a.tier); });
    expect(loose.filter(a => a.tier !== "excluded").length).toBeGreaterThan(strict.filter(a => a.tier !== "excluded").length);
  });
  it("transfers complete scenario conditions to B with cm/s conversion", () => {
    const s = { ...DEFAULT_SCENARIO, oxygenPct: 30, pressurePsi: 8.2, airflowMs: 0.2, gravityG: 0.166, material: "PMMA", thicknessMm: 3 };
    const restored = JSON.parse(new URLSearchParams(missionLink(s).split("?")[1]).get("spec")!);
    expect(restored.b).toMatchObject({ oxygenPct: 30, pressurePsi: 8.2, flowCms: 20, gravity: "partial" });
    expect(restored.inventory[0]).toMatchObject({ material: "PMMA", thicknessMm: 3, form: "unspecified" });
    expect(restored.endpoint).toBe("any-test");
    expect(missionLink({ ...s, oxygenPct: null })).toBe("#mission");
  });
  it("rebuilds and reproduces the complete exported analysis in a separate Node process", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ember-m3-test-"));
    try {
      const files = await missionPackage(engine, plannerSpec());
      await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(dir, name), data)));
      expect(execFileSync(process.execPath, [join(dir, "reproduce.mjs")], { encoding: "utf8", timeout: 30000 })).toContain("PASS:");
      await writeFile(join(dir, "mission.json"), "{}");
      expect(() => execFileSync(process.execPath, [join(dir, "reproduce.mjs")], { stdio: "pipe", timeout: 30000 })).toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30000);
});
