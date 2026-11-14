import { describe, expect, it } from "vitest";
import { INVESTIGATIONS } from "./investigations";

describe("curated data audit", () => {
  it.each(INVESTIGATIONS.map((i) => [i.name, i] as const))("%s has valid ranges with a stated basis", (_name, inv) => {
    for (const r of Object.values(inv.conditions)) {
      if (!r) continue;
      expect(r.min).toBeLessThanOrEqual(r.max);
      expect(r.min).toBeGreaterThanOrEqual(0);
      expect(r.basis.length).toBeGreaterThan(5);
    }
  });

  it("a verified PSI record always has an accession and a date", () => {
    for (const inv of INVESTIGATIONS) {
      if (inv.psi.verifiedOn) {
        expect(inv.psi.accession).toBeTruthy();
        expect(inv.psi.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("does not list a question as both direct and adjacent", () => {
    for (const inv of INVESTIGATIONS) {
      expect(inv.questions.filter((q) => inv.adjacentQuestions.includes(q))).toEqual([]);
    }
  });

  it("PSI urls point at psi.nasa.gov", () => {
    for (const inv of INVESTIGATIONS) if (inv.psi.url) expect(inv.psi.url).toMatch(/^https:\/\/psi\.nasa\.gov\//);
  });
});
