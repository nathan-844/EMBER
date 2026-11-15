import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../data/table-manifest.json";
import { TABLES } from "../../data/tables";
import { SAFFIRE_NTRS_RUNS } from "../../data/ntrs-saffire";
import { atlasCsv, buildAtlas } from "./build";
import { normaliseMaterial } from "./materials";
import { FLAG_TEXT, SPECS } from "./specs";
import type { Atlas, AtlasRow, Quantity, TextValue } from "./types";

const atlas = buildAtlas(TABLES, manifest);
const byId = new Map(atlas.rows.map((r) => [r.id, r]));
const row = (id: string): AtlasRow => {
  const r = byId.get(id);
  if (!r) throw new Error(`no atlas row ${id}`);
  return r;
};
const values = (r: AtlasRow): (Quantity | TextValue)[] =>
  [r.o2Pct, r.o2PctEnd, r.burnerO2Pct, r.pressurePsi, r.flowCms, r.flowDirection, r.diluent?.n2, r.diluent?.co2, r.diluent?.he, ...Object.values(r.measures)].filter(
    (q): q is Quantity | TextValue => !!q,
  );
const norm = (h: string) => h.replace(/\s+/g, " ").trim();

describe("atlas coverage", () => {
  it("has one record per stored NASA row, plus each NTRS Saffire run", () => {
    for (const t of manifest.tables) {
      expect(atlas.rows.filter((r) => r.source.kind === "psi" && r.source.table === t.id), t.id).toHaveLength(t.rows);
    }
    expect(atlas.rows.filter((r) => r.source.kind === "ntrs")).toHaveLength(SAFFIRE_NTRS_RUNS.length);
    expect(atlas.counts.rows).toBe(manifest.tables.reduce((n, t) => n + t.rows, 0) + SAFFIRE_NTRS_RUNS.length);
  });

  it("gives every record a unique id and every table a spec", () => {
    expect(new Set(atlas.rows.map((r) => r.id)).size).toBe(atlas.rows.length);
    for (const t of manifest.tables) expect(SPECS[t.id], t.id).toBeDefined();
  });

  it("matches the committed atlas files (run npm run data:atlas after changing the rules)", () => {
    const committed = JSON.parse(readFileSync("src/data/atlas/atlas.json", "utf8")) as Atlas;
    expect(committed).toEqual(JSON.parse(JSON.stringify(atlas)));
    // Git may check text files out with CRLF line endings on Windows.
    expect(readFileSync("src/data/atlas/atlas.csv", "utf8").replace(/\r\n/g, "\n")).toBe(atlasCsv(atlas));
  });
});

