import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../data/table-manifest.json";
import { TABLES } from "../../data/tables";
import { SAFFIRE_NTRS_RUNS } from "../../data/ntrs-saffire";
import { buildAudit } from "./audit";
import { compactAtlas } from "./compact";
import { atlasCsv, buildAtlas, conditionStatus, experimentCount, multiShape } from "./build";
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

describe("data audit", () => {
  const audit = buildAudit(atlas, TABLES);
  const find = (table: string, title: RegExp) => audit.issues.find((i) => i.table === table && title.test(i.title));

  it("matches the committed audit file", () => {
    expect(JSON.parse(readFileSync("src/data/atlas/audit.json", "utf8"))).toEqual(JSON.parse(JSON.stringify(audit)));
  });

  it("gives every issue a count, examples, a plain explanation and a handling note", () => {
    expect(new Set(audit.issues.map((i) => i.id)).size).toBe(audit.issues.length);
    for (const i of audit.issues) {
      expect(i.count, i.id).toBeGreaterThan(0);
      expect(i.examples.length, i.id).toBeGreaterThan(0);
      expect(i.detail.length, i.id).toBeGreaterThan(20);
      expect(i.handling.length, i.id).toBeGreaterThan(5);
    }
    expect(audit.totals.error + audit.totals.gap + audit.totals.note).toBe(audit.totals.issues);
  });

  it("quotes NASA's cells exactly: every flagged example is a real cell of its table", () => {
    for (const i of audit.issues) {
      for (const e of i.examples) {
        const m = /^(PSI-\d+-\d+) row (\d+)$/.exec(e.where);
        if (!m || !e.column || /→|×|sum of/.test(e.column)) continue;
        const t = TABLES[m[1]];
        const cells = t.rows.find((r) => r.sourceRow === Number(m[2]))!.cells.map((c) => String(c ?? "").trim());
        if (e.raw !== "(blank)" && !/also row/.test(e.raw)) expect(cells, `${i.id} ${e.where}`).toContain(e.raw);
      }
    }
  });

  it("finds the issues checked by hand", () => {
    expect(find("PSI-20-0", /outside physical limits/)?.examples.map((e) => e.raw)).toEqual(["3400%", "2100%"]);
    expect(find("PSI-99-0", /decimal point/)?.count).toBe(3);
    expect(find("PSI-69-0", /do not add up/)?.count).toBe(6);
    expect(find("PSI-39-0", /do not add up/)?.count).toBe(4);
    expect(find("PSI-69-0", /identifier used twice/)?.examples[0].raw).toMatch(/193F001/);
    expect(find("PSI-25-0", /cannot produce/)?.examples[0].raw).toBe("22.2 → 1.6");
    expect(find("PSI-98-0", /three different thicknesses/)?.examples.map((e) => e.raw)).toEqual(["0.37", "037 mm", ".33 cm"]);
    expect(find("PSI-99-0", /not tests/)?.count).toBe(6);
  });
});

describe("compact atlas for the app", () => {
  it("matches the committed atlas-rows.json and covers every record", () => {
    const compact = compactAtlas(atlas);
    expect(JSON.parse(readFileSync("src/data/atlas/atlas-rows.json", "utf8"))).toEqual(JSON.parse(JSON.stringify(compact)));
    expect(compact).toHaveLength(atlas.rows.length);
    for (const r of compact) expect(r.cells.length, r.id).toBeGreaterThan(0);
  });
});

