import { describe, expect, it } from "vitest";
import manifest from "../data/table-manifest.json";
import { TABLES } from "../data/tables";
import { buildAtlas } from "./atlas/build";
import { compactAtlas, type CompactRow } from "./atlas/compact";
import { nearbyTests, scaledDistance } from "./coverage";
import { presetScenario } from "./scenario";

const rows = compactAtlas(buildAtlas(TABLES, manifest));
const row = (o2: number | null, psi: number | null, fuel: CompactRow["fuel"] = "solid"): CompactRow =>
  ({ id: "x", source: "", url: "", investigation: "t", kind: "test", fuel, material: "", o2, psi, flowCms: null, outcome: "burned", flags: [], cells: [] });

describe("scaledDistance", () => {
  it("is 1 at the edge of the window and 0 on the scenario", () => {
    const s = { oxygenPct: 30, pressurePsi: 10.2 };
    expect(scaledDistance(row(30, 10.2), s)).toBe(0);
    expect(scaledDistance(row(35, 10.2), s)).toBe(1);
    expect(scaledDistance(row(30, 12.7), s)).toBeCloseTo(1, 10);
    expect(scaledDistance(row(33, 12.2), s)).toBeCloseTo(Math.hypot(0.6, 0.8), 10);
  });
  it("is null when a needed value is missing, and uses oxygen alone when the scenario has no pressure", () => {
    expect(scaledDistance(row(30, null), { oxygenPct: 30, pressurePsi: 10.2 })).toBeNull();
    expect(scaledDistance(row(null, 10), { oxygenPct: 30, pressurePsi: 10.2 })).toBeNull();
    expect(scaledDistance(row(32.5, null), { oxygenPct: 30, pressurePsi: null })).toBe(0.5);
  });
});

describe("nearbyTests", () => {
  it("separates joint matches from oxygen-only matches", () => {
    const n = nearbyTests([row(31, 9), row(31, null), row(31, 14.7), row(40, 10), row(29, 10, "gas")], { oxygenPct: 30, pressurePsi: 10.2 })!;
    const solid = n.groups.find((g) => g.fuel === "solid")!;
    expect(solid.joint).toHaveLength(1);
    expect(solid.oxygenOnly).toHaveLength(1);
    expect(n.groups.find((g) => g.fuel === "gas")!.joint).toHaveLength(1);
    expect(n.totalJoint).toBe(2);
  });

  it("returns null without an oxygen level", () => {
    expect(nearbyTests(rows, { oxygenPct: null, pressurePsi: 10 })).toBeNull();
  });

  it("lunar habitat: the only solid tests near 30% O₂ and 10.2 psi are the Saffire IV–VI paper samples", () => {
    const n = nearbyTests(rows, presetScenario("lunar-habitat"))!;
    const solid = n.groups.find((g) => g.fuel === "solid")!;
    expect(solid.joint.length).toBeGreaterThan(0);
    for (const r of solid.joint) expect(r.id).toMatch(/^NTRS-/);
    expect(solid.nearest!.row.id).toMatch(/^NTRS-/);
    // FLEX droplets at 30–34% O₂ and about 10.4 psia are joint matches for liquids.
    expect(n.groups.find((g) => g.fuel === "liquid")!.joint.some((r) => r.investigation === "flex")).toBe(true);
  });

  it("ISS: no PSI solid test records pressure, so solids are oxygen-only matches there", () => {
    const solid = nearbyTests(rows, presetScenario("iss"))!.groups.find((g) => g.fuel === "solid")!;
    expect(solid.oxygenOnly.length).toBeGreaterThan(100);
    for (const r of solid.joint) expect(r.id).toMatch(/^NTRS-/);
  });
});

describe("rows that record a range, not one value", () => {
  const span = (lo: number, hi: number): CompactRow => ({ ...row(null, 10.2), o2Span: [lo, hi] });

  it("places a range by its farthest end, so it is near only when the whole range is", () => {
    const s = { oxygenPct: 25, pressurePsi: 10.2 };
    expect(scaledDistance(span(21.5, 21.7), s)).toBeCloseTo(0.7, 10); // 25 − 21.5 = 3.5 of a 5-point window
    const whole = nearbyTests([span(21.5, 21.7)], s)!.groups.find((g) => g.fuel === "solid")!;
    expect(whole.joint).toHaveLength(1);
    // The top of this range is inside the window but its bottom is not: not a match.
    const partial = nearbyTests([span(19.5, 21.7)], s)!.groups.find((g) => g.fuel === "solid")!;
    expect(partial.joint).toHaveLength(0);
    expect(partial.placed).toBe(1);
  });

  it("never reduces a real range to one number in the browser copy", () => {
    const ranged = rows.filter((r) => r.kind === "test" && r.o2Span);
    expect(ranged.map((r) => [r.id, r.o2, r.o2Span])).toEqual([
      ["PSI-98-0:r2", null, [21.5, 21.7]],
      ["PSI-99-0:r9", null, [22, 22.1]],
      ["PSI-99-0:r10", null, [21.9, 22]],
    ]);
  });

  it("matches on unrounded values: a test just outside the window stays outside", () => {
    const s = { oxygenPct: 30, pressurePsi: 10.2 };
    const g = nearbyTests([row(35.004, 10.2), row(34.996, 10.2)], s)!.groups.find((x) => x.fuel === "solid")!;
    expect(g.joint.map((r) => r.o2)).toEqual([34.996]);
    // Stored values keep the precision of the conversion, not a display rounding.
    expect(rows.some((r) => r.psi !== null && String(r.psi).split(".")[1]?.length > 2)).toBe(true);
  });
});
