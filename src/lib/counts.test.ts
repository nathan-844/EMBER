import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import committed from "../data/counts.json";
import findingsFile from "../data/findings.json";
import manifest from "../data/table-manifest.json";
import { TABLES } from "../data/tables";
import { buildBrief, buildCsv } from "./brief";
import { buildAtlas } from "./atlas/build";
import type { Counts } from "./counts";
import { rankInvestigations } from "./ranking";
import { scenarioLimitations } from "./limitations";
import { presetScenario } from "./scenario";
import { SNAPSHOT, snapshotLine } from "./snapshot";

const counts = committed as unknown as Counts;
const atlas = buildAtlas(TABLES, manifest);
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const n = (v: number) => v.toLocaleString("en-US");

// An independent recount: plain loops over the freshly built atlas and NASA's stored tables,
// sharing no code with src/lib/counts.ts.
describe("counts manifest, recounted", () => {
  const tests = atlas.rows.filter((r) => r.rowKind === "test");

  it("source rows: every stored NASA row, plus the NTRS samples", () => {
    const stored = manifest.tables.reduce((sum, t) => sum + TABLES[t.id].rows.length, 0);
    expect(counts.rows.psi).toBe(stored);
    expect(counts.rows.total).toBe(stored + counts.rows.ntrs);
    expect(counts.rows.total).toBe(atlas.rows.length);
    expect(Object.values(counts.rows.byKind).reduce((a, b) => a + b, 0)).toBe(counts.rows.total);
    expect(counts.sources.psiTables).toBe(Object.keys(TABLES).length);
  });

  it("observations and experiments are different numbers, and each is right", () => {
    let testRows = 0, aged = 0, supplements = 0;
    const ids = new Set<string>();
    for (const r of atlas.rows) {
      if (r.rowKind === "supplement") supplements++;
      if (r.rowKind !== "test") continue;
      testRows++;
      if (r.experiment?.role === "aged") aged++;
      ids.add(r.experiment ? r.experiment.id : r.id);
    }
    expect(counts.observations).toEqual({ testRows, supplementRows: supplements });
    expect(counts.experiments.total).toBe(ids.size);
    expect(counts.experiments.total).toBe(testRows - aged);
    expect(counts.experiments.total).toBeLessThan(counts.observations.testRows);
    const reviewedRows = Object.values(counts.experiments.reviewed).reduce((s, r) => s + r.testRows, 0);
    expect(reviewedRows + counts.experiments.unreviewedTestRows).toBe(testRows);
    expect(counts.experiments.reviewed).toMatchObject({
      same: { experiments: 29, testRows: 45, agedMeasurements: 16 },
      "same-r": { experiments: 67, testRows: 109, agedMeasurements: 42, supplementRows: 109, unmatchedSupplements: 1 },
    });
  });

  it("test-row breakdowns", () => {
    const one = (q?: { v: number | null }) => typeof q?.v === "number";
    expect(counts.tests).toMatchObject({
      withOutcome: tests.filter((r) => r.outcome.value !== "not-recorded").length,
      outcomeNotRecorded: tests.filter((r) => r.outcome.value === "not-recorded").length,
      solid: tests.filter((r) => r.fuelClass === "solid").length,
      solidWithScalarPressure: tests.filter((r) => r.fuelClass === "solid" && one(r.pressurePsi)).length,
      inferredMaterial: tests.filter((r) => r.material.basis === "inferred").length,
      withoutScalarOxygen: tests.filter((r) => !one(r.o2Pct)).length,
      multiValuedOxygen: 3,
      withoutScalarPressure: tests.filter((r) => !one(r.pressurePsi)).length,
      withoutScalarFlow: tests.filter((r) => !one(r.flowCms)).length,
    });
    expect(counts.tests.withOutcome + counts.tests.outcomeNotRecorded).toBe(tests.length);
    expect(Object.values(counts.tests.byFuelClass).reduce((a, b) => a + b, 0)).toBe(tests.length);
  });

  it("findings are listed, not summed: their samples overlap", () => {
    expect(counts.findings.ids).toEqual(findingsFile.findings.map((f) => f.id));
    const cited = findingsFile.findings.flatMap((f) => f.rows);
    expect(new Set(cited).size).toBeLessThan(cited.length);
  });

  it("carries a snapshot id that is the hash of the data files it names", () => {
    const h = createHash("sha256");
    for (const f of counts.snapshot.files) h.update(f).update("\0").update(read(f)).update("\0");
    expect(counts.snapshot.sha256).toBe(h.digest("hex"));
    expect(counts.snapshot.id).toBe(counts.snapshot.sha256.slice(0, 12));
  });
});