describe("lineage", () => {
  it("keeps the exact NASA cell behind every value", () => {
    for (const r of atlas.rows) {
      if (r.source.kind !== "psi") continue;
      const t = TABLES[r.source.table];
      const cells = t.rows.find((x) => x.sourceRow === (r.source as { sourceRow: number }).sourceRow)!.cells;
      const cellOf = (col: string) => cells[t.header.findIndex((h) => norm(h) === norm(col))];
      for (const q of values(r)) expect(q.raw, `${r.id} ${q.col}`).toBe(cellOf(q.col));
      if ("col" in r.material && !r.material.col.startsWith("(fixed")) expect(r.material.raw).toBe(cellOf(r.material.col));
      if (r.outcome.cell) expect(r.outcome.cell.raw).toBe(cellOf(r.outcome.cell.col));
    }
  });

  it("explains every flag code it uses", () => {
    const used = new Set(atlas.rows.flatMap((r) => [...r.flags, ...values(r).flatMap((q) => q.flags ?? []), ...(r.material.flags ?? [])]));
    for (const f of used) expect(FLAG_TEXT[f], f).toBeTruthy();
  });

  it("only reads outcomes from tables that record one, and only on test rows", () => {
    const withOutcome = new Set(Object.entries(SPECS).filter(([, s]) => s.outcome).map(([id]) => id));
    for (const r of atlas.rows) {
      if (r.outcome.value === "not-recorded") continue;
      expect(r.rowKind, r.id).toBe("test");
      if (r.source.kind === "psi") expect(withOutcome.has(r.source.table), r.id).toBe(true);
    }
  });

  it("never keeps a number outside physical limits", () => {
    for (const r of atlas.rows) {
      for (const q of [r.o2Pct, r.o2PctEnd, r.burnerO2Pct]) if (q?.v != null) expect(q.v, r.id).toBeGreaterThan(0), expect(q.v, r.id).toBeLessThanOrEqual(100);
      if (r.pressurePsi?.v != null) expect(r.pressurePsi.v, r.id).toBeGreaterThan(0);
      if (r.flowCms?.v != null) expect(r.flowCms.v, r.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("labels every test row with a fuel class, except a blank material or a sample NASA does not name", () => {
    const missing = atlas.rows.filter((r) => r.rowKind === "test" && !r.material.name);
    for (const r of missing) expect(r.flags.includes("material-blank") || /spherical section/.test(r.material.raw), `${r.id} ${r.material.raw}`).toBe(true);
    for (const r of atlas.rows.filter((r) => r.rowKind === "test")) expect(r.fuelClass, r.id).not.toBeNull();
  });
});

// Golden rows: each expected value was read by hand from the NASA CSV (or the NTRS paper's tables).
describe("golden rows", () => {
  it("FLEX run 1: methanol droplet in air, disrupted", () => {
    const r = row("PSI-69-0:r2");
    expect(r.material.name).toBe("Methanol");
    expect(r.material.form).toBe("droplet");
    expect(r.o2Pct?.v).toBe(21);
    expect(r.pressurePsi?.v).toBeCloseTo((757.7 * 14.6959) / 760, 6);
    expect(r.outcome.value).toBe("disrupted");
    expect(r.measures.burnTimeS.v).toBe(4.3);
    expect(r.measures.extinctionDiameterMm.v).toBe(0.89);
    expect(r.o2Pct?.flags).toContain("header-subscript-lost");
  });

  it("FLEX run 114: pressure written as 0 is not used, CO₂ diluent kept", () => {
    const r = row("PSI-69-0:r115");
    expect(r.pressurePsi?.v).toBeNull();
    expect(r.pressurePsi?.flags).toContain("out-of-range");
    expect(r.diluent?.co2?.v).toBe(0.35);
    expect(r.outcome.value).toBe("extinguished");
  });

  it("Saffire-II sample 2-1: silicone, no flame spread in orbit, complete burn in 1 g", () => {
    const r = row("PSI-99-0:r2");
    expect(r.material.name).toBe("Silicone rubber");
    expect(r.measures.thicknessMm.v).toBe(0.27);
    expect(r.o2Pct?.v).toBe(21.5);
    expect(r.o2Pct?.approx).toBe(true);
    expect(r.flowCms?.v).toBe(20);
    expect(r.outcome.value).toBe("no-spread");
    expect(r.measures.burnLength1g.v).toBe("Complete");
  });

  it("Saffire-II sample 2-4: thickness \"037 mm\" is ambiguous and not used", () => {
    const r = row("PSI-99-0:r5");
    expect(r.measures.thicknessMm.v).toBeNull();
    expect(r.measures.thicknessMm.flags).toContain("leading-zero");
  });

  it("Saffire-II sample 2-5: SIBAL burned the whole 29 cm in orbit", () => {
    const r = row("PSI-99-0:r6");
    expect(r.material.name).toBe("SIBAL cotton-fiberglass fabric");
    expect(r.outcome.value).toBe("burned-out");
    expect(r.measures.spreadRateMicrogravity.v).toBe("2.1 mm/s");
  });

  it("Saffire-II: a blank material stays blank, \"1 cm\" in a mm column is converted, flow-visualisation rows are asides", () => {
    expect(row("PSI-99-0:r7").material.name).toBeNull();
    expect(row("PSI-99-0:r7").flags).toContain("material-blank");
    expect(row("PSI-99-0:r10").measures.thicknessMm.v).toBe(10);
    expect(row("PSI-99-0:r10").measures.thicknessMm.flags).toContain("cell-unit-converted");
    expect(row("PSI-99-0:r11").rowKind).toBe("aside");
  });

  it("Saffire-II footnote lines are asides that keep NASA's text", () => {
    const r = row("PSI-99-0:r14");
    expect(r.rowKind).toBe("aside");
    expect(r.rowKindReason).toMatch(/NASA footnote: "Note 2 The PMMA portion was completely consumed/);
  });

  it("Saffire-I sample S1: SIBAL, O₂ range kept, length and width flagged", () => {
    const r = row("PSI-98-0:r2");
    expect(r.o2Pct?.values).toEqual([21.5, 21.7]);
    expect(r.outcome.value).toBe("burned");
    expect(r.flags).toContain("length-width-swapped");
  });

  it("BASS-II test B1: 100 µm PMMA film, O₂ and CO before and after", () => {
    const r = row("PSI-25-0:r2");
    expect(r.material).toMatchObject({ name: "PMMA", basis: "stated", form: "film", thicknessMm: 0.1, widthCm: 2 });
    expect(r.o2Pct?.v).toBe(22.2);
    expect(r.measures.coStartPpm.v).toBe(0);
    expect(r.measures.coEndPpm.v).toBe(6);
  });

  it("BASS-II test B2: final O₂ of 1.6% is flagged as implausible", () => {
    expect(row("PSI-25-0:r3").flags).toContain("o2-end-implausible");
  });

  it("BASS-II rods without a material are inferred PMMA, with the reason", () => {
    const rod = atlas.rows.find((r) => r.material.raw === "1/4\" clear rod")!;
    expect(rod.material).toMatchObject({ name: "PMMA", basis: "inferred", form: "rod", diameterMm: 6.35 });
    expect(rod.material.reason).toMatch(/PMMA Rods/);
  });

  it("ACME Flame Design run 1: ethylene, O₂ from mole fraction, pressure from atm", () => {
    const r = row("PSI-10-0:r2");
    expect(r.material.name).toBe("Ethylene");
    expect(r.o2Pct?.v).toBeCloseTo(20.7128374, 6);
    expect(r.pressurePsi?.v).toBeCloseTo(1.01184402 * 14.6959, 6);
  });

  it("inverse flames put the burner O₂ apart from ambient O₂", () => {
    const r = row("PSI-159-1:r2");
    expect(r.flameConfig).toBe("inverse");
    expect(r.o2Pct).toBeUndefined();
    expect(r.burnerO2Pct?.v).toBe(21);
    expect(r.outcome.value).toBe("no-ignition");
  });

  it("CFI-G cool flames sit near 39% O₂ and 2 atm with n-butane", () => {
    const cool = atlas.rows.filter((r) => r.source.kind === "psi" && r.source.table === "PSI-159-0" && /^yes/i.test(String(r.measures.coolFlame?.v)));
    expect(cool).toHaveLength(7);
    for (const r of cool) {
      expect(r.material.name).toBe("n-Butane");
      expect(r.o2Pct!.v!).toBeGreaterThan(38);
    }
  });

  it("ACME BRE: \"3400%\" oxygen is out of range, kept as raw text", () => {
    const r = atlas.rows.find((r) => r.o2Pct?.raw === "3400%")!;
    expect(r.o2Pct?.v).toBeNull();
    expect(r.o2Pct?.flags).toContain("out-of-range");
    expect(r.rowKind).toBe("session");
  });

  it("ACME CLD fill-down labels are not given a gas name", () => {
    const r = atlas.rows.find((r) => r.material.raw === "40% CH5")!;
    expect(r.material.name).toBeNull();
    expect(r.flags).toContain("label-fill-down");
    expect(atlas.rows.find((r) => r.source.kind === "psi" && r.source.table === "PSI-106-0" && r.material.raw === "100% C2H6")?.material.name).toBe("Ethane");
  });

  it("ACME E-field continuation lines are asides", () => {
    expect(row("PSI-22-0:r4").rowKind).toBe("aside");
    expect(row("PSI-22-0:r4").rowKindReason).toMatch(/continuation/);
  });

  it("NTRS Saffire VI-2: SIBAL at 31% O₂ and 54.1 kPa burned", () => {
    const r = row("NTRS-20240002981:VI-2");
    expect(r.o2Pct?.v).toBe(31);
    expect(r.pressurePsi?.v).toBeCloseTo(7.85, 2);
    expect(r.outcome.value).toBe("burned");
    expect(r.measures.coIncreasePpm.v).toBe(120);
  });
});

describe("material dictionary", () => {
  it("names every stored material label, or says why not", () => {
    for (const [id, spec] of Object.entries(SPECS)) {
      if (!("col" in spec.material)) continue;
      const t = TABLES[id];
      const i = t.header.findIndex((h) => norm(h) === norm((spec.material as { col: string }).col));
      for (const raw of new Set(t.rows.map((r) => r.cells[i] ?? ""))) {
        const m = normaliseMaterial(raw, id);
        const explained = m.name || !raw.trim() || m.flags?.includes("label-fill-down") || /visulation|soot cleaning|spherical section/i.test(raw);
        expect(explained, `${id}: ${JSON.stringify(raw)}`).toBeTruthy();
      }
    }
  });

  it("reads thickness, width, diameter and sides from BASS-II labels", () => {
    expect(normaliseMaterial("4 mm thick   2 cm 2ide PMMA slab", "PSI-25-0")).toMatchObject({ name: "PMMA", thicknessMm: 4, widthCm: 2, flags: ["label-typo"] });
    expect(normaliseMaterial("2mm thick PMMA   1 sided   2 cm wide", "PSI-25-0")).toMatchObject({ thicknessMm: 2, widthCm: 2, sides: 1 });
    expect(normaliseMaterial("0.5\" black rod", "PSI-25-0")).toMatchObject({ name: "PMMA", basis: "inferred", diameterMm: 12.7 });
    expect(normaliseMaterial("PMMA sphere 2 cm", "PSI-26-0")).toMatchObject({ name: "PMMA", form: "sphere", diameterMm: 20 });
  });
});
