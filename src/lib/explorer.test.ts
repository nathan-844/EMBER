import { describe, expect, it } from "vitest";
import { INVESTIGATIONS } from "../data/investigations";
import { buildRowsCsv, summarizeTable, tablesFor, unitOf } from "./explorer";

const inv = (id: string) => INVESTIGATIONS.find((i) => i.id === id)!;
const summary = (id: string, n = 0) => summarizeTable(tablesFor(inv(id))[n]);

describe("run tables", () => {
  it("every investigation profile has at least one stored NASA table", () => {
    for (const i of INVESTIGATIONS) expect(tablesFor(i).length, i.id).toBeGreaterThan(0);
  });

  it("reads units from NASA headers", () => {
    expect(unitOf("Air Flow (cm/s)")).toBe("cm/s");
    expect(unitOf("Ambient pressure; mmHg")).toBe("mmHg");
    expect(unitOf("Material")).toBeNull();
    expect(unitOf("Percent O2 (Note 1)")).toBeNull();
    expect(unitOf("Radiometer gain (1000 250 50 10)")).toBeNull();
  });
});

describe("what varied and what stayed fixed", () => {
  it("Saffire-I held thickness, sample size, air flow and igniter fixed and varied flow direction", () => {
    const s = summary("saffire-i");
    const fixed = s.fixed.map((c) => c.header);
    expect(fixed).toEqual(expect.arrayContaining(["Sample Thickness (cm)", "Air Flow (cm/s)", "Ignition Power (W)"]));
    expect(s.varied.map((c) => c.header)).toContain("Flow Direction");
  });

  it("Saffire-II exposes microgravity and 1 g results as result columns", () => {
    const results = summary("saffire-ii").varied.filter((c) => c.role === "result").map((c) => c.header);
    expect(results).toEqual(expect.arrayContaining(["1-g Spread Rate", "µ-g (written ?-g in the NASA file) Burn Length"]));
  });

  it("drops physically impossible condition values, as the ranked ranges do", () => {
    const o2 = summary("acme-bre").varied.find((c) => c.role === "condition")!;
    expect(o2.numeric).toEqual({ min: 21, max: 40 });
    expect(o2.dropped).toEqual(["3400%", "2100%"]);
  });

  it("treats a list of levels repeated in every row as a test matrix, not a fixed value", () => {
    const o2 = summary("flex-2").varied.find((c) => c.header === "Oxygen Mole Fraction")!;
    expect(o2.sameListEveryRow).toBe(true);
  });

  it("keeps run ids and dates out of the varied list", () => {
    const s = summary("bass-ii");
    expect(s.bookkeeping).toEqual(expect.arrayContaining(["Date", "Test #"]));
    expect(s.varied.map((c) => c.header)).not.toContain("Date");
  });

  it("treats FLEX's lone dashes as 'no measurement' rather than as a value", () => {
    const s = summary("flex");
    expect(s.noValueCells).toBe(34);
    expect(s.varied.find((c) => c.header === "Visible flame extinction diameter; mm")!.examples).not.toContain("–");
  });
});

describe("full-row CSV", () => {
  const csv = buildRowsCsv([inv("saffire-ii")]);
  const lines = csv.trim().split("\n");

  it("has one line per filled cell with the source table and row", () => {
    expect(lines[0]).toMatch(/^investigation,psi_accession,psi_table,table_sha256,source_row,column/);
    expect(lines.length).toBeGreaterThan(100);
    expect(lines.every((l, i) => i === 0 || l.startsWith("Saffire-II,PSI-99,PSI-99-0,"))).toBe(true);
  });

  it("converts ranked condition columns into the app's unit", () => {
    expect(lines.some((l) => /,Air Flow \(cm\/s\),condition,cm\/s,20 cm\/s,20,airflowMs,0\.2,m\/s$/.test(l))).toBe(true);
  });

  it("keeps the cell exactly as NASA wrote it", () => {
    expect(csv).toContain("Cotton-Fiberglass (SIBAL)");
    expect(csv).not.toContain("�");
  });
});

describe("gap map points", async () => {
  const { gapPoints, nearestSolid } = await import("./explorer");
  const g = gapPoints(INVESTIGATIONS);

  it("draws BASS-II from its run table, with cabin pressure marked as assumed", () => {
    const b = g.points.filter((p) => p.id === "bass-ii");
    expect(b.length).toBeGreaterThan(10);
    expect(b.every((p) => p.pressureAssumed && p.fuel === "solid")).toBe(true);
  });

  it("has no solid-material point above 22.2% oxygen", () => {
    const solidMax = Math.max(...g.points.filter((p) => p.fuel === "solid").map((p) => p.oxygenPct));
    expect(solidMax).toBe(22.2);
    expect(nearestSolid(g.points, 30)?.name).toBe("BASS-II");
  });

  it("pairs oxygen and pressure from the same row and skips rows whose pairing is unknown", () => {
    const cfig = g.points.filter((p) => p.id === "acme-cfi-g");
    expect(cfig.length).toBeGreaterThan(50);
    expect(cfig.every((p) => p.pressurePsi != null && !p.pressureAssumed)).toBe(true);
    expect(g.ambiguousRows).toBe(8); // FLEX-2 lists several O2 and pressure levels per row
    expect(g.points.some((p) => p.id === "flex-2")).toBe(false);
  });

  it("names profiles whose oxygen is only a written approximation", () => {
    expect(g.curatedOnly).toContain("Saffire-III");
  });
});