describe("exports name their snapshot", () => {
  const s = presetScenario("lunar-habitat");
  const ranked = rankInvestigations(s);

  it("the evidence brief states the snapshot id and its full hash", () => {
    const md = buildBrief(s, ranked, scenarioLimitations(s, ranked), new Date("2026-11-15"));
    expect(md).toContain(snapshotLine());
    expect(md).toContain(SNAPSHOT.sha256);
  });

  it("every line of the scenario CSV carries the snapshot id", () => {
    const lines = buildCsv(s, ranked).trim().split("\n");
    expect(lines[0].split(",").at(-1)).toBe("ember_snapshot");
    for (const l of lines.slice(1)) expect(l.endsWith(`,${SNAPSHOT.id}`)).toBe(true);
  });
});

// Counts written in prose must equal the manifest. Each pattern captures the numbers in one
// sentence of a doc; a doc that drifts from the data fails here.
describe("counts quoted in the docs", () => {
  const c = counts, k = c.rows.byKind;
  const cases: [string, RegExp, (string | number)[]][] = [
    ["README.md", /every NASA source row \(([\d,]+) from (\d+) PSI tables/, [n(c.rows.psi), c.sources.psiTables]],
    ["README.md", /([\d,]+) test rows that\s+observe ([\d,]+) distinct experiments/, [n(k.test), n(c.experiments.total)]],
    ["README.md", /(\d+) data-quality issues EMBER found/, [c.audit.issues]],
    ["README.md", /measured findings\*\* - (\w+) results/, [["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][c.findings.count]]],
    ["docs/FEATURES.md", /in one schema: ([\d,]+) records\. ([\d,]+) are test rows, which\s+observe ([\d,]+) distinct experiments/, [n(c.rows.total), n(k.test), n(c.experiments.total)]],
    ["docs/FEATURES.md", /(\d+) are supplement rows/, [k.supplement]],
    ["docs/FEATURES.md", /The rest are (\d+)\s+session summaries, (\d+) test-matrix rows and (\d+) asides/, [k.session, k.matrix, k.aside]],
    ["docs/FEATURES.md", /(\d+) issues in (\d+) of the (\d+) tables: (\d+) likely errors/, [c.audit.issues, c.audit.tablesAffected, c.audit.tablesChecked, c.audit.error]],
    ["docs/FEATURES.md", /and (\d+) quirks/, [c.audit.note]],
    ["docs/FEATURES.md", /from \d+ of the (\d+) stored NASA PSI/, [c.sources.psiTables]],
    ["docs/DATA.md", /([\d,]+) PSI rows plus the (\d+) Saffire IV–VI samples from the NTRS paper, ([\d,]+) records/, [n(c.rows.psi), c.rows.ntrs, n(c.rows.total)]],
    ["docs/DATA.md", /\*\*([\d,]+) test rows\*\* are observations of \*\*([\d,]+) distinct experiments\*\*/, [n(k.test), n(c.experiments.total)]],
    ["docs/DATA.md", /The other ([\d,]+) test rows are taken as one experiment each/, [n(c.experiments.unreviewedTestRows)]],
    ["docs/DATA.md", /\*\*(\d+) supplement rows\*\*/, [k.supplement]],
    ["docs/DATA.md", /\*\*(\d+) session rows\*\*, \*\*(\d+) matrix rows\*\* and \*\*(\d+) asides\*\*/, [k.session, k.matrix, k.aside]],
    ["docs/ATLAS-DATA-CARD.md", /([\d,]+) records: ([\d,]+) test rows, (\d+) supplement rows[^,]*, (\d+) per-day session summaries, (\d+) test-matrix rows and (\d+) non-test lines/, [n(c.rows.total), n(k.test), k.supplement, k.session, k.matrix, k.aside]],
    ["docs/ATLAS-DATA-CARD.md", /observe ([\d,]+) distinct experiments: SAME and SAME-R measured (\d+) runs a second time/, [n(c.experiments.total), k.test - c.experiments.total]],
    ["docs/ATLAS-DATA-CARD.md", /Test rows by fuel: ([\d,]+) gas, (\d+) solid, (\d+) liquid\. (\d+) test rows have a recorded outcome/, [n(c.tests.byFuelClass.gas), c.tests.byFuelClass.solid, c.tests.byFuelClass.liquid, c.tests.withOutcome]],
    ["docs/ATLAS-DATA-CARD.md", /Only (\d+) of (\d+) solid-material test rows record pressure/, [c.tests.solidWithScalarPressure, c.tests.solid]],
    ["docs/ATLAS-DATA-CARD.md", /`audit\.json` \| (\d+) data-quality issues/, [c.audit.issues]],
    ["docs/ATLAS-DATA-CARD.md", /combustion science: (\d+) tables from (\d+) investigation records/, [c.sources.psiTables, c.sources.psiRecordsWithTables]],
    ["docs/ATLAS-DATA-CARD.md", /([\d,]+) PSI rows in all/, [n(c.rows.psi)]],
  ];

  it.each(cases)("%s: %s", (file, pattern, expected) => {
    const m = read(file).match(pattern);
    expect(m, `sentence not found in ${file}`).not.toBeNull();
    expect(m!.slice(1)).toEqual(expected.map(String));
  });
});