describe("observations, experiments and supplements", () => {
  const tests = atlas.rows.filter((r) => r.rowKind === "test");
  const inv = (id: string) => tests.filter((r) => r.investigation === id);
  const runs = (rs: AtlasRow[]) => new Set(rs.map((r) => r.experiment!.id)).size;

  it("counts test rows and experiments separately", () => {
    expect(atlas.counts.byKind).toEqual({ test: 1912, session: 103, matrix: 16, supplement: 109, aside: 28 });
    expect(atlas.counts.experiments).toBe(experimentCount(atlas.rows));
    // Every aged re-measurement is a second observation of a run already counted.
    const aged = tests.filter((r) => r.experiment?.role === "aged").length;
    expect(aged).toBe(58);
    expect(atlas.counts.experiments).toBe(tests.length - aged);
  });

  it("SAME: 45 test rows observe 29 runs; SAME-R: 109 observe 67", () => {
    expect([inv("same").length, runs(inv("same"))]).toEqual([45, 29]);
    expect([inv("same-r").length, runs(inv("same-r"))]).toEqual([109, 67]);
  });

  it("never gives two fresh rows, or two aged rows, of one table the same run identity", () => {
    const seen = new Set<string>();
    for (const r of atlas.rows.filter((x) => x.experiment && x.source.kind === "psi")) {
      const key = `${(r.source as { table: string }).table}|${r.experiment!.id}|${r.experiment!.role}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("gives every aged row a fresh row of the same run in the same table", () => {
    const fresh = new Set(atlas.rows.filter((r) => r.experiment?.role === "run").map((r) => `${(r.source as { table?: string }).table}|${r.experiment!.id}`));
    for (const r of atlas.rows.filter((x) => x.experiment?.role === "aged")) expect(fresh.has(`${(r.source as { table?: string }).table}|${r.experiment!.id}`), r.id).toBe(true);
  });

  it("keeps SAME-R workbook rows as supplements of tests in the run table, and reports the two runs that do not line up", () => {
    const sup = atlas.rows.filter((r) => r.rowKind === "supplement");
    expect(sup).toHaveLength(109);
    expect(sup.every((r) => r.investigation === "same-r" && r.experiment && r.fuelClass !== undefined)).toBe(true);
    expect(sup.filter((r) => r.experiment!.match === "unmatched").map((r) => r.experiment!.id)).toEqual(["same-r:kapton:112"]);
    // "57" is used under two materials in NASA's run table; only the Lampwick one is in the workbook.
    expect(row("PSI-101-0:r57").experiment!.id).toBe("same-r:lampwick:57");
    expect(row("PSI-101-0:r75").experiment!.id).toBe("same-r:teflon:57");
    const issue = buildAudit(atlas, TABLES).issues.find((i) => i.title === "Run table and results workbook list different runs")!;
    expect(issue.kind).toBe("note");
    expect(issue.examples.map((e) => e.raw).sort()).toEqual(["in the run table only: Teflon 57", "in the workbook only: Kapton 112"]);
    expect(issue.handling).toMatch(/^Unresolved/);
  });

  it("does not count SAME's 8-line matrix as tests", () => {
    expect(atlas.rows.filter((r) => r.source.kind === "psi" && r.source.table === "PSI-102-0").map((r) => r.rowKind)).toEqual(Array(8).fill("matrix"));
  });
});

describe("what a value is", () => {
  it("tells a list, a range and a start-to-end drift apart, from how NASA wrote the cell", () => {
    expect(multiShape("21; 26.5; 40")).toBe("list");
    expect(multiShape("21.5 - 21.7")).toBe("range");
    expect(multiShape("22.1 to 22.0")).toBe("trajectory");
    expect(multiShape("0.5; 1.0; 1.5; 2.0; or 3.0 ")).toBe("list");
    expect(row("PSI-98-0:r2").o2Pct).toMatchObject({ raw: "21.5 - 21.7", v: null, values: [21.5, 21.7], shape: "range" });
    expect(row("PSI-99-0:r9").o2Pct).toMatchObject({ v: null, values: [22.1, 22], shape: "trajectory" });
  });

  it("gives a shape to every multi-valued quantity and to nothing else", () => {
    for (const r of atlas.rows) for (const q of values(r)) {
      const multi = "values" in q && (q.values?.length ?? 0) > 1;
      expect(!!(q as Quantity).shape, `${r.id} ${q.col}`).toBe(multi);
      if (multi) expect(q.v).toBeNull();
    }
  });

  it("says how a number was obtained when it was not simply read", () => {
    expect(row("PSI-69-0:r2").pressurePsi!.status).toBe("converted"); // mmHg → psia
    expect(row("PSI-25-0:r2").o2Pct!.status).toBeUndefined(); // vol % as written
    expect(row("PSI-101-1:r4").measures.amdUm).toMatchObject({ raw: "0", v: null, status: "placeholder" });
    const censored = atlas.rows.flatMap((r) => values(r)).filter((q) => q.flags?.includes("censored"));
    expect(censored.length).toBeGreaterThan(0);
    expect(censored.every((q) => (q as Quantity).status === "bound" && q.v === null)).toBe(true);
  });

  it("says why a key condition is absent: an empty cell, or a table with no such column", () => {
    expect(row("PSI-25-0:r2").absent).toEqual({ pressurePsi: "not-in-table", flowCms: "not-in-table" });
    expect(conditionStatus(row("PSI-25-0:r2"), "pressurePsi")).toBe("not-in-table");
    expect(conditionStatus(row("PSI-25-0:r2"), "o2Pct")).toBe("reported");
    expect(conditionStatus(row("PSI-98-0:r2"), "o2Pct")).toBe("range");
    expect(conditionStatus(row("PSI-69-0:r2"), "pressurePsi")).toBe("converted");
    const csv = atlasCsv(atlas).split("\n");
    for (const col of ["experimentId", "experimentRole", "o2PctStatus", "pressurePsiStatus", "flowCmsStatus"]) expect(csv[0].split(","), col).toContain(col);
  });

  it("reads a zero particle diameter as missing only where the row has no particle count to compute it from", () => {
    const t = TABLES["PSI-101-1"];
    const col = (name: string) => t.header.findIndex((h) => norm(h) === norm(name));
    const [amd, m0] = [col("M1/M0 (micro-m)--AMD"), col("M0 best Diameter")];
    const zero = t.rows.filter((r) => r.cells[amd] === "0");
    expect(zero).toHaveLength(23);
    // The diameter is the ratio M1/M0. On every row where it is written as 0, M0 is itself 0 or an Excel error.
    for (const r of zero) expect(r.cells[m0] === "0" || r.cells[m0].startsWith("#"), `row ${r.sourceRow}: M0 = ${r.cells[m0]}`).toBe(true);
    // And no row with a usable particle count has a zero diameter.
    for (const r of t.rows.filter((x) => Number(x.cells[m0]) > 0)) expect(Number(r.cells[amd]), `row ${r.sourceRow}`).toBeGreaterThan(0);
  });
});
