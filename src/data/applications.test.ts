import { describe, expect, it } from "vitest";
import { EQUIPMENT_LINKS, UPCOMING } from "./applications";
import { getInvestigation } from "./investigations";
import { getPsiRecord } from "./psi";
import { equipmentGroups, upcomingFor } from "../lib/equipment";
import { rankInvestigations } from "../lib/ranking";
import { presetScenario } from "../lib/scenario";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("equipment links", () => {
  it.each(EQUIPMENT_LINKS.map((l) => [l.id, l] as const))("%s quotes its NASA PSI record word for word", (_id, l) => {
    const rec = getPsiRecord(l.quote.accession);
    expect(rec, l.quote.accession).toBeDefined();
    expect(squash(rec!.objectives)).toContain(squash(l.quote.text));
  });

  it.each(EQUIPMENT_LINKS.map((l) => [l.id, l] as const))("%s points at real profiles, one of which owns the quote", (_id, l) => {
    const invs = l.investigations.map((id) => getInvestigation(id));
    expect(invs.every(Boolean)).toBe(true);
    expect(invs.some((i) => i!.psi.accession === l.quote.accession)).toBe(true);
  });

  it("covers detection, suppression, ventilation and materials", () => {
    expect(new Set(EQUIPMENT_LINKS.map((l) => l.area))).toEqual(new Set(["detection", "suppression", "ventilation", "materials"]));
  });

  it("leads with the areas that serve the scenario's safety question", () => {
    const s = { ...presetScenario("iss"), question: "detection" as const };
    expect(equipmentGroups(s, rankInvestigations(s))[0].area).toBe("detection");
  });
});

describe("upcoming studies", () => {
  it("flag FM2 and LUCI for a lunar habitat and SoFIE for its 30% oxygen solid fuel", () => {
    const u = upcomingFor(presetScenario("lunar-habitat"));
    expect(u.filter((x) => x.relevant).map((x) => x.id).sort()).toEqual(["fm2", "luci", "sofie"]);
  });

  it("flag none for the ISS cabin", () => {
    expect(upcomingFor(presetScenario("iss")).some((x) => x.relevant)).toBe(false);
  });

  it("cite a public page for every study", () => {
    for (const u of UPCOMING) expect(u.quote.url).toMatch(/^https:\/\//);
  });
});
