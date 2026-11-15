import { describe, expect, it } from "vitest";
import { INVESTIGATIONS, PSI_ACCESSIONS } from "./investigations";
import { getPsiRecord, PSI_SNAPSHOT } from "./psi";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

describe("NASA PSI links", () => {
  it("every curated profile is linked to a PSI accession", () => {
    for (const inv of INVESTIGATIONS) expect(inv.psi.accession, inv.id).toMatch(/^PSI-\d+$/);
  });

  it.each(INVESTIGATIONS.map((i) => [i.name, i] as const))("%s links to a Combustion Science record in the snapshot", (_n, inv) => {
    const rec = getPsiRecord(inv.psi.accession);
    expect(rec, inv.psi.accession ?? "").toBeDefined();
    expect(rec!.researchArea).toBe("Combustion Science");
    expect(inv.psi.url).toBe(rec!.url);
  });

  it.each(INVESTIGATIONS.map((i) => [i.name, i] as const))("%s matches the PSI acronym", (_n, inv) => {
    const acronym = norm(getPsiRecord(inv.psi.accession)!.acronym ?? "");
    expect(acronym).toContain(norm(inv.name));
  });

  it("no accession is reused except the shared DAFT / DAFT-2 record", () => {
    const counts = new Map<string, number>();
    for (const a of Object.values(PSI_ACCESSIONS)) counts.set(a, (counts.get(a) ?? 0) + 1);
    const shared = [...counts].filter(([, n]) => n > 1).map(([a]) => a);
    expect(shared).toEqual(["PSI-47"]);
  });

  it("the snapshot records where and when it was fetched", () => {
    expect(PSI_SNAPSHOT.source).toMatch(/^https:\/\/psi\.nasa\.gov\//);
    expect(PSI_SNAPSHOT.fetchedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PSI_SNAPSHOT.responseSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ground analysis records", () => {
  it("are exactly the PSI combustion records EMBER does not profile, and each links to a profiled flight study", async () => {
    const { ANALYSIS_RECORDS } = await import("./psi");
    const { PSI_ACCESSIONS } = await import("./investigations");
    const profiled = new Set(Object.values(PSI_ACCESSIONS));
    expect(ANALYSIS_RECORDS.map((r) => r.accession).sort()).toEqual(["PSI-115", "PSI-117", "PSI-142", "PSI-60", "PSI-62"]);
    for (const r of ANALYSIS_RECORDS) expect(r.relatedInvestigations.some((a) => profiled.has(a)), r.accession).toBe(true);
    expect(PSI_SNAPSHOT.records.every((r) => profiled.has(r.accession) || ANALYSIS_RECORDS.includes(r))).toBe(true);
  });
});
